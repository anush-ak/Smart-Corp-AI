# SMART-CORP AI QA Test Matrix

## Executed suites

| Area | Source | Result |
|---|---|---:|
| Frontend route coverage | `frontend/src/test/routes.test.tsx` | 21/21 passed |
| Frontend UI/workflow tests | `frontend/src/test/app.test.tsx` | 26/26 passed |
| Backend auth/API | `backend/tests/test_auth.py` | Included in 72 passed |
| Strict API contracts/failure modes | `backend/tests/test_smoke_contracts.py` | 13/13 passed |
| Google integration boundary | `backend/tests/test_integrations.py` | 3/3 mocked/boundary tests passed |
| Organizations/relationships | `backend/tests/test_organizations.py` | Included in 72 passed |
| RBAC/authorization | `backend/tests/test_rbac.py` | Included in 59 passed |
| Tenant isolation | `backend/tests/test_tenant_isolation.py` | Included in 59 passed |
| Django deployment checks | `manage.py check --deploy` | Completed with 22 warnings |
| Production frontend build | `npm run build` | Passed |

## Discovered frontend routes

`/login`, `/overview`, `/assistant`, `/knowledge`, `/knowledge/:id`, `/agents`, `/agents/:id`, `/agents/runs/:id`, `/decisions`, `/decisions/:id`, `/approvals`, `/approvals/:id`, `/evaluation`, `/evaluation/runs/:id`, `/analytics`, `/meetings`, `/meetings/:id`, `/users`, `/audit-logs`, `/security`, `/settings`, and wildcard not-found.

## Discovered backend API surface

Health/readiness: `/health/`, `/ready/`.
Authentication: login, refresh, logout, session, me, change-password, password-reset, email verification, demo accounts, role switch.
Organizations/departments/users: current organization, organization detail, department router, user router, roles.

## Coverage gaps / blocked checks

- No Render URL was supplied or discoverable from the repository; deployed environment was not claimed as tested.
- No `GOOGLE_API_KEY` was available; live Google integration is blocked. Configuration is present and backend tests avoid external calls.
- Redis connection was not available as a live service in this sandbox; code-level readiness behavior is covered, but live Redis/cache/queue behavior is blocked.
- No Playwright dependency or browser test project existed; current UI tests are Vitest + Testing Library rather than browser E2E.
- Business modules such as client discovery, leads, contacts, outreach, follow-ups, and pipeline are not present in the current implementation; they were not fabricated or tested.
