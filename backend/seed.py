import sys
import os
from datetime import datetime, timedelta, timezone

# Ensure parent directory is in sys.path so backend imports work directly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import engine, SessionLocal, Base
from backend.models import (
    Organization,
    User,
    Project,
    Task,
    Document,
    AuditEvent,
    CalendarEvent,
    LeaveBalance,
    LeaveRequest,
)
from backend.auth import get_password_hash, hash_password

DEFAULT_LEAVE_QUOTAS = {
    "Casual Leave": 12.0,
    "Sick Leave": 10.0,
    "Earned Leave": 15.0,
}


def ensure_new_feature_defaults(db=None):
    """
    Non-destructively initialize initial LeaveBalance quotas (for users who have none)
    and starter CalendarEvent records (for orgs with 0 calendar events).
    Safe to run on every startup without overwriting production data.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        current_year = datetime.now(timezone.utc).year
        now = datetime.now(timezone.utc)
        orgs = db.query(Organization).all()

        for org in orgs:
            users = db.query(User).filter(User.org_id == org.id, User.is_active == True).all()
            for u in users:
                existing_bal = (
                    db.query(LeaveBalance)
                    .filter(
                        LeaveBalance.org_id == org.id,
                        LeaveBalance.user_id == u.id,
                        LeaveBalance.year == current_year,
                    )
                    .count()
                )
                if existing_bal == 0:
                    for leave_type, quota in DEFAULT_LEAVE_QUOTAS.items():
                        db.add(
                            LeaveBalance(
                                org_id=org.id,
                                user_id=u.id,
                                leave_type=leave_type,
                                year=current_year,
                                total_days=quota,
                                used_days=0.0,
                            )
                        )

            existing_cal = db.query(CalendarEvent).filter(CalendarEvent.org_id == org.id).count()
            if existing_cal == 0 and users:
                lead = next((u for u in users if u.role in ("Admin", "Manager")), users[0])
                today_start = now.replace(hour=10, minute=0, second=0, microsecond=0)
                starter_events = [
                    CalendarEvent(
                        org_id=org.id,
                        created_by=lead.id,
                        title=f"{org.name} Weekly Operations Sync",
                        description="Cross-functional delivery alignment, blocker triage, and sprint velocity review.",
                        category="meeting",
                        start_time=today_start + timedelta(days=1),
                        end_time=today_start + timedelta(days=1, hours=1),
                        all_day=False,
                        location="Executive War Room / Meet",
                        attendees=f'["{lead.name}"]',
                    ),
                    CalendarEvent(
                        org_id=org.id,
                        created_by=lead.id,
                        title="Security & Compliance Checkpoint",
                        description="Quarterly policy verification and access governance audit.",
                        category="review",
                        start_time=today_start + timedelta(days=3, hours=4),
                        end_time=today_start + timedelta(days=3, hours=5),
                        all_day=False,
                        location="Governance Channel",
                        attendees=f'["{lead.name}"]',
                    ),
                    CalendarEvent(
                        org_id=org.id,
                        created_by=lead.id,
                        title="All-Hands Product & People Townhall",
                        description="Company-wide roadmap milestones and People Ops updates.",
                        category="company",
                        start_time=today_start + timedelta(days=6, hours=1),
                        end_time=today_start + timedelta(days=6, hours=2, minutes=30),
                        all_day=False,
                        location="Main Auditorium / Livestream",
                        attendees="[]",
                    ),
                ]
                db.add_all(starter_events)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"ensure_new_feature_defaults warning: {e}")
    finally:
        if own_session:
            db.close()


def seed_database():
    print("Seeding database in Neon PostgreSQL...")
    db = SessionLocal()
    default_password = "password123"
    hashed_pwd = get_password_hash(default_password)
    now = datetime.now(timezone.utc)

    try:
        # -------------------------------------------------------------
        # Organization 1: Acme Corp
        # -------------------------------------------------------------
        acme_org = db.query(Organization).filter(Organization.slug == "acme-corp").first()
        if not acme_org:
            acme_org = Organization(name="Acme Corp", slug="acme-corp")
            db.add(acme_org)
            db.commit()
            db.refresh(acme_org)
            print(f"Created organization: {acme_org.name} (id={acme_org.id})")
        else:
            print(f"Found existing organization: {acme_org.name} (id={acme_org.id})")

        # Clean up any legacy demo users for Acme Corp if present
        legacy_demo_emails = [
            "admin@acmecorp.com",
            "manager@acmecorp.com",
            "hr@acmecorp.com",
            "employee@acmecorp.com",
        ]
        legacy_users = db.query(User).filter(User.org_id == acme_org.id, User.email.in_(legacy_demo_emails)).all()
        if legacy_users:
            print(f"Removing {len(legacy_users)} legacy demo users and refreshing Acme Corp demo data...")
            db.query(Task).filter(Task.org_id == acme_org.id).delete()
            db.query(AuditEvent).filter(AuditEvent.org_id == acme_org.id).delete()
            for lu in legacy_users:
                db.delete(lu)
            db.commit()

        # Acme Users: Anush, Sidharth, Nicholas, Hitesh
        acme_users_data = [
            {"email": "anush@acmecorp.com", "name": "Anush", "role": "Admin", "department": "Executive"},
            {"email": "sidharth@acmecorp.com", "name": "Sidharth", "role": "HR", "department": "People Ops"},
            {"email": "nicholas@acmecorp.com", "name": "Nicholas", "role": "Manager", "department": "Product"},
            {"email": "hitesh@acmecorp.com", "name": "Hitesh", "role": "Employee", "department": "Engineering"},
        ]

        acme_users = {}
        for u_data in acme_users_data:
            user = db.query(User).filter(User.email == u_data["email"]).first()
            if not user:
                user = User(
                    org_id=acme_org.id,
                    email=u_data["email"],
                    name=u_data["name"],
                    role=u_data["role"],
                    department=u_data["department"],
                    hashed_password=hashed_pwd,
                    is_active=True,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"  Created user: {user.name} ({user.role}) <{user.email}>")
            else:
                user.org_id = acme_org.id
                user.name = u_data["name"]
                user.role = u_data["role"]
                user.department = u_data["department"]
                user.password_hash = hash_password("password123")
                user.hashed_password = user.password_hash
                user.is_active = True
                db.commit()
                db.refresh(user)
                print(f"  Updated existing user: {user.name} ({user.role})")
            acme_users[user.email] = user

        # Acme Projects
        acme_projects_data = [
            {"name": "Enterprise Migration v2", "description": "Migrate core microservices and auth infrastructure.", "status": "In Progress"},
            {"name": "SOC-2 Type II Compliance", "description": "Preparation and evidence collection for annual audit.", "status": "In Progress"},
        ]
        acme_projects = {}
        for p_data in acme_projects_data:
            proj = db.query(Project).filter(Project.org_id == acme_org.id, Project.name == p_data["name"]).first()
            if not proj:
                proj = Project(
                    org_id=acme_org.id,
                    name=p_data["name"],
                    description=p_data["description"],
                    status=p_data["status"],
                )
                db.add(proj)
                db.commit()
                db.refresh(proj)
                print(f"  Created project: {proj.name}")
            else:
                proj.status = p_data["status"]
                proj.description = p_data["description"]
                db.commit()
                db.refresh(proj)
            acme_projects[proj.name] = proj

        # Acme Tasks:
        # Hitesh (Employee): 38.0h non-completed (12 + 14 + 6 + 6) -> OVERLOADED (>= 36h threshold), 1 Overdue task
        # Nicholas (Manager): 12.0h non-completed (8 + 4) -> UNDER-UTILIZED (~12h, recipient for simulation)
        # Anush (Admin): 22.0h non-completed (16 + 6) -> Pending Approval review gate
        # Sidharth (HR): 8.0h non-completed (8) -> Todo
        # Completed tasks: 3
        # Overdue tasks: 1 (Hitesh CVE task, due yesterday)
        # Pending approvals: 2
        acme_tasks_data = [
            # Hitesh's tasks (Total: 38h non-completed + 6h completed)
            {
                "title": "Implement RBAC middleware for multi-tenant isolation",
                "project": "Enterprise Migration v2",
                "assignee": "hitesh@acmecorp.com",
                "status": "In Progress",
                "priority": "Urgent",
                "hours": 12.0,
                "due": now + timedelta(days=2),
            },
            {
                "title": "Optimize vector embedding ChromaDB retrieval pipeline",
                "project": "Enterprise Migration v2",
                "assignee": "hitesh@acmecorp.com",
                "status": "In Progress",
                "priority": "High",
                "hours": 14.0,
                "due": now + timedelta(days=3),
            },
            {
                "title": "Audit serverless database connection pool",
                "project": "Enterprise Migration v2",
                "assignee": "hitesh@acmecorp.com",
                "status": "Todo",
                "priority": "High",
                "hours": 6.0,
                "due": now + timedelta(days=5),
            },
            {
                "title": "Resolve CVE vulnerability in Python dependencies",
                "project": "Enterprise Migration v2",
                "assignee": "hitesh@acmecorp.com",
                "status": "In Progress",
                "priority": "Urgent",
                "hours": 6.0,
                "due": now - timedelta(days=1),  # Overdue!
            },
            {
                "title": "Initial database schema & Neon migration",
                "project": "Enterprise Migration v2",
                "assignee": "hitesh@acmecorp.com",
                "status": "Done",
                "priority": "Medium",
                "hours": 6.0,
                "due": now - timedelta(days=4),
            },

            # Nicholas's tasks (Total: 12h non-completed + 4h completed)
            {
                "title": "Migrate legacy authentication to JWT tokens",
                "project": "Enterprise Migration v2",
                "assignee": "nicholas@acmecorp.com",
                "status": "In Progress",
                "priority": "High",
                "hours": 8.0,
                "due": now + timedelta(days=3),
            },
            {
                "title": "API gateway rate limiting and caching spec",
                "project": "Enterprise Migration v2",
                "assignee": "nicholas@acmecorp.com",
                "status": "Todo",
                "priority": "Medium",
                "hours": 4.0,
                "due": now + timedelta(days=6),
            },
            {
                "title": "Vite + Tailwind frontend shell setup",
                "project": "Enterprise Migration v2",
                "assignee": "nicholas@acmecorp.com",
                "status": "Done",
                "priority": "Medium",
                "hours": 4.0,
                "due": now - timedelta(days=5),
            },

            # Anush's tasks (Total: 22h Pending Approval)
            {
                "title": "Quarterly security compliance review",
                "project": "SOC-2 Type II Compliance",
                "assignee": "anush@acmecorp.com",
                "status": "Pending Approval",
                "priority": "High",
                "hours": 16.0,
                "due": now + timedelta(days=7),
            },
            {
                "title": "SOC-2 Type II audit readiness evidence checklist",
                "project": "SOC-2 Type II Compliance",
                "assignee": "anush@acmecorp.com",
                "status": "Pending Approval",
                "priority": "High",
                "hours": 6.0,
                "due": now + timedelta(days=4),
            },

            # Sidharth's tasks (Total: 8h Todo + 4h Done)
            {
                "title": "Staffing roadmap & technical hiring pipeline",
                "project": "Enterprise Migration v2",
                "assignee": "sidharth@acmecorp.com",
                "status": "Todo",
                "priority": "Medium",
                "hours": 8.0,
                "due": now + timedelta(days=5),
            },
            {
                "title": "Prepare employee onboarding handbook & security policy",
                "project": "SOC-2 Type II Compliance",
                "assignee": "sidharth@acmecorp.com",
                "status": "Done",
                "priority": "Medium",
                "hours": 4.0,
                "due": now - timedelta(days=2),
            },
        ]

        for t_data in acme_tasks_data:
            task = db.query(Task).filter(Task.org_id == acme_org.id, Task.title == t_data["title"]).first()
            if not task:
                task = Task(
                    org_id=acme_org.id,
                    project_id=acme_projects[t_data["project"]].id,
                    assignee_id=acme_users[t_data["assignee"]].id,
                    title=t_data["title"],
                    status=t_data["status"],
                    priority=t_data["priority"],
                    estimated_hours=t_data["hours"],
                    due_date=t_data["due"],
                )
                db.add(task)
                db.commit()
                print(f"  Created task: {task.title}")
            else:
                task.status = t_data["status"]
                task.priority = t_data["priority"]
                task.estimated_hours = t_data["hours"]
                task.due_date = t_data["due"]
                task.assignee_id = acme_users[t_data["assignee"]].id
                db.commit()
                print(f"  Updated task: {task.title} ({task.status}, {task.estimated_hours}h)")

        # Acme Audit Events
        existing_events = db.query(AuditEvent).filter(AuditEvent.org_id == acme_org.id).count()
        if existing_events < 5:
            events = [
                AuditEvent(
                    org_id=acme_org.id,
                    user_id=acme_users["anush@acmecorp.com"].id,
                    user_name="Anush",
                    action="ORGANIZATION_INITIALIZED",
                    resource_type="system",
                    resource_id=str(acme_org.id),
                    details="Acme Corp organization workspace established with Neon PostgreSQL isolation.",
                    timestamp=now - timedelta(days=3),
                ),
                AuditEvent(
                    org_id=acme_org.id,
                    user_id=acme_users["anush@acmecorp.com"].id,
                    user_name="Anush",
                    action="USER_INVITED",
                    resource_type="user",
                    resource_id=str(acme_users["nicholas@acmecorp.com"].id),
                    details="Invited Nicholas with role Manager.",
                    timestamp=now - timedelta(days=2, hours=18),
                ),
                AuditEvent(
                    org_id=acme_org.id,
                    user_id=acme_users["nicholas@acmecorp.com"].id,
                    user_name="Nicholas",
                    action="PROJECT_CREATED",
                    resource_type="project",
                    resource_id=str(acme_projects["Enterprise Migration v2"].id),
                    details="Created Enterprise Migration v2 project and milestones.",
                    timestamp=now - timedelta(days=2, hours=6),
                ),
                AuditEvent(
                    org_id=acme_org.id,
                    user_id=acme_users["hitesh@acmecorp.com"].id,
                    user_name="Hitesh",
                    action="TASK_STARTED",
                    resource_type="task",
                    resource_id="101",
                    details="Started work on 'Implement RBAC middleware for multi-tenant isolation'.",
                    timestamp=now - timedelta(hours=4),
                ),
                AuditEvent(
                    org_id=acme_org.id,
                    user_id=acme_users["anush@acmecorp.com"].id,
                    user_name="Anush",
                    action="WORKLOAD_AUDITED",
                    resource_type="analytics",
                    resource_id="tower",
                    details="Control tower executive analytics snapshot generated.",
                    timestamp=now - timedelta(minutes=15),
                ),
                AuditEvent(
                    org_id=acme_org.id,
                    user_id=acme_users["sidharth@acmecorp.com"].id,
                    user_name="Sidharth",
                    action="USER_LOGIN",
                    resource_type="user",
                    resource_id=str(acme_users["sidharth@acmecorp.com"].id),
                    details="Sidharth logged in via HS256 JWT auth.",
                    timestamp=now - timedelta(minutes=5),
                ),
            ]
            db.add_all(events)
            db.commit()
            print("  Created audit events for Acme Corp")

        # -------------------------------------------------------------
        # Organization 2: Globex Labs
        # -------------------------------------------------------------
        globex_org = db.query(Organization).filter(Organization.slug == "globex-labs").first()
        if not globex_org:
            globex_org = Organization(name="Globex Labs", slug="globex-labs")
            db.add(globex_org)
            db.commit()
            db.refresh(globex_org)
            print(f"\nCreated organization: {globex_org.name} (id={globex_org.id})")
        else:
            print(f"\nFound existing organization: {globex_org.name} (id={globex_org.id})")

        # Globex Users
        globex_users_data = [
            {"email": "admin@globex.com", "name": "Marcus Vance", "role": "Admin", "department": "Executive"},
            {"email": "manager@globex.com", "name": "Jessica Lee", "role": "Manager", "department": "R&D"},
            {"email": "hr@globex.com", "name": "Sonia Patel", "role": "HR", "department": "Operations"},
            {"email": "employee@globex.com", "name": "Liam Johnson", "role": "Employee", "department": "Platform"},
        ]

        globex_users = {}
        for u_data in globex_users_data:
            user = db.query(User).filter(User.email == u_data["email"]).first()
            if not user:
                user = User(
                    org_id=globex_org.id,
                    email=u_data["email"],
                    name=u_data["name"],
                    role=u_data["role"],
                    department=u_data["department"],
                    hashed_password=hashed_pwd,
                    is_active=True,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"  Created user: {user.name} ({user.role}) <{user.email}>")
            else:
                user.org_id = globex_org.id
                user.name = u_data["name"]
                user.role = u_data["role"]
                user.department = u_data["department"]
                user.password_hash = hash_password("password123")
                user.hashed_password = user.password_hash
                user.is_active = True
                db.commit()
                db.refresh(user)
                print(f"  Updated existing user: {user.name} ({user.role})")
            globex_users[user.email] = user

        # Globex Projects
        globex_projects_data = [
            {"name": "Quantum AI Infrastructure", "description": "Next-gen platform scaling and cluster orchestration.", "status": "In Progress"},
            {"name": "BioTech Research Pipeline", "description": "Automated data parsing and clinical trial workflows.", "status": "In Progress"},
        ]
        globex_projects = {}
        for p_data in globex_projects_data:
            proj = db.query(Project).filter(Project.org_id == globex_org.id, Project.name == p_data["name"]).first()
            if not proj:
                proj = Project(
                    org_id=globex_org.id,
                    name=p_data["name"],
                    description=p_data["description"],
                    status=p_data["status"],
                )
                db.add(proj)
                db.commit()
                db.refresh(proj)
                print(f"  Created project: {proj.name}")
            else:
                proj.status = p_data["status"]
                proj.description = p_data["description"]
                db.commit()
                db.refresh(proj)
            globex_projects[proj.name] = proj

        # Globex Tasks:
        # Liam Johnson: 36.0h (16 + 12 + 8) -> OVERLOADED (>= 36h)
        # Jessica Lee: 10.0h (6 + 4) -> UNDER-UTILIZED
        # Marcus Vance: 18.0h -> Pending Approval
        # Sonia Patel: 6.0h -> Todo
        globex_tasks_data = [
            # Liam Johnson (Platform Engineer)
            {
                "title": "Kubernetes cluster autoscaling & GPU driver tuning",
                "project": "Quantum AI Infrastructure",
                "assignee": "employee@globex.com",
                "status": "In Progress",
                "priority": "Urgent",
                "hours": 16.0,
                "due": now + timedelta(days=2),
            },
            {
                "title": "Bio-data ingestion pipeline latency optimization",
                "project": "BioTech Research Pipeline",
                "assignee": "employee@globex.com",
                "status": "In Progress",
                "priority": "High",
                "hours": 12.0,
                "due": now + timedelta(days=3),
            },
            {
                "title": "Zero-trust network policy hardening across pods",
                "project": "Quantum AI Infrastructure",
                "assignee": "employee@globex.com",
                "status": "Todo",
                "priority": "High",
                "hours": 8.0,
                "due": now + timedelta(days=5),
            },
            {
                "title": "Resolve critical OpenSSL memory leak alert",
                "project": "Quantum AI Infrastructure",
                "assignee": "employee@globex.com",
                "status": "In Progress",
                "priority": "Urgent",
                "hours": 8.0,
                "due": now - timedelta(days=1),  # Overdue!
            },
            {
                "title": "Setup distributed caching layer for model weights",
                "project": "Quantum AI Infrastructure",
                "assignee": "employee@globex.com",
                "status": "Done",
                "priority": "Medium",
                "hours": 6.0,
                "due": now - timedelta(days=3),
            },

            # Jessica Lee (R&D Manager)
            {
                "title": "Review synthetic dataset generation metrics",
                "project": "BioTech Research Pipeline",
                "assignee": "manager@globex.com",
                "status": "In Progress",
                "priority": "High",
                "hours": 6.0,
                "due": now + timedelta(days=2),
            },
            {
                "title": "Research sprint backlog grooming & prioritization",
                "project": "BioTech Research Pipeline",
                "assignee": "manager@globex.com",
                "status": "Todo",
                "priority": "Medium",
                "hours": 4.0,
                "due": now + timedelta(days=4),
            },
            {
                "title": "Q3 machine learning benchmark sign-off",
                "project": "Quantum AI Infrastructure",
                "assignee": "manager@globex.com",
                "status": "Done",
                "priority": "Medium",
                "hours": 5.0,
                "due": now - timedelta(days=4),
            },

            # Marcus Vance (Admin)
            {
                "title": "Executive AI governance & ethics committee charter",
                "project": "Quantum AI Infrastructure",
                "assignee": "admin@globex.com",
                "status": "Pending Approval",
                "priority": "Urgent",
                "hours": 18.0,
                "due": now + timedelta(days=5),
            },

            # Sonia Patel (HR)
            {
                "title": "Research fellow compensation benchmark review",
                "project": "BioTech Research Pipeline",
                "assignee": "hr@globex.com",
                "status": "Todo",
                "priority": "Medium",
                "hours": 6.0,
                "due": now + timedelta(days=6),
            },
            {
                "title": "Publish updated remote IP and patent protection clause",
                "project": "Quantum AI Infrastructure",
                "assignee": "hr@globex.com",
                "status": "Done",
                "priority": "Medium",
                "hours": 4.0,
                "due": now - timedelta(days=2),
            },
        ]

        for t_data in globex_tasks_data:
            task = db.query(Task).filter(Task.org_id == globex_org.id, Task.title == t_data["title"]).first()
            if not task:
                task = Task(
                    org_id=globex_org.id,
                    project_id=globex_projects[t_data["project"]].id,
                    assignee_id=globex_users[t_data["assignee"]].id,
                    title=t_data["title"],
                    status=t_data["status"],
                    priority=t_data["priority"],
                    estimated_hours=t_data["hours"],
                    due_date=t_data["due"],
                )
                db.add(task)
                db.commit()
                print(f"  Created task: {task.title}")
            else:
                task.status = t_data["status"]
                task.priority = t_data["priority"]
                task.estimated_hours = t_data["hours"]
                task.due_date = t_data["due"]
                task.assignee_id = globex_users[t_data["assignee"]].id
                db.commit()
                print(f"  Updated task: {task.title} ({task.status}, {task.estimated_hours}h)")

        # Globex Audit Events
        existing_globex_events = db.query(AuditEvent).filter(AuditEvent.org_id == globex_org.id).count()
        if existing_globex_events < 5:
            events = [
                AuditEvent(
                    org_id=globex_org.id,
                    user_id=globex_users["admin@globex.com"].id,
                    user_name="Marcus Vance",
                    action="ORGANIZATION_INITIALIZED",
                    resource_type="system",
                    resource_id=str(globex_org.id),
                    details="Globex Labs workspace initialized with isolated tenant schema.",
                    timestamp=now - timedelta(days=4),
                ),
                AuditEvent(
                    org_id=globex_org.id,
                    user_id=globex_users["admin@globex.com"].id,
                    user_name="Marcus Vance",
                    action="USER_INVITED",
                    resource_type="user",
                    resource_id=str(globex_users["manager@globex.com"].id),
                    details="Invited Jessica Lee as Manager for R&D operations.",
                    timestamp=now - timedelta(days=3),
                ),
                AuditEvent(
                    org_id=globex_org.id,
                    user_id=globex_users["manager@globex.com"].id,
                    user_name="Jessica Lee",
                    action="PROJECT_CREATED",
                    resource_type="project",
                    resource_id=str(globex_projects["Quantum AI Infrastructure"].id),
                    details="Created Quantum AI Infrastructure project track.",
                    timestamp=now - timedelta(days=2, hours=12),
                ),
                AuditEvent(
                    org_id=globex_org.id,
                    user_id=globex_users["employee@globex.com"].id,
                    user_name="Liam Johnson",
                    action="TASK_STARTED",
                    resource_type="task",
                    resource_id="201",
                    details="Began work on Kubernetes cluster autoscaling & GPU driver tuning.",
                    timestamp=now - timedelta(hours=6),
                ),
                AuditEvent(
                    org_id=globex_org.id,
                    user_id=globex_users["admin@globex.com"].id,
                    user_name="Marcus Vance",
                    action="WORKLOAD_AUDITED",
                    resource_type="analytics",
                    resource_id="tower",
                    details="Executive workload and compliance audit completed.",
                    timestamp=now - timedelta(minutes=45),
                ),
            ]
            db.add_all(events)
            db.commit()
            print("  Created audit events for Globex Labs")

        ensure_new_feature_defaults(db)
        print("\nAll database tables successfully seeded for multi-tenant organizations!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
