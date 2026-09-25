# SmartCorp AI — Backend (Phase 1)

AI-powered enterprise operating and knowledge platform. **Phase 1** delivers the
foundation: Django configuration, custom User, Organisation, Department, roles,
granular RBAC and JWT authentication.

> **AI provider: Google Gemini.** This project uses `GOOGLE_API_KEY` /
> `google-genai` — there is intentionally **no OpenAI dependency, key, or
> reference** anywhere. Phase 1 wires the configuration; the `AIService`
> itself is built in Phase 5.

## Architecture (Phase 1)

```
HTTP → views (thin) → serializers → AuthService → models
                                              ↘ services/security (RBAC + tenancy)
```

- `config/` — settings (`base`/`development`/`production`/`test`), URLs,
  Celery app, WSGI/ASGI.
- `apps/accounts/` — custom `User` (UUID, email login), JWT auth, user admin.
- `apps/organizations/` — `Organization`, `Department` (multi-tenancy root).
- `apps/<knowledge|documents|rag|ai|…>/` — scaffolds, enabled in later phases.
- `services/security/` — canonical permission catalog + tenant isolation.
- `services/ai/google_client.py` — Gemini client factory (Phase 5 builds on it).
- `common/` — request IDs, security headers, error envelopes, pagination,
  DRF permission classes, health probes.
- `tests/` — pytest suite (auth, RBAC, tenant isolation).

## Quickstart

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then edit secrets
python manage.py migrate
python manage.py seed_demo_data # demo org + 7 role users
python manage.py runserver
```

- API: `http://127.0.0.1:8000/api/v1/` (legacy alias: `/api/…` for the web client)
- Docs: `http://127.0.0.1:8000/api/docs/` (dev only)
- Health: `/health/`, readiness: `/ready/`
- Admin: `/admin/` (owner/admin seed users are staff)

### Demo logins (after seeding)

`owner@smartcorp.demo`, `admin@smartcorp.demo`, `hr@smartcorp.demo`,
`manager@smartcorp.demo`, `finance@smartcorp.demo`, `support@smartcorp.demo`,
`employee@smartcorp.demo` — password from `SMARTCORP_DEMO_PASSWORD`, or the
generated value printed once by the seed command.

### Frontend integration

The React client defaults to mock mode. To point it at this API:

```bash
# frontend/.env.local
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=/api
```

(List endpoints are DRF-paginated `{count,next,previous,results}`; the client
reads `results`. A token-refresh interceptor lands with the Phase 5 client
update — access tokens currently live 60 minutes.)

## API (Phase 1)

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login/` | public | → `{token, access, refresh, user, organization, roles}` |
| POST | `/api/v1/auth/refresh/` | public | rotates + blacklists |
| POST | `/api/v1/auth/logout/` | public | idempotent blacklist |
| GET | `/api/v1/auth/session/` | auth | `{user, organization, roles, permissions, frontend_permissions}` |
| GET/PATCH | `/api/v1/auth/me/` | auth | own profile (role escalation impossible) |
| POST | `/api/v1/auth/change-password/` | auth | |
| POST | `/api/v1/auth/password-reset/` | public | generic response (no enumeration); `debug` payload in DEBUG only |
| POST | `/api/v1/auth/password-reset/confirm/` | public | |
| POST | `/api/v1/auth/verify-email/` | auth | |
| POST | `/api/v1/auth/verify-email/confirm/` | public | |
| GET | `/api/v1/auth/demo-accounts/` | demo-only | 404 unless `DEMO_ENDPOINTS_ENABLED` |
| POST | `/api/v1/auth/switch-role/` | auth + demo | 404 unless `DEMO_ENDPOINTS_ENABLED` |
| GET/POST | `/api/v1/users/` | `users.view` / `users.create` | org-scoped, paginated |
| GET/PATCH/DELETE | `/api/v1/users/<uuid>/` | `users.view`+self / `users.update` / `users.delete` | cross-org → 404 |
| PATCH | `/api/v1/users/<uuid>/scope/` | `users.update` | role + retrieval scopes |
| GET | `/api/v1/users/roles/` | auth | role definitions + bridged permissions |
| GET | `/api/v1/organizations/current/` | auth | own org |
| GET/PATCH | `/api/v1/organizations/<uuid>/` | `organizations.view` / `.manage` | plan change = Owner-only |
| GET/POST | `/api/v1/departments/` | `departments.view` / `.manage` | org-scoped |
| GET/PATCH/DELETE | `/api/v1/departments/<uuid>/` | as above | cross-org → 404 |

Errors always return the envelope `{success:false, data:null, message,
errors:[{code,detail}], code, detail}` plus raw DRF field errors.

## RBAC matrix (canonical `domain.action` permissions)

| Capability | OWNER | ADMIN | HR | MANAGER | FINANCE | SUPPORT | EMPLOYEE |
|---|---|---|---|---|---|---|---|
| `users.view/create/update` | ✓ | ✓ | view | view | – | – | – |
| `users.delete` | ✓ | – | – | – | – | – | – |
| `organizations/departments.manage` | ✓ | ✓ | – | – | – | – | – |
| `documents.view/upload` | ✓ | ✓ | ✓ | view | ✓ | view | view |
| `knowledge.search/manage` | ✓ | ✓ | ✓ | search | ✓ | search | search |
| `analytics.view/run` | ✓ | ✓ | view | view | ✓ | – | – |
| `workflows.view/create/approve` | ✓ | ✓ | ✓ | ✓ | ✓ | view+create | view+create |
| `meetings.view/manage` | ✓ | ✓ | ✓ | ✓ | view | ✓ | view |
| `ai.use/manage` | ✓ | ✓ | use | use | use | use | use |
| `audit.view` | ✓ | ✓ | – | – | – | – | – |
| `evaluation.view/run` | ✓ | ✓ | view | – | – | – | – |

Guards: actors can only grant roles at/below their own rank; no self role
change; no self delete; an organisation always keeps one active Owner.

## Configuration

All via environment (see `.env.example`). Key points:

- `DATABASE_URL` — SQLite locally, **PostgreSQL required in production**
  (enforced at boot). pgvector arrives in Phase 4.
- `REDIS_URL` — optional locally (falls back to in-memory cache + eager
  Celery); required in production for caching/throttling/workers.
- `GOOGLE_API_KEY` — backend-only; AI features degrade gracefully without it.
- `DEMO_ENDPOINTS_ENABLED` — demo aids; **forced off in production**.
- `ENABLE_API_DOCS` — Swagger/ReDoc; on in dev, env-gated in prod.

## Testing

```bash
cd backend
pytest              # full suite (auth, RBAC, tenant isolation, orgs)
pytest tests/test_auth.py -q
```

## Troubleshooting

- **`CircularDependencyError`** — must not happen: `Department.manager` was
  added in migration `0002` deliberately. If you squash migrations, keep the
  manager FK in a later migration than both initial ones.
- **401 `token_not_valid`** — access tokens live 60 min; `POST
  /auth/refresh/` with the refresh token (rotation is on).
- **403 on every write** — check the seed user's role against the matrix above.
- **Demo endpoints 404** — set `DEMO_ENDPOINTS_ENABLED=True` (dev only).
- **Production refuses to boot** — set a real `DJANGO_SECRET_KEY`,
  `DJANGO_ALLOWED_HOSTS` and a PostgreSQL `DATABASE_URL`.
