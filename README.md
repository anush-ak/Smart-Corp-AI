# Smart-Corp-AI
 AI Assistant for Knowledge Management

SmartCorp AI — an AI-powered enterprise operating and knowledge platform
(Django REST API + PostgreSQL + pgvector + Redis + Celery + Google Gemini,
with a React dashboard).

## Layout

- `backend/` — Django REST API. **Phase 1 done**: custom User, organisations,
  departments, RBAC, JWT auth. See [`backend/README.md`](backend/README.md).
- `frontend/` — React + Vite dashboard (mock API by default; set
  `VITE_USE_MOCK_API=false` to use the live Django API).

AI provider: **Google Gemini** (`GOOGLE_API_KEY`, backend only). There is no
OpenAI dependency anywhere in this project.
