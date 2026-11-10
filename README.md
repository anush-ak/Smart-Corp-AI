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

## Render Deployment & Environment Variables

Deployment is defined as a Render Blueprint in [`render.yaml`](render.yaml)
(`smartcorp-api`, `smartcorp-redis`, `smartcorp-web`, and `smartcorp-db`).
Runtime versions are pinned via [`backend/.python-version`](backend/.python-version)
(`3.13`) and `frontend/.node-version` (`24`).

### Backend (`smartcorp-api`, rootDir: `backend`)

- `DJANGO_SETTINGS_MODULE` — set to `config.settings.production`
- `DJANGO_SECRET_KEY` — required strong random key; generated automatically by Render (`generateValue: true` in `render.yaml`) — never commit secrets
- `DATABASE_URL` — PostgreSQL connection string (`fromDatabase` `smartcorp-db` in `render.yaml`; SQLite is rejected in production)
- `REDIS_URL` — Render Key Value connection string (`fromService` `smartcorp-redis` in `render.yaml`)
- `GOOGLE_API_KEY` — Google Gemini API key (`sync: false` in `render.yaml`; set in the Render Dashboard)
- `DJANGO_ALLOWED_HOSTS` — comma-separated allowed hosts (e.g. `smartcorp-api.onrender.com`; `RENDER_EXTERNAL_HOSTNAME` is also appended automatically)
- `CORS_ALLOWED_ORIGINS` — comma-separated allowed frontend origins (e.g. `https://smartcorp-web.onrender.com`)
- `CSRF_TRUSTED_ORIGINS` — comma-separated trusted origins for CSRF (e.g. `https://smartcorp-web.onrender.com`)
- `FRONTEND_URL` — public frontend base URL (non-localhost values are automatically included in CORS/CSRF origins)
- `DJANGO_DEBUG` — `"False"` in production (enforced by `config.settings.production`)
- `ENABLE_API_DOCS` — `"False"` to disable Swagger/ReDoc in production
- `PYTHON_VERSION` — pinned Python patch version (e.g. `3.13.5`)

### Frontend (`smartcorp-web`, rootDir: `frontend`)

- `NODE_VERSION` — pinned Node.js version (e.g. `24.22.1`)
- `VITE_USE_MOCK_API` — `"false"` in production so the client calls the live Django API
- `VITE_API_BASE_URL` — public backend base URL (injected from `smartcorp-api`'s `RENDER_EXTERNAL_URL` in `render.yaml`)

### Render Dashboard Checks (Suffixed Hostnames)

If Render appends a random suffix to service names (for example `smartcorp-api-xxxx.onrender.com` or `smartcorp-web-xxxx.onrender.com`), verify in the Render Dashboard that `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `FRONTEND_URL` on `smartcorp-api` match the actual assigned hostnames (`RENDER_EXTERNAL_HOSTNAME` is auto-added to `ALLOWED_HOSTS`, while cross-origin frontend URLs must match `smartcorp-web`'s live URL).

