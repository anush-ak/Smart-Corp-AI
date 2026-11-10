# E2E Test Results

## Scope

The repository now contains both Vitest + Testing Library UI integration tests and a Playwright production smoke suite. A browser-level suite against a running integrated deployment could not be honestly executed because no Render URL, credentials, or Chromium binary were available.

## Executed application-level journeys

| Journey | Environment | Result | Evidence |
|---|---|---|---|
| Demo login → overview | Vitest/jsdom | PASS | `frontend/src/test/app.test.tsx` |
| Role switch → permission-aware workspace | Vitest/jsdom | PASS | `frontend/src/test/app.test.tsx` |
| Restricted knowledge visibility | Vitest/jsdom | PASS | `frontend/src/test/app.test.tsx` |
| Dashboard/overview rendering | Vitest/jsdom | PASS | `frontend/src/test/app.test.tsx` |
| Assistant query → cited answer | Vitest/jsdom | PASS | `frontend/src/test/app.test.tsx` |
| Decision approval requires note | Vitest/jsdom | PASS | `frontend/src/test/app.test.tsx` |
| All discovered route pages | Vitest/jsdom | PASS, 21/21 | `frontend/src/test/routes.test.tsx` |
| Login → JWT → session | Django test client | PASS | `backend/tests/test_auth.py` |
| Token refresh rotation/replay rejection | Django test client | PASS | `backend/tests/test_auth.py` |
| Password change/reset/email verification | Django test client | PASS | `backend/tests/test_auth.py` |
| User CRUD/RBAC/tenant isolation | Django test client + test DB | PASS | backend test suite |
| Health/readiness and malformed API requests | Django test client | PASS | `backend/tests/test_smoke_contracts.py` |

## Not executed / blocked

- Browser Chromium journeys at desktop/tablet/mobile breakpoints.
- Network interception for 400/401/403/404/429/500, timeout and disconnect states.
- double-submit and multi-tab browser tests.
- Render frontend → API → PostgreSQL → Redis workflow.
- Live Google/AI request and failure modes.
- Real PostgreSQL persistence and recovery drill.

## Browser suite acceptance criteria for next environment

Run against a staging/Render URL with a dedicated test account and Playwright Chromium. Capture trace/video/screenshots on failure; verify console errors and failed requests; test 1440x900, 1280x800, 768x1024, and 390x844; do not create customer records in production.
