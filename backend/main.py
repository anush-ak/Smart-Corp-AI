import os
import shutil
import traceback
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    WebSocket,
    WebSocketDisconnect,
    Request,
)
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from backend.config import ALLOWED_ORIGINS
from backend.database import SessionLocal, get_db, Base, engine
from backend.models import User, Organization, Project, Task, AuditEvent, Document
from backend.auth import verify_password, create_access_token, get_current_user, require_roles
from backend.rag_service import ingest_pdf, ask_knowledge_base, get_indexed_documents_count
from backend.create_demo_docs import create_hr_leave_policy, create_remote_work_policy
from backend.meeting_service import extract_tasks_from_notes, DraftTaskItem

app = FastAPI(
    title="SmartCorp AI API",
    description="Multi-tenant Enterprise Operations Copilot",
    version="1.0.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://smart-corp-ai.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


# Schemas
class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    org_id: int
    org_name: str
    department: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "app": "SmartCorp AI",
        "version": "1.0.0",
    }


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    org_name = org.name if org else "Unknown Organization"

    token = create_access_token(
        user_id=user.id,
        org_id=user.org_id,
        role=user.role,
        name=user.name,
        email=user.email,
    )

    # Log audit event for sign-in
    try:
        audit_log = AuditEvent(
            org_id=user.org_id,
            user_id=user.id,
            user_name=user.name,
            action="USER_LOGIN",
            resource_type="auth",
            resource_id=str(user.id),
            details=f"User {user.name} ({user.role}) logged in successfully.",
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        db.rollback()
        # Don't block login if audit logging fails
        print(f"Warning: Failed to log audit event: {e}")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "org_id": user.org_id,
            "org_name": org_name,
            "department": user.department,
        },
    }


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    org_name = org.name if org else "Unknown Organization"

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "org_id": current_user.org_id,
        "org_name": org_name,
        "department": current_user.department,
    }


# Phase 2: Executive Dashboard & Audit Trail Schemas
class TaskStatusBreakdownItem(BaseModel):
    status: str
    count: int


class TeamWorkloadItem(BaseModel):
    user_id: int
    full_name: str
    role: str
    department: Optional[str] = None
    est_hours: float


class KpisResponse(BaseModel):
    active_projects: int
    overdue_tasks: int
    completed_tasks: int
    pending_approvals: int


class DashboardSummaryResponse(BaseModel):
    kpis: KpisResponse
    active_projects: int
    overdue_tasks: int
    completed_tasks: int
    pending_approvals: int
    task_status_breakdown: List[TaskStatusBreakdownItem]
    team_workload: List[TeamWorkloadItem]


class AuditEventResponse(BaseModel):
    id: int
    org_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


# Phase 2 Endpoints
@app.get("/api/dashboard/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.org_id
    now = datetime.now(timezone.utc)

    # 1. Deterministic KPIs from PostgreSQL
    active_projects = (
        db.query(Project)
        .filter(Project.org_id == org_id, Project.status == "In Progress")
        .count()
    )

    overdue_tasks = (
        db.query(Task)
        .filter(
            Task.org_id == org_id,
            Task.status != "Done",
            Task.due_date.isnot(None),
            Task.due_date < now,
        )
        .count()
    )

    completed_tasks = (
        db.query(Task)
        .filter(Task.org_id == org_id, Task.status == "Done")
        .count()
    )

    pending_approvals = (
        db.query(Task)
        .filter(
            Task.org_id == org_id,
            Task.status.in_(["Pending Approval", "In Review"]),
        )
        .count()
    )

    # 2. Task Status Breakdown for Donut Chart
    raw_status_counts = (
        db.query(Task.status, func.count(Task.id))
        .filter(Task.org_id == org_id)
        .group_by(Task.status)
        .all()
    )

    status_map = {
        "Todo": 0,
        "In Progress": 0,
        "Pending Approval": 0,
        "Done": 0,
    }

    for st, count in raw_status_counts:
        mapped_st = "Pending Approval" if st == "In Review" else st
        if mapped_st in status_map:
            status_map[mapped_st] += count
        else:
            status_map[mapped_st] = count

    ordered_statuses = ["Todo", "In Progress", "Pending Approval", "Done"]
    task_status_breakdown = [
        TaskStatusBreakdownItem(status=st, count=status_map.get(st, 0))
        for st in ordered_statuses
    ]

    # 3. Team Workload
    users = (
        db.query(User)
        .filter(User.org_id == org_id, User.is_active == True)
        .order_by(User.name.asc())
        .all()
    )

    team_workload = []
    for u in users:
        hours = (
            db.query(func.coalesce(func.sum(Task.estimated_hours), 0.0))
            .filter(
                Task.org_id == org_id,
                Task.assignee_id == u.id,
                Task.status != "Done",
            )
            .scalar()
        )
        team_workload.append(
            TeamWorkloadItem(
                user_id=u.id,
                full_name=u.name,
                role=u.role,
                department=u.department or "Operations",
                est_hours=round(float(hours), 1),
            )
        )

    # Sort descending by est_hours so the overloaded employee is at index 0
    team_workload.sort(key=lambda x: x.est_hours, reverse=True)

    kpis_obj = KpisResponse(
        active_projects=active_projects,
        overdue_tasks=overdue_tasks,
        completed_tasks=completed_tasks,
        pending_approvals=pending_approvals,
    )

    return DashboardSummaryResponse(
        kpis=kpis_obj,
        active_projects=active_projects,
        overdue_tasks=overdue_tasks,
        completed_tasks=completed_tasks,
        pending_approvals=pending_approvals,
        task_status_breakdown=task_status_breakdown,
        team_workload=team_workload,
    )


@app.get("/api/audit-events", response_model=List[AuditEventResponse])
def get_audit_events(
    current_user: User = Depends(require_roles("Admin", "Manager")),
    db: Session = Depends(get_db),
):
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.org_id == current_user.org_id)
        .order_by(AuditEvent.timestamp.desc())
        .limit(100)
        .all()
    )
    return events


@app.on_event("startup")
def on_startup():
    # 1. Ensure all database tables exist
    try:
        Base.metadata.create_all(bind=engine)
        print("Base.metadata.create_all executed successfully.")
    except Exception as ddl_err:
        print(f"Base.metadata.create_all notice: {ddl_err}")

    # 2. Automatically seed/update Acme Corp users (Anush, Sidharth, Nicholas, Hitesh) with password123 on startup
    try:
        from backend.seed import seed_database
        seed_database()
    except Exception as seed_err:
        print(f"Startup database seeding error: {seed_err}")

    # 3. Print active users in database for Render logs
    try:
        db = SessionLocal()
        try:
            print("ACTIVE USERS IN DB:", [u.email for u in db.query(User).all()])
        finally:
            db.close()
    except Exception as user_log_err:
        print(f"Startup active users query error: {user_log_err}")

    # 4. Check if ChromaDB collection is empty for Org 1; if so, auto-ingest demo documents
    try:
        count = get_indexed_documents_count(org_id=1)
        demo_dir = os.path.join(os.path.dirname(__file__), "demo_docs")
        os.makedirs(demo_dir, exist_ok=True)

        pdf_hr = os.path.join(demo_dir, "HR_Leave_Policy.pdf")
        pdf_remote = os.path.join(demo_dir, "Remote_Work_Policy.pdf")

        if not os.path.exists(pdf_hr):
            create_hr_leave_policy(pdf_hr)
        if not os.path.exists(pdf_remote):
            create_remote_work_policy(pdf_remote)

        if count == 0:
            print("ChromaDB empty for Org 1: Auto-ingesting demo documents from backend/demo_docs/...")
            c1 = ingest_pdf(pdf_hr, "HR_Leave_Policy.pdf", org_id=1)
            c2 = ingest_pdf(pdf_remote, "Remote_Work_Policy.pdf", org_id=1)
            print(f"Auto-ingested HR_Leave_Policy ({c1} chunks) and Remote_Work_Policy ({c2} chunks)")

        # Ensure matching records exist in the PostgreSQL documents table for Org 1
        for attempt in range(3):
            try:
                db = SessionLocal()
                try:
                    admin_user = db.query(User).filter(User.org_id == 1, User.role == "Admin").first()
                    admin_id = admin_user.id if admin_user else None

                    demo_files = [
                        ("HR_Leave_Policy.pdf", "HR Leave & Time-Off Policy", "HR & People Ops", pdf_hr),
                        ("Remote_Work_Policy.pdf", "Remote & Hybrid Work Policy", "Operations", pdf_remote),
                    ]

                    for fn, title, cat, path in demo_files:
                        existing = db.query(Document).filter(Document.org_id == 1, Document.filename == fn).first()
                        if not existing:
                            chunk_count = 11 if "Leave" in fn else 10
                            size = os.path.getsize(path) if os.path.exists(path) else 0
                            doc_record = Document(
                                org_id=1,
                                uploaded_by=admin_id,
                                title=title,
                                filename=fn,
                                file_path=path,
                                file_size=size,
                                category=cat,
                                chunk_count=chunk_count,
                            )
                            db.add(doc_record)
                    db.commit()
                    break
                finally:
                    db.close()
            except Exception as db_err:
                if attempt == 2:
                    print(f"Warning: PostgreSQL doc sync retry failed: {db_err}")
                else:
                    import time
                    time.sleep(1)
    except Exception as e:
        print(f"Startup ChromaDB auto-ingestion error: {e}")


# Phase 3: Document Ingestion & RAG Knowledge Schemas
class DocumentResponse(BaseModel):
    id: int
    org_id: int
    title: str
    filename: str
    file_size: int
    category: str
    chunk_count: int
    created_at: datetime
    uploaded_by: Optional[int] = None
    uploader_name: Optional[str] = None

    class Config:
        from_attributes = True


class KnowledgeAskRequest(BaseModel):
    question: str


class CitationItem(BaseModel):
    id: str
    filename: str
    page: int
    excerpt: str


class KnowledgeAskResponse(BaseModel):
    answer: str
    citations: List[CitationItem]


# Phase 3 Endpoints
@app.get("/api/documents", response_model=List[DocumentResponse])
def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(Document.org_id == current_user.org_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    res = []
    for d in docs:
        uploader = db.query(User).filter(User.id == d.uploaded_by).first() if d.uploaded_by else None
        res.append(
            DocumentResponse(
                id=d.id,
                org_id=d.org_id,
                title=d.title,
                filename=d.filename,
                file_size=d.file_size,
                category=d.category,
                chunk_count=d.chunk_count,
                created_at=d.created_at,
                uploaded_by=d.uploaded_by,
                uploader_name=uploader.name if uploader else "System / HR",
            )
        )
    return res


@app.post("/api/documents/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form("General Policy"),
    current_user: User = Depends(require_roles("Admin", "HR")),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only text-based PDF documents are supported (.pdf)",
        )

    # Secure storage directory per tenant
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads", f"org_{current_user.org_id}")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {e}",
        )

    # Run ingest_pdf with strict tenant isolation
    try:
        chunk_count = ingest_pdf(
            file_path=file_path,
            filename=file.filename,
            org_id=current_user.org_id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse and index PDF: {e}",
        )

    file_size = os.path.getsize(file_path)
    doc_title = title.strip() if title and title.strip() else file.filename.replace("_", " ").replace(".pdf", "")

    # Save metadata to PostgreSQL documents table
    doc_record = (
        db.query(Document)
        .filter(Document.org_id == current_user.org_id, Document.filename == file.filename)
        .first()
    )
    if doc_record:
        doc_record.title = doc_title
        doc_record.file_path = file_path
        doc_record.file_size = file_size
        doc_record.category = category or "General Policy"
        doc_record.chunk_count = chunk_count
        doc_record.uploaded_by = current_user.id
    else:
        doc_record = Document(
            org_id=current_user.org_id,
            uploaded_by=current_user.id,
            title=doc_title,
            filename=file.filename,
            file_path=file_path,
            file_size=file_size,
            category=category or "General Policy",
            chunk_count=chunk_count,
        )
        db.add(doc_record)

    db.commit()
    db.refresh(doc_record)

    # Log audit event for tenant compliance
    try:
        audit_log = AuditEvent(
            org_id=current_user.org_id,
            user_id=current_user.id,
            user_name=current_user.name,
            action="DOCUMENT_UPLOAD",
            resource_type="document",
            resource_id=str(doc_record.id),
            details=f"Uploaded and indexed policy document '{file.filename}' ({chunk_count} chunks).",
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: Failed to log audit event: {e}")

    return DocumentResponse(
        id=doc_record.id,
        org_id=doc_record.org_id,
        title=doc_record.title,
        filename=doc_record.filename,
        file_size=doc_record.file_size,
        category=doc_record.category,
        chunk_count=doc_record.chunk_count,
        created_at=doc_record.created_at,
        uploaded_by=doc_record.uploaded_by,
        uploader_name=current_user.name,
    )


@app.post("/api/knowledge/ask", response_model=KnowledgeAskResponse)
def ask_knowledge(
    payload: KnowledgeAskRequest,
    current_user: User = Depends(get_current_user),
):
    # Runs ask_knowledge_base strictly scoped to current_user.org_id
    result = ask_knowledge_base(
        question=payload.question,
        org_id=current_user.org_id,
    )
    return KnowledgeAskResponse(
        answer=result["answer"],
        citations=[CitationItem(**c) for c in result["citations"]],
    )


# =============================================================================
# Phase 4: Real-Time WebSockets & Task Management
# =============================================================================

class ConnectionManager:
    def __init__(self):
        # org_id -> list of active WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, org_id: int, websocket: WebSocket):
        await websocket.accept()
        if org_id not in self.active_connections:
            self.active_connections[org_id] = []
        self.active_connections[org_id].append(websocket)

    def disconnect(self, org_id: int, websocket: WebSocket):
        if org_id in self.active_connections:
            if websocket in self.active_connections[org_id]:
                self.active_connections[org_id].remove(websocket)
            if not self.active_connections[org_id]:
                del self.active_connections[org_id]

    async def broadcast_to_org(self, org_id: int, message: Dict[str, Any]):
        if org_id not in self.active_connections:
            return
        dead_connections = []
        for connection in list(self.active_connections[org_id]):
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(org_id, dead)


manager = ConnectionManager()


@app.websocket("/ws/{org_id}")
async def websocket_endpoint(websocket: WebSocket, org_id: int):
    await manager.connect(org_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except (WebSocketDisconnect, Exception):
        manager.disconnect(org_id, websocket)


# Phase 4 Schemas
class MeetingExtractRequest(BaseModel):
    notes: str


class MeetingExtractResponse(BaseModel):
    tasks: List[DraftTaskItem]


class BatchTaskItem(BaseModel):
    title: str
    assignee: Optional[str] = "Unassigned"
    priority: Optional[str] = "Medium"
    due_date: Optional[str] = None
    est_hours: Optional[float] = 4.0
    project_id: Optional[int] = None
    description: Optional[str] = None


class BatchTaskCreateRequest(BaseModel):
    tasks: List[BatchTaskItem]


class TaskResponse(BaseModel):
    id: int
    org_id: int
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    assignee_role: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    estimated_hours: float
    due_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TaskUpdateRequest(BaseModel):
    status: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    priority: Optional[str] = None
    estimated_hours: Optional[float] = None
    due_date: Optional[str] = None
    title: Optional[str] = None


def serialize_task(task: Task) -> TaskResponse:
    project_name = task.project.name if task.project else None
    assignee_name = task.assignee.name if task.assignee else "Unassigned"
    assignee_role = task.assignee.role if task.assignee else None
    return TaskResponse(
        id=task.id,
        org_id=task.org_id,
        project_id=task.project_id,
        project_name=project_name,
        assignee_id=task.assignee_id,
        assignee_name=assignee_name,
        assignee_role=assignee_role,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        estimated_hours=float(task.estimated_hours or 0.0),
        due_date=task.due_date,
        created_at=task.created_at,
    )


@app.post("/api/meetings/extract", response_model=MeetingExtractResponse)
def extract_meeting_action_items(
    payload: MeetingExtractRequest,
    current_user: User = Depends(require_roles("Admin", "Manager")),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.org_id == current_user.org_id, User.is_active == True)
        .all()
    )
    team_members = [u.name for u in users]
    draft_tasks = extract_tasks_from_notes(payload.notes, team_members)
    return MeetingExtractResponse(tasks=draft_tasks)


@app.post("/api/tasks/batch", response_model=List[TaskResponse])
async def create_tasks_batch(
    payload: BatchTaskCreateRequest,
    current_user: User = Depends(require_roles("Admin", "Manager")),
    db: Session = Depends(get_db),
):
    if not payload.tasks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tasks provided for batch creation",
        )

    org_users = (
        db.query(User)
        .filter(User.org_id == current_user.org_id, User.is_active == True)
        .all()
    )
    user_by_name = {u.name.lower(): u for u in org_users}
    user_by_first_name = {u.name.split()[0].lower(): u for u in org_users}

    default_project = (
        db.query(Project)
        .filter(Project.org_id == current_user.org_id, Project.status == "In Progress")
        .first()
    )
    if not default_project:
        default_project = db.query(Project).filter(Project.org_id == current_user.org_id).first()

    created_tasks: List[Task] = []

    for item in payload.tasks:
        assignee_id = None
        if item.assignee and item.assignee != "Unassigned":
            norm = item.assignee.strip().lower()
            matched_user = user_by_name.get(norm) or user_by_first_name.get(norm.split()[0])
            if matched_user:
                assignee_id = matched_user.id

        parsed_due = None
        if item.due_date:
            try:
                if len(item.due_date) == 10:
                    parsed_due = datetime.strptime(item.due_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                else:
                    parsed_due = datetime.fromisoformat(item.due_date.replace("Z", "+00:00"))
            except Exception:
                parsed_due = None

        target_project_id = item.project_id or (default_project.id if default_project else None)

        task = Task(
            org_id=current_user.org_id,
            project_id=target_project_id,
            assignee_id=assignee_id,
            title=item.title.strip(),
            description=item.description,
            status="Todo",
            priority=item.priority or "Medium",
            estimated_hours=float(item.est_hours or 4.0),
            due_date=parsed_due,
        )
        db.add(task)
        created_tasks.append(task)

    db.commit()

    for t in created_tasks:
        db.refresh(t)

    audit_log = AuditEvent(
        org_id=current_user.org_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action="TASKS_BATCH_CREATED",
        resource_type="task",
        resource_id=str(created_tasks[0].id) if created_tasks else "batch",
        details=f"Created {len(created_tasks)} tasks from meeting extraction.",
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)

    serialized_tasks = [serialize_task(t) for t in created_tasks]
    task_dicts = [t.model_dump(mode="json") for t in serialized_tasks]

    # Broadcast to org via WebSocket
    await manager.broadcast_to_org(current_user.org_id, {
        "type": "TASK_UPDATED",
        "payload": task_dicts,
    })
    await manager.broadcast_to_org(current_user.org_id, {
        "type": "AUDIT_EVENT",
        "payload": {
            "id": audit_log.id,
            "org_id": audit_log.org_id,
            "user_id": audit_log.user_id,
            "user_name": audit_log.user_name,
            "action": audit_log.action,
            "resource_type": audit_log.resource_type,
            "resource_id": audit_log.resource_id,
            "details": audit_log.details,
            "timestamp": audit_log.timestamp.isoformat() if audit_log.timestamp else datetime.now(timezone.utc).isoformat(),
        },
    })

    return serialized_tasks


@app.get("/api/tasks", response_model=List[TaskResponse])
def get_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tasks = (
        db.query(Task)
        .filter(Task.org_id == current_user.org_id)
        .order_by(Task.id.desc())
        .all()
    )
    return [serialize_task(t) for t in tasks]


@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    payload: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id, Task.org_id == current_user.org_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Permission check:
    # Employees can update their own tasks; Admin/Manager can update any.
    if current_user.role == "Employee" and task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees can only update tasks assigned to them",
        )

    details_parts = []

    if payload.status is not None:
        old_status = task.status
        task.status = payload.status
        details_parts.append(f"status from '{old_status}' to '{payload.status}'")

    if payload.assignee_id is not None:
        if current_user.role not in ["Admin", "Manager"] and payload.assignee_id != task.assignee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admins and Managers can reassign tasks",
            )
        target_user = db.query(User).filter(User.id == payload.assignee_id, User.org_id == current_user.org_id).first()
        if target_user or payload.assignee_id == 0:
            task.assignee_id = target_user.id if target_user else None
            details_parts.append(f"assignee to '{target_user.name if target_user else 'Unassigned'}'")
    elif payload.assignee_name is not None:
        if current_user.role not in ["Admin", "Manager"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admins and Managers can reassign tasks",
            )
        if payload.assignee_name == "Unassigned":
            task.assignee_id = None
            details_parts.append("assignee to 'Unassigned'")
        else:
            target_user = (
                db.query(User)
                .filter(User.org_id == current_user.org_id, User.name.ilike(f"%{payload.assignee_name}%"))
                .first()
            )
            if target_user:
                task.assignee_id = target_user.id
                details_parts.append(f"assignee to '{target_user.name}'")

    if payload.priority is not None:
        task.priority = payload.priority
        details_parts.append(f"priority to '{payload.priority}'")

    if payload.estimated_hours is not None:
        task.estimated_hours = float(payload.estimated_hours)
        details_parts.append(f"est hours to '{payload.estimated_hours}'")

    if payload.title is not None:
        task.title = payload.title.strip()

    if payload.due_date is not None:
        try:
            if payload.due_date:
                if len(payload.due_date) == 10:
                    task.due_date = datetime.strptime(payload.due_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                else:
                    task.due_date = datetime.fromisoformat(payload.due_date.replace("Z", "+00:00"))
            else:
                task.due_date = None
        except Exception:
            pass

    db.commit()
    db.refresh(task)

    change_desc = ", ".join(details_parts) if details_parts else "updated task details"
    audit_log = AuditEvent(
        org_id=current_user.org_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action="TASK_UPDATED",
        resource_type="task",
        resource_id=str(task.id),
        details=f"{current_user.name} ({current_user.role}) updated task #{task.id} '{task.title}': {change_desc}.",
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)

    resp = serialize_task(task)
    resp_dict = resp.model_dump(mode="json")

    # Broadcast to org via WebSocket
    await manager.broadcast_to_org(current_user.org_id, {
        "type": "TASK_UPDATED",
        "payload": resp_dict,
    })
    await manager.broadcast_to_org(current_user.org_id, {
        "type": "AUDIT_EVENT",
        "payload": {
            "id": audit_log.id,
            "org_id": audit_log.org_id,
            "user_id": audit_log.user_id,
            "user_name": audit_log.user_name,
            "action": audit_log.action,
            "resource_type": audit_log.resource_type,
            "resource_id": audit_log.resource_id,
            "details": audit_log.details,
            "timestamp": audit_log.timestamp.isoformat() if audit_log.timestamp else datetime.now(timezone.utc).isoformat(),
        },
    })

    return resp

