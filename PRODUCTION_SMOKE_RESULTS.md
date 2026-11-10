# Production Smoke Results

Date: 2026-09-27

## Status

**BLOCKED — RENDER DEPLOYMENT / URL UNAVAILABLE**

The repeatable smoke suite has been created but was not marked PASS without a real target.

## Suite

`frontend/tests/e2e/production-smoke.spec.ts`

Configured in `frontend/playwright.config.ts` for:

- Desktop 1440x900
- Laptop 1280x800
- Tablet iPad Mini profile
- Mobile iPhone 13 profile

The suite contains 3 checks per profile (12 total):

1. HTTPS homepage, assets, title and body.
2. Login route and backend `/health/` connectivity.
3. SPA unknown-route fallback.

Required variables:

```bash
E2E_BASE_URL=https://<frontend-host> \
E2E_API_URL=https://<api-host> \
cd frontend && npm run test:e2e
```

No URLs or credentials were present in the repository/environment, so no browser result is claimed. Playwright test discovery was verified; Chromium execution remains blocked until a target URL and browser binary are available.
