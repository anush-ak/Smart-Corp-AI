# SmartCorp AI — Engineering & Design Rules

## 1. Core Architecture & Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons, native WebSocket API.
- Backend: Python 3.11+, FastAPI, Uvicorn, SQLAlchemy ORM, Pydantic v2, PyJWT (HS256), Passlib (bcrypt).
- Data & AI: PostgreSQL 16 (smartcorp_db), ChromaDB (local persistent store at ./chroma_data), PyPDF, Google Gemini API (gemini-2.5-flash).
- Golden Rule: Use the LLM only for language tasks (grounded RAG Q&A and structured JSON meeting extraction). Every KPI, chart value, and What-If workload calculation MUST be 100% deterministic code.

## 2. Strict Folder Structure
Match this layout exactly:
- backend/: main.py, config.py, database.py, models.py, auth.py, rag_service.py, meeting_service.py, seed.py, requirements.txt
- frontend/src/: context/AuthContext.tsx, hooks/useWebSocket.ts, components/Sidebar.tsx, components/AuditTrailFeed.tsx, components/CitationPopover.tsx, pages/DashboardPage.tsx, pages/KnowledgeChatPage.tsx, pages/MeetingConverterPage.tsx, pages/TaskBoardPage.tsx

## 3. Security & Multi-Tenant Invariants
- Every database table (users, projects, tasks, documents, audit_events) MUST have an org_id foreign key referencing organizations.id.
- Always read org_id and role from the verified JWT via get_current_user in auth.py—NEVER trust org_id from a request body or query param.
- ChromaDB queries MUST include where={"org_id": org_id} before any chunk reaches Gemini.
- WebSocket rooms MUST be scoped by tenant: /ws/{org_id}.
- Roles are strictly: Admin, Manager, HR, Employee.
- Never expose GEMINI_API_KEY or JWT_SECRET to the frontend.

## 4. Exact API Contract
- POST /api/auth/login
- GET /api/dashboard/summary
- POST /api/documents/upload (Admin, HR)
- POST /api/knowledge/ask
- POST /api/meetings/extract (Admin, Manager)
- POST /api/tasks/batch (Admin, Manager)
- GET /api/audit-events (Admin, Manager)
- WS /ws/{org_id}

## 5. Anti-AI-Slop UI/UX Design System (Linear / Vercel Aesthetic)
- Palette: Dark mode using zinc elevation steps—Canvas #09090B, Surface/Cards #111114, Elevated Popovers #18181B. Separate surfaces with crisp 1px solid rgba(255,255,255,0.08) borders.
- BANNED: No purple/blue glowing gradients, no heavy drop shadows, no neon borders, no decorative AI sparkle icons, no oversized cards with excessive padding.
- Semantic Colors Only: Indigo #6366F1 (primary actions), Emerald #10B981 (Saves X Days badge & completed tasks), Amber #F59E0B (uncertain assignees/dates in Meeting Converter), Rose #F43F5E (overdue/overloaded alerts).
- Typography: Inter for UI, JetBrains Mono with font-variant-numeric: tabular-nums for KPIs, hours, timestamps, and [Filename, Pg X] citation pills.
- Density: Tight, purposeful spacing (p-4/p-5 cards, gap-4 grids), 16px Lucide icons (strokeWidth={1.75}).

## 6. Free-Tier Production & Deployment Rules (Vercel + Render + Neon)
- Use VITE_API_URL and VITE_WS_URL environment variables in the frontend (fallback to http://localhost:8000 and ws://localhost:8000 locally).
- Read ALLOWED_ORIGINS from .env in main.py for CORS.
- Include backend/requirements.txt and keep all secrets in environment variables.
- On FastAPI startup, check if the ChromaDB collection is empty; if so, auto-ingest sample PDFs from backend/demo_docs/.
