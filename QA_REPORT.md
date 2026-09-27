# SMART-CORP AI QA Report

Date: 2026-09-27  
Environment: local repository checkout, Python 3.11 virtualenv, Node/Vite test environment  
Branch: `arena/01a0e3e2-smart-corp-ai`

## Executive summary

| Metric | Result |
|---|---:|
| Automated tests executed | 106 |
| Passed | 106 |
| Failed | 0 |
| Blocked | 3 integration areas |
| Automated pass rate | 100% |
| Critical defects | 0 |
| High defects | 0 |
| Medium defects | 0 |
| Low defects | 1 observation |

The implemented frontend and backend test suites pass. This is not a claim that the Render deployment or live Google/Redis integrations passed: those environments/credentials were unavailable.

## Test coverage

| Area | Tests | Passed | Failed | Blocked |
|---|---:|---:|---:|---:|
| Authentication | included in backend suite | pass | 0 | 0 |
| Dashboard/overview | 2 | 2 | 0 | 0 |
| AI assistant | 3 | 3 | 0 | 0 |
| Knowledge/governance | 8 | 8 | 0 | 0 |
| Decisions/approvals | 4 | 4 | 0 | 0 |
| Other implemented routes | 21 route checks | 21 | 0 | 0 |
| Backend API | 59 | 59 | 0 | 0 |
| Database/tenant isolation | included in 59 | pass | 0 | 0 |
| Redis | 0 live integration | — | — | blocked |
| Google integration | 0 live integration | — | — | blocked |
| Browser/Render E2E | 0 | — | — | blocked |

## Commands and evidence

- `cd frontend && npm test -- --run`: **47 passed**, 2 files.
- `cd frontend && npm run build`: **passed** (`tsc -b && vite build`).
- `cd backend && .venv/bin/pytest -q`: **59 passed**, 51 warnings.
- `cd backend && .venv/bin/python manage.py check --deploy`: completed with **22 warnings**, no fatal errors.

## Findings

### LOW — React console warning in Users page

- Test/evidence: frontend test stderr reported `Each child in a list should have a unique "key" prop. Check the render method of UsersPage.`
- Expected: every rendered list child has a stable key.
- Actual: UsersPage emits a React warning.
- Impact: no observed functional failure, but it indicates unstable list rendering and can cause incorrect reconciliation when rows change.
- Status: open; safe follow-up fix is to add a stable key at the list mapping site.

### LOW — chart dimensions warning in jsdom

- Test/evidence: frontend test stderr reported Recharts width/height `0` in jsdom during role-switch rendering.
- Classification: test-environment limitation/visual smoke observation; no browser failure was demonstrated.
- Status: open; browser-level visual verification is recommended.

### INFO — deployment check warnings

`manage.py check --deploy` reported security warnings in the default development configuration and drf-spectacular serializer inference warnings for APIViews. Production settings explicitly set HSTS and secure cookies, but deployment validation should still be run with production environment variables.

## Workflow status

| Workflow | Status | Basis |
|---|---|---|
| Login/authentication | PASS | backend auth tests and frontend demo login tests |
| Dashboard/overview | PASS | frontend UI tests |
| Client discovery | BLOCKED / NOT IMPLEMENTED | no matching feature discovered |
| Lead creation | BLOCKED / NOT IMPLEMENTED | no matching feature discovered |
| Contact management | BLOCKED / NOT IMPLEMENTED | no matching feature discovered |
| Outreach | BLOCKED / NOT IMPLEMENTED | no matching feature discovered |
| Follow-up | BLOCKED / NOT IMPLEMENTED | no matching feature discovered |
| Pipeline | BLOCKED / NOT IMPLEMENTED | no matching feature discovered |
| Database persistence | PASS | Django test database, organization and tenant tests |
| Redis | BLOCKED | no live Redis service available |
| Google integration | BLOCKED | `GOOGLE_API_KEY` unavailable; no live call made |
| Full browser E2E | BLOCKED | no Playwright/browser harness and no deployed URL |
| Render deployment | BLOCKED | no deployed Render URL available for verification |

## Security smoke assessment

Authentication, unauthorized access, RBAC, and tenant isolation tests passed. No API key was found in frontend configuration or committed test artifacts. No production credentials were accessed. Full CORS/CSRF and deployed-host validation remain blocked until a live deployment is available.

## Final assessment

**READY WITH KNOWN ISSUES** for the currently implemented, locally tested Phase 1/demo functionality.

Not ready for a stronger full-system certification because Render, live Redis, Google API, and browser-level deployed E2E were not available. The repository does contain a Render Blueprint, but configuration presence is not deployment evidence.
