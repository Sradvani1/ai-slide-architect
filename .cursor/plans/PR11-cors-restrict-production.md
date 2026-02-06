# PR11: Restrict CORS in production

## Purpose
- In production, allow only known frontend origins instead of reflecting any origin (`origin: true`), to reduce risk of cross-origin abuse.

## Scope
- **File:** `functions/src/index.ts` (CORS setup, line 35).
- **Config:** New env var `ALLOWED_ORIGINS` (comma-separated list) for production. Document in README.

## Implementation

1. **Replace** (line 35):
   - From: `app.use(cors({ origin: true }));`
   - To conditional origin, e.g.:
   ```ts
   const corsOrigin = process.env.FUNCTIONS_EMULATOR
     ? true
     : (process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || true);
   app.use(cors({ origin: corsOrigin }));
   ```
   - When `FUNCTIONS_EMULATOR` is set (local emulator), keep `origin: true`. When not set, use `ALLOWED_ORIGINS`; if missing or empty, fall back to `true` so existing deployments don't break until env is set.

2. **README:** Document that for deployed Firebase Functions, set `ALLOWED_ORIGINS` to the production frontend URL(s), e.g. `https://your-app.vercel.app`. Multiple origins: comma-separated.

## Verification
- `cd functions && npm run build`
- With emulator: CORS should still allow requests. With `ALLOWED_ORIGINS=https://example.com`, only that origin should get CORS headers; others can be blocked or not reflected depending on `cors` behavior.
