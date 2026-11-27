import os
import json
import shutil
import traceback
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    Query,
    WebSocket,
    WebSocketDisconnect,
    Request,
)
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from backend.config import ALLOWED_ORIGINS
from backend.database import SessionLocal, get_db, Base, engine
from backend.models import (
    User,
    Organization,
    Project,
    Task,
    AuditEvent,
    Document,
    CalendarEvent,
    LeaveBalance,
    LeaveRequest,
)
from backend.auth import verify_password, create_access_token, get_current_user, require_roles
from backend.rag_service import (
    ingest_pdf,
    ask_knowledge_base,
    get_indexed_documents_count,
    search_knowledge_chunks,
    get_document_pages_from_store,
    summarize_document,
)
from backend.create_demo_docs import create_hr_leave_policy, create_remote_work_policy
from backend.meeting_service import extract_tasks_from_notes, DraftTaskItem
from backend.email_service import compose_ai_message
from backend.seed import ensure_new_feature_defaults, DEFAULT_LEAVE_QUOTAS

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
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://smart-corp-ai.vercel.app",
    ],
    allow_origin_regex=r"(https?://(localhost|127\.0\.0\.1)(:\d+)?)|(https://.*\.vercel\.app)",
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


def _background_bootstrap():
    # 1. Ensure all database tables exist
    try:
        Base.metadata.create_all(bind=engine)
        print("Base.metadata.create_all executed successfully.")
    except Exception as ddl_err:
        print(f"Base.metadata.create_all notice: {ddl_err}")

    # 2. Automatically seed if database is empty
    try:
        db = SessionLocal()
        try:
            user_count = db.query(User).count()
        finally:
            db.close()

        if user_count == 0:
            print("Database empty: running seed_database()...")
            from backend.seed import seed_database
            seed_database()
        else:
            print(f"Database verified ({user_count} users present).")

        ensure_new_feature_defaults()
    except Exception as seed_err:
        print(f"Startup database seeding check error: {seed_err}")

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


@app.on_event("startup")
def on_startup():
    import threading
    threading.Thread(target=_background_bootstrap, daemon=True).start()


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


class RelatedDocumentItem(BaseModel):
    id: int
    title: str
    filename: str
    category: str


class KnowledgeAskResponse(BaseModel):
    answer: str
    citations: List[CitationItem]
    related_documents: List[RelatedDocumentItem] = []
    has_evidence: bool = True


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
    db: Session = Depends(get_db),
):
    # Runs ask_knowledge_base strictly scoped to current_user.org_id
    result = ask_knowledge_base(
        question=payload.question,
        org_id=current_user.org_id,
    )
    citations = [CitationItem(**c) for c in result["citations"]]
    cited_filenames = list({c.filename for c in citations})
    related_docs: List[RelatedDocumentItem] = []
    if cited_filenames:
        matching_docs = (
            db.query(Document)
            .filter(Document.org_id == current_user.org_id, Document.filename.in_(cited_filenames))
            .all()
        )
        for d in matching_docs:
            related_docs.append(
                RelatedDocumentItem(
                    id=d.id,
                    title=d.title,
                    filename=d.filename,
                    category=d.category,
                )
            )
    has_evidence = (
        len(citations) > 0
        and "Insufficient evidence in uploaded documents." not in result["answer"]
    )
    return KnowledgeAskResponse(
        answer=result["answer"],
        citations=citations,
        related_documents=related_docs,
        has_evidence=has_evidence,
    )


@app.get("/api/documents/search")
def search_documents_and_knowledge(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clean_q = q.strip()
    org_docs = (
        db.query(Document)
        .filter(Document.org_id == current_user.org_id)
        .all()
    )
    matched_docs = [
        {
            "id": d.id,
            "title": d.title,
            "filename": d.filename,
            "category": d.category,
            "chunk_count": d.chunk_count,
            "file_size": d.file_size,
            "created_at": d.created_at,
        }
        for d in org_docs
        if clean_q.lower() in d.title.lower()
        or clean_q.lower() in d.filename.lower()
        or clean_q.lower() in d.category.lower()
    ]
    chunk_matches = search_knowledge_chunks(query=clean_q, org_id=current_user.org_id, n_results=6)
    return {
        "query": clean_q,
        "documents": matched_docs,
        "chunks": chunk_matches,
    }


@app.get("/api/documents/{doc_id}")
def get_document_detail(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.org_id == current_user.org_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    uploader = db.query(User).filter(User.id == doc.uploaded_by).first() if doc.uploaded_by else None
    pages = get_document_pages_from_store(
        filename=doc.filename,
        org_id=current_user.org_id,
        file_path=doc.file_path,
    )
    has_pdf_file = bool(doc.file_path and os.path.exists(doc.file_path))

    related_docs = (
        db.query(Document)
        .filter(
            Document.org_id == current_user.org_id,
            Document.id != doc.id,
        )
        .order_by(Document.created_at.desc())
        .limit(4)
        .all()
    )

    return {
        "id": doc.id,
        "org_id": doc.org_id,
        "title": doc.title,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "category": doc.category,
        "chunk_count": doc.chunk_count,
        "created_at": doc.created_at,
        "uploader_name": uploader.name if uploader else "System / HR",
        "has_pdf_file": has_pdf_file,
        "pages": pages,
        "related_documents": [
            {"id": r.id, "title": r.title, "filename": r.filename, "category": r.category}
            for r in related_docs
        ],
    }


@app.post("/api/documents/{doc_id}/summarize")
def summarize_org_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.org_id == current_user.org_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    summary = summarize_document(
        filename=doc.filename,
        title=doc.title,
        org_id=current_user.org_id,
        file_path=doc.file_path,
    )
    return {
        "document_id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "summary": summary,
    }


@app.get("/api/documents/{doc_id}/download")
def download_org_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.org_id == current_user.org_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original PDF binary is not on disk; view indexed pages in Company Brain.",
        )
    return FileResponse(
        path=doc.file_path,
        media_type="application/pdf",
        filename=doc.filename,
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


async def _record_audit_and_broadcast(
    db: Session,
    user: User,
    action: str,
    resource_type: str,
    resource_id: str,
    details: str,
    ws_event_type: Optional[str] = None,
    ws_payload: Optional[Any] = None,
):
    """Persist an org-scoped audit event and broadcast optional domain & audit events over WebSocket."""
    audit_log = AuditEvent(
        org_id=user.org_id,
        user_id=user.id,
        user_name=user.name,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)

    if ws_event_type:
        await manager.broadcast_to_org(
            user.org_id,
            {"type": ws_event_type, "payload": ws_payload or {}},
        )

    await manager.broadcast_to_org(
        user.org_id,
        {
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
                "timestamp": audit_log.timestamp.isoformat()
                if audit_log.timestamp
                else datetime.now(timezone.utc).isoformat(),
            },
        },
    )


# =============================================================================
# Phase 5: Team Directory
# =============================================================================
@app.get("/api/team")
def get_team_directory(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.org_id == current_user.org_id, User.is_active == True)
        .order_by(User.name.asc())
        .all()
    )
    res = []
    for u in users:
        active_hours = (
            db.query(func.coalesce(func.sum(Task.estimated_hours), 0.0))
            .filter(
                Task.org_id == current_user.org_id,
                Task.assignee_id == u.id,
                Task.status != "Done",
            )
            .scalar()
        )
        open_tasks = (
            db.query(func.count(Task.id))
            .filter(
                Task.org_id == current_user.org_id,
                Task.assignee_id == u.id,
                Task.status != "Done",
            )
            .scalar()
        )
        res.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "department": u.department or "Operations",
            "est_hours": round(float(active_hours or 0.0), 1),
            "open_tasks": int(open_tasks or 0),
        })
    return res


# =============================================================================
# Phase 6: AI Email & Message Writer
# =============================================================================
class EmailWriterRequest(BaseModel):
    description: str = Field(..., min_length=3, max_length=4000)
    message_type: str = "Professional email"
    tone: str = "Professional"
    recipient: Optional[str] = None
    subject: Optional[str] = None
    important_points: Optional[str] = None
    action: str = "generate"  # generate, rewrite, shorten, improve, regenerate
    current_draft: Optional[str] = None


class EmailWriterResponse(BaseModel):
    subject: str
    body: str
    message_type: str
    tone: str
    action: str


@app.post("/api/ai/email-writer", response_model=EmailWriterResponse)
async def generate_email_message(
    payload: EmailWriterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    org_name = org.name if org else "SmartCorp"

    result = compose_ai_message(
        description=payload.description,
        message_type=payload.message_type,
        tone=payload.tone,
        recipient=payload.recipient,
        subject=payload.subject,
        important_points=payload.important_points,
        action=payload.action,
        current_draft=payload.current_draft,
        sender_name=current_user.name,
        sender_role=current_user.role,
        org_name=org_name,
    )

    try:
        await _record_audit_and_broadcast(
            db=db,
            user=current_user,
            action="EMAIL_DRAFT_GENERATED",
            resource_type="ai_writer",
            resource_id=payload.action,
            details=f"{current_user.name} ran AI Email Writer ({payload.action}: {payload.message_type}, tone={payload.tone}).",
        )
    except Exception as audit_err:
        db.rollback()
        print(f"Email writer audit warning: {audit_err}")

    return EmailWriterResponse(
        subject=result["subject"],
        body=result["body"],
        message_type=payload.message_type,
        tone=payload.tone,
        action=payload.action,
    )


# =============================================================================
# Phase 7: Smart Calendar (Events + Integrated Task Deadlines + Approved Leaves)
# =============================================================================
VALID_EVENT_CATEGORIES = {"meeting", "deadline", "review", "company", "focus"}


class CalendarEventCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str = "meeting"
    start_time: datetime
    end_time: datetime
    all_day: bool = False
    location: Optional[str] = None
    attendees: List[str] = []


class CalendarEventUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    attendees: Optional[List[str]] = None


def _parse_attendees(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return [str(x) for x in data] if isinstance(data, list) else []
    except Exception:
        return []


def _serialize_calendar_event(ev: CalendarEvent, creator_name: Optional[str] = None) -> Dict[str, Any]:
    return {
        "id": f"event-{ev.id}",
        "source": "event",
        "source_id": ev.id,
        "org_id": ev.org_id,
        "title": ev.title,
        "description": ev.description,
        "category": ev.category,
        "start_time": ev.start_time.isoformat() if ev.start_time else None,
        "end_time": ev.end_time.isoformat() if ev.end_time else None,
        "all_day": ev.all_day,
        "location": ev.location,
        "attendees": _parse_attendees(ev.attendees),
        "created_by": ev.created_by,
        "creator_name": creator_name or (ev.creator.name if ev.creator else "System"),
        "editable": True,
    }


@app.get("/api/calendar/events")
def list_calendar_items(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    category: Optional[str] = Query(None),
    include_tasks: bool = Query(True),
    include_leaves: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items: List[Dict[str, Any]] = []

    # 1. Native Calendar Events (strictly org_id scoped)
    ev_query = db.query(CalendarEvent).filter(CalendarEvent.org_id == current_user.org_id)
    if start:
        ev_query = ev_query.filter(CalendarEvent.end_time >= start)
    if end:
        ev_query = ev_query.filter(CalendarEvent.start_time <= end)
    if category and category != "all":
        ev_query = ev_query.filter(CalendarEvent.category == category)

    for ev in ev_query.order_by(CalendarEvent.start_time.asc()).all():
        serialized = _serialize_calendar_event(ev)
        serialized["editable"] = (
            current_user.role in ("Admin", "Manager") or ev.created_by == current_user.id
        )
        items.append(serialized)

    # 2. Integrated Task Deadlines (strictly org_id scoped)
    if include_tasks and (not category or category in ("all", "deadline")):
        task_query = db.query(Task).filter(
            Task.org_id == current_user.org_id,
            Task.due_date.isnot(None),
        )
        if start:
            task_query = task_query.filter(Task.due_date >= start)
        if end:
            task_query = task_query.filter(Task.due_date <= end)

        for t in task_query.all():
            due_dt = t.due_date
            if due_dt.tzinfo is None:
                due_dt = due_dt.replace(tzinfo=timezone.utc)
            end_dt = due_dt + timedelta(hours=1)
            assignee_name = t.assignee.name if t.assignee else "Unassigned"
            items.append({
                "id": f"task-{t.id}",
                "source": "task",
                "source_id": t.id,
                "org_id": t.org_id,
                "title": f"Deadline: {t.title}",
                "description": t.description or f"Project: {t.project.name if t.project else 'General'} | Status: {t.status} | Priority: {t.priority}",
                "category": "deadline",
                "start_time": due_dt.isoformat(),
                "end_time": end_dt.isoformat(),
                "all_day": True,
                "location": t.project.name if t.project else "Task Board",
                "attendees": [assignee_name] if assignee_name != "Unassigned" else [],
                "created_by": None,
                "creator_name": assignee_name,
                "editable": False,
                "task_status": t.status,
                "task_priority": t.priority,
            })

    # 3. Approved Leave Requests (strictly org_id scoped)
    if include_leaves and (not category or category in ("all", "leave")):
        leave_query = db.query(LeaveRequest).filter(
            LeaveRequest.org_id == current_user.org_id,
            LeaveRequest.status == "Approved",
        )
        if start:
            leave_query = leave_query.filter(LeaveRequest.end_date >= start.date())
        if end:
            leave_query = leave_query.filter(LeaveRequest.start_date <= end.date())

        for lv in leave_query.all():
            emp_name = lv.employee.name if lv.employee else "Team Member"
            lv_start = datetime.combine(lv.start_date, datetime.min.time(), tzinfo=timezone.utc)
            lv_end = datetime.combine(lv.end_date, datetime.max.time().replace(microsecond=0), tzinfo=timezone.utc)
            items.append({
                "id": f"leave-{lv.id}",
                "source": "leave",
                "source_id": lv.id,
                "org_id": lv.org_id,
                "title": f"{emp_name} — {lv.leave_type}",
                "description": lv.reason,
                "category": "leave",
                "start_time": lv_start.isoformat(),
                "end_time": lv_end.isoformat(),
                "all_day": True,
                "location": "Out of Office",
                "attendees": [emp_name],
                "created_by": lv.user_id,
                "creator_name": emp_name,
                "editable": False,
            })

    items.sort(key=lambda x: x["start_time"] or "")
    return items


@app.post("/api/calendar/events", status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    payload: CalendarEventCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start_dt = payload.start_time if payload.start_time.tzinfo else payload.start_time.replace(tzinfo=timezone.utc)
    end_dt = payload.end_time if payload.end_time.tzinfo else payload.end_time.replace(tzinfo=timezone.utc)

    if end_dt < start_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event end time must be after or equal to start time.",
        )

    cat = payload.category.lower() if payload.category.lower() in VALID_EVENT_CATEGORIES else "meeting"
    ev = CalendarEvent(
        org_id=current_user.org_id,
        created_by=current_user.id,
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        category=cat,
        start_time=start_dt,
        end_time=end_dt,
        all_day=payload.all_day,
        location=(payload.location or "").strip() or None,
        attendees=json.dumps([a.strip() for a in payload.attendees if a.strip()]),
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)

    serialized = _serialize_calendar_event(ev, creator_name=current_user.name)
    await _record_audit_and_broadcast(
        db=db,
        user=current_user,
        action="CALENDAR_EVENT_CREATED",
        resource_type="calendar",
        resource_id=str(ev.id),
        details=f"{current_user.name} scheduled '{ev.title}' ({cat}) for {start_dt.strftime('%Y-%m-%d %H:%M UTC')}.",
        ws_event_type="CALENDAR_UPDATED",
        ws_payload=serialized,
    )
    return serialized


@app.patch("/api/calendar/events/{event_id}")
async def update_calendar_event(
    event_id: int,
    payload: CalendarEventUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.id == event_id, CalendarEvent.org_id == current_user.org_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    if current_user.role not in ("Admin", "Manager") and ev.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this calendar event.",
        )

    new_start = payload.start_time or ev.start_time
    new_end = payload.end_time or ev.end_time
    if new_start.tzinfo is None:
        new_start = new_start.replace(tzinfo=timezone.utc)
    if new_end.tzinfo is None:
        new_end = new_end.replace(tzinfo=timezone.utc)

    if new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event end time must be after or equal to start time.",
        )

    if payload.title is not None:
        ev.title = payload.title.strip()
    if payload.description is not None:
        ev.description = payload.description.strip() or None
    if payload.category is not None and payload.category.lower() in VALID_EVENT_CATEGORIES:
        ev.category = payload.category.lower()
    if payload.start_time is not None:
        ev.start_time = new_start
    if payload.end_time is not None:
        ev.end_time = new_end
    if payload.all_day is not None:
        ev.all_day = payload.all_day
    if payload.location is not None:
        ev.location = payload.location.strip() or None
    if payload.attendees is not None:
        ev.attendees = json.dumps([a.strip() for a in payload.attendees if a.strip()])

    db.commit()
    db.refresh(ev)

    serialized = _serialize_calendar_event(ev)
    await _record_audit_and_broadcast(
        db=db,
        user=current_user,
        action="CALENDAR_EVENT_UPDATED",
        resource_type="calendar",
        resource_id=str(ev.id),
        details=f"{current_user.name} updated calendar event '{ev.title}'.",
        ws_event_type="CALENDAR_UPDATED",
        ws_payload=serialized,
    )
    return serialized


@app.delete("/api/calendar/events/{event_id}")
async def delete_calendar_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.id == event_id, CalendarEvent.org_id == current_user.org_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    if current_user.role not in ("Admin", "Manager") and ev.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this calendar event.",
        )

    ev_title = ev.title
    db.delete(ev)
    db.commit()

    await _record_audit_and_broadcast(
        db=db,
        user=current_user,
        action="CALENDAR_EVENT_DELETED",
        resource_type="calendar",
        resource_id=str(event_id),
        details=f"{current_user.name} deleted calendar event '{ev_title}'.",
        ws_event_type="CALENDAR_UPDATED",
        ws_payload={"deleted_id": f"event-{event_id}"},
    )
    return {"deleted": True, "id": event_id}


# =============================================================================
# Phase 8: Leave Management System
# =============================================================================
VALID_LEAVE_TYPES = {"Casual Leave", "Sick Leave", "Earned Leave", "Unpaid Leave"}


class LeaveCreateRequest(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: str = Field(..., min_length=3, max_length=1500)


class LeaveApproveRequest(BaseModel):
    review_note: Optional[str] = None


class LeaveRejectRequest(BaseModel):
    reason: str = Field(..., min_length=2, max_length=1000)


class LeaveBalanceUpdateRequest(BaseModel):
    user_id: int
    leave_type: str
    total_days: float = Field(..., ge=0, le=365)
    year: Optional[int] = None


def _ensure_user_leave_balances(db: Session, user: User, year: int) -> List[LeaveBalance]:
    existing = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.org_id == user.org_id,
            LeaveBalance.user_id == user.id,
            LeaveBalance.year == year,
        )
        .all()
    )
    if not existing:
        for lt, quota in DEFAULT_LEAVE_QUOTAS.items():
            bal = LeaveBalance(
                org_id=user.org_id,
                user_id=user.id,
                leave_type=lt,
                year=year,
                total_days=quota,
                used_days=0.0,
            )
            db.add(bal)
        db.commit()
        existing = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.org_id == user.org_id,
                LeaveBalance.user_id == user.id,
                LeaveBalance.year == year,
            )
            .all()
        )
    return existing


def _calculate_working_days(start_d: date, end_d: date) -> float:
    if end_d < start_d:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date.",
        )
    if (end_d - start_d).days > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Single leave request cannot exceed 90 calendar days.",
        )
    cur = start_d
    working = 0
    while cur <= end_d:
        if cur.weekday() < 5:  # Mon-Fri
            working += 1
        cur += timedelta(days=1)
    if working == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected date range contains no working days (Monday–Friday).",
        )
    return float(working)


def _serialize_leave_request(lv: LeaveRequest) -> Dict[str, Any]:
    emp = lv.employee
    rev = lv.reviewer
    return {
        "id": lv.id,
        "org_id": lv.org_id,
        "user_id": lv.user_id,
        "employee_name": emp.name if emp else "Unknown",
        "employee_email": emp.email if emp else None,
        "employee_role": emp.role if emp else None,
        "department": (emp.department or "Operations") if emp else "Operations",
        "leave_type": lv.leave_type,
        "start_date": lv.start_date.isoformat(),
        "end_date": lv.end_date.isoformat(),
        "days_count": float(lv.days_count),
        "reason": lv.reason,
        "status": lv.status,
        "reviewed_by": lv.reviewed_by,
        "reviewer_name": rev.name if rev else None,
        "review_note": lv.review_note,
        "reviewed_at": lv.reviewed_at.isoformat() if lv.reviewed_at else None,
        "created_at": lv.created_at.isoformat() if lv.created_at else None,
    }


@app.get("/api/leaves/summary")
def get_leave_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    year = datetime.now(timezone.utc).year
    balances = _ensure_user_leave_balances(db, current_user, year)

    my_pending = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.org_id == current_user.org_id,
            LeaveRequest.user_id == current_user.id,
            LeaveRequest.status == "Pending",
        )
        .count()
    )
    my_approved = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.org_id == current_user.org_id,
            LeaveRequest.user_id == current_user.id,
            LeaveRequest.status == "Approved",
        )
        .count()
    )
    my_rejected = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.org_id == current_user.org_id,
            LeaveRequest.user_id == current_user.id,
            LeaveRequest.status == "Rejected",
        )
        .count()
    )

    is_approver = current_user.role in ("Admin", "Manager", "HR")
    org_pending = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.org_id == current_user.org_id, LeaveRequest.status == "Pending")
        .count()
        if is_approver
        else my_pending
    )
    org_approved = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.org_id == current_user.org_id, LeaveRequest.status == "Approved")
        .count()
        if is_approver
        else my_approved
    )
    org_rejected = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.org_id == current_user.org_id, LeaveRequest.status == "Rejected")
        .count()
        if is_approver
        else my_rejected
    )

    return {
        "year": year,
        "my_counts": {
            "pending": my_pending,
            "approved": my_approved,
            "rejected": my_rejected,
        },
        "org_counts": {
            "pending": org_pending,
            "approved": org_approved,
            "rejected": org_rejected,
        },
        "balances": [
            {
                "id": b.id,
                "user_id": b.user_id,
                "leave_type": b.leave_type,
                "year": b.year,
                "total_days": float(b.total_days),
                "used_days": float(b.used_days),
                "remaining_days": round(max(0.0, float(b.total_days) - float(b.used_days)), 1),
            }
            for b in balances
        ],
    }


@app.get("/api/leaves/balances")
def get_leave_balances(
    user_id: Optional[int] = Query(None),
    all_users: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    year = datetime.now(timezone.utc).year
    is_approver = current_user.role in ("Admin", "Manager", "HR")

    if all_users:
        if not is_approver:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admin, Manager, or HR can view all team leave balances.",
            )
        org_users = (
            db.query(User)
            .filter(User.org_id == current_user.org_id, User.is_active == True)
            .order_by(User.name.asc())
            .all()
        )
        out = []
        for u in org_users:
            bals = _ensure_user_leave_balances(db, u, year)
            for b in bals:
                out.append({
                    "id": b.id,
                    "user_id": u.id,
                    "user_name": u.name,
                    "department": u.department or "Operations",
                    "role": u.role,
                    "leave_type": b.leave_type,
                    "year": b.year,
                    "total_days": float(b.total_days),
                    "used_days": float(b.used_days),
                    "remaining_days": round(max(0.0, float(b.total_days) - float(b.used_days)), 1),
                })
        return out

    target_uid = user_id or current_user.id
    if target_uid != current_user.id and not is_approver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees can only view their own leave balances.",
        )

    target_user = (
        db.query(User)
        .filter(User.id == target_uid, User.org_id == current_user.org_id)
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    bals = _ensure_user_leave_balances(db, target_user, year)
    return [
        {
            "id": b.id,
            "user_id": target_user.id,
            "user_name": target_user.name,
            "department": target_user.department or "Operations",
            "role": target_user.role,
            "leave_type": b.leave_type,
            "year": b.year,
            "total_days": float(b.total_days),
            "used_days": float(b.used_days),
            "remaining_days": round(max(0.0, float(b.total_days) - float(b.used_days)), 1),
        }
        for b in bals
    ]


@app.put("/api/leaves/balances")
async def update_leave_balance(
    payload: LeaveBalanceUpdateRequest,
    current_user: User = Depends(require_roles("Admin", "HR")),
    db: Session = Depends(get_db),
):
    if payload.leave_type not in DEFAULT_LEAVE_QUOTAS and payload.leave_type not in VALID_LEAVE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported leave type: {payload.leave_type}",
        )

    target_user = (
        db.query(User)
        .filter(User.id == payload.user_id, User.org_id == current_user.org_id)
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found in organization")

    year = payload.year or datetime.now(timezone.utc).year
    _ensure_user_leave_balances(db, target_user, year)

    bal = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.org_id == current_user.org_id,
            LeaveBalance.user_id == target_user.id,
            LeaveBalance.leave_type == payload.leave_type,
            LeaveBalance.year == year,
        )
        .first()
    )
    if not bal:
        bal = LeaveBalance(
            org_id=current_user.org_id,
            user_id=target_user.id,
            leave_type=payload.leave_type,
            year=year,
            total_days=payload.total_days,
            used_days=0.0,
        )
        db.add(bal)
    else:
        if payload.total_days < bal.used_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total days ({payload.total_days}) cannot be less than already used days ({bal.used_days}).",
            )
        bal.total_days = float(payload.total_days)

    db.commit()
    db.refresh(bal)

    await _record_audit_and_broadcast(
        db=db,
        user=current_user,
        action="LEAVE_BALANCE_UPDATED",
        resource_type="leave_balance",
        resource_id=str(bal.id),
        details=f"{current_user.name} set {target_user.name}'s {bal.leave_type} ({year}) quota to {bal.total_days} days.",
        ws_event_type="LEAVE_UPDATED",
        ws_payload={"user_id": target_user.id},
    )

    return {
        "id": bal.id,
        "user_id": target_user.id,
        "leave_type": bal.leave_type,
        "year": bal.year,
        "total_days": float(bal.total_days),
        "used_days": float(bal.used_days),
        "remaining_days": round(max(0.0, float(bal.total_days) - float(bal.used_days)), 1),
    }


@app.get("/api/leaves")
def list_leave_requests(
    scope: str = Query("mine"),  # mine | team
    status_filter: Optional[str] = Query(None, alias="status"),
    employee_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_approver = current_user.role in ("Admin", "Manager", "HR")
    query = db.query(LeaveRequest).filter(LeaveRequest.org_id == current_user.org_id)

    if scope == "mine" or not is_approver:
        query = query.filter(LeaveRequest.user_id == current_user.id)
    elif employee_id:
        query = query.filter(LeaveRequest.user_id == employee_id)

    if status_filter and status_filter != "All":
        query = query.filter(LeaveRequest.status == status_filter)
    if start_date:
        query = query.filter(LeaveRequest.end_date >= start_date)
    if end_date:
        query = query.filter(LeaveRequest.start_date <= end_date)

    leaves = query.order_by(LeaveRequest.created_at.desc()).all()
    if department and department != "All":
        leaves = [
            lv for lv in leaves
            if ((lv.employee.department or "Operations") if lv.employee else "Operations") == department
        ]

    return [_serialize_leave_request(lv) for lv in leaves]


@app.get("/api/leaves/team-calendar")
def get_team_leave_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_approver = current_user.role in ("Admin", "Manager", "HR")
    allowed_statuses = ["Approved", "Pending"] if is_approver else ["Approved"]
    leaves = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.org_id == current_user.org_id,
            LeaveRequest.status.in_(allowed_statuses),
        )
        .order_by(LeaveRequest.start_date.asc())
        .all()
    )
    return [_serialize_leave_request(lv) for lv in leaves]


@app.post("/api/leaves", status_code=status.HTTP_201_CREATED)
async def apply_for_leave(
    payload: LeaveCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.leave_type not in VALID_LEAVE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid leave type. Choose one of: {', '.join(sorted(VALID_LEAVE_TYPES))}",
        )

    days_count = _calculate_working_days(payload.start_date, payload.end_date)

    # Prevent duplicate or overlapping Pending/Approved requests
    overlapping = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.org_id == current_user.org_id,
            LeaveRequest.user_id == current_user.id,
            LeaveRequest.status.in_(["Pending", "Approved"]),
            LeaveRequest.start_date <= payload.end_date,
            LeaveRequest.end_date >= payload.start_date,
        )
        .first()
    )
    if overlapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Overlapping {overlapping.status.lower()} leave request exists ({overlapping.start_date} to {overlapping.end_date}).",
        )

    # Check leave balance for paid leave types
    if payload.leave_type != "Unpaid Leave":
        year = payload.start_date.year
        balances = _ensure_user_leave_balances(db, current_user, year)
        bal = next((b for b in balances if b.leave_type == payload.leave_type), None)
        available = (float(bal.total_days) - float(bal.used_days)) if bal else 0.0
        if days_count > available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient {payload.leave_type} balance: requested {days_count}d, available {available}d.",
            )

    lv = LeaveRequest(
        org_id=current_user.org_id,
        user_id=current_user.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days_count=days_count,
        reason=payload.reason.strip(),
        status="Pending",
    )
    db.add(lv)
    db.commit()
    db.refresh(lv)

    serialized = _serialize_leave_request(lv)
    await _record_audit_and_broadcast(
        db=db,
        user=current_user,
        action="LEAVE_REQUESTED",
        resource_type="leave",
        resource_id=str(lv.id),
        details=f"{current_user.name} applied for {lv.leave_type} ({lv.start_date} to {lv.end_date}, {lv.days_count} working days).",
        ws_event_type="LEAVE_UPDATED",
        ws_payload=serialized,
    )
    return serialized


@app.post("/api/leaves/{leave_id}/approve")
async def approve_leave_request(
    leave_id: int,
    payload: LeaveApproveRequest = LeaveApproveRequest(),
    current_user: User = Depends(require_roles("Admin", "Manager", "HR")),
    db: Session = Depends(get_db),
):
    lv = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.id == leave_id, LeaveRequest.org_id == current_user.org_id)
        .first()
    )
    if not lv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if lv.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-approval is prohibited. Another Manager, HR, or Admin must review your request.",
        )

    if lv.status != "Pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending leave requests can be approved (current status: {lv.status}).",
        )

    # Deduct leave balance only upon approval
    if lv.leave_type != "Unpaid Leave":
        emp = db.query(User).filter(User.id == lv.user_id, User.org_id == current_user.org_id).first()
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        balances = _ensure_user_leave_balances(db, emp, lv.start_date.year)
        bal = next((b for b in balances if b.leave_type == lv.leave_type), None)
        available = (float(bal.total_days) - float(bal.used_days)) if bal else 0.0
        if lv.days_count > available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve: employee only has {available}d remaining in {lv.leave_type}.",
            )
        bal.used_days = round(float(bal.used_days) + float(lv.days_count), 1)

    lv.status = "Approved"
    lv.reviewed_by = current_user.id
    lv.review_note = (payload.review_note or "").strip() or "Approved"
    lv.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lv)

    serialized = _serialize_leave_request(lv)
    await _record_audit_and_broadcast(
        db=db,
        user=current_user,
        action="LEAVE_APPROVED",
        resource_type="leave",
        resource_id=str(lv.id),
        details=f"{current_user.name} ({current_user.role}) approved {serialized['employee_name']}'s {lv.leave_type} ({lv.start_date} to {lv.end_date}, {lv.days_count}d).",
        ws_event_type="LEAVE_UPDATED",
        ws_payload=serialized,
    )
    return serialized


@app.post("/api/leaves/{leave_id}/reject")
async def reject_leave_request(
    leave_id: int,
    payload: LeaveRejectRequest,
    current_user: User = Depends(require_roles("Admin", "Manager", "HR")),
    db: Session = Depends(get_db),
):
    lv = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.id == leave_id, LeaveRequest.org_id == current_user.org_id)
        .first()
    )
    if not lv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if lv.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot reject your own leave request.",
        )

    if lv.status != "Pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending leave requests can be rejected (current status: {lv.status}).",
        )

    lv.status = "Rejected"
    lv.reviewed_by = current_user.id
    lv.review_note = payload.reason.strip()
    lv.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lv)

    serialized = _serialize_leave_request(lv)
    await _record_audit_and_broadcast(
        db=db,
        user=current_user,
        action="LEAVE_REJECTED",
        resource_type="leave",
        resource_id=str(lv.id),
        details=f"{current_user.name} ({current_user.role}) rejected {serialized['employee_name']}'s {lv.leave_type}: {lv.review_note}",
        ws_event_type="LEAVE_UPDATED",
        ws_payload=serialized,
    )
    return serialized


@app.post("/api/leaves/{leave_id}/cancel")
async def cancel_leave_request(
    leave_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lv = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.id == leave_id, LeaveRequest.org_id == current_user.org_id)
        .first()
    )
    if not lv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if lv.user_id != current_user.id and current_user.role not in ("Admin", "HR"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own pending leave requests.",
        )

    if lv.status != "Pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending leave requests can be cancelled (current status: {lv.status}).",
        )

    lv.status = "Cancelled"
    lv.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lv)

    serialized = _serialize_leave_request(lv)
    await _record_audit_and_broadcast(
        db=db,
        user=current_user,
        action="LEAVE_CANCELLED",
        resource_type="leave",
        resource_id=str(lv.id),
        details=f"{current_user.name} cancelled pending {lv.leave_type} request ({lv.start_date} to {lv.end_date}).",
        ws_event_type="LEAVE_UPDATED",
        ws_payload=serialized,
    )
    return serialized

