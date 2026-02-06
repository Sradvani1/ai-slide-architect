# PR11: Restrict CORS in production

## Purpose
- In production, allow only known frontend origins instead of reflecting any origin (`origin: true`), to reduce risk of cross-origin abuse.

## Scope
- **File:** `functions/src/index.ts` (CORS setup).
- **Config:** Allow-list is defined in code (`ALLOWED_ORIGINS` array); no env var or Cloud Console setting.

## Implementation

1. **CORS in code:** In production, use an in-code array of allowed origins; when `FUNCTIONS_EMULATOR` is set (local emulator), keep `origin: true`. List includes localhost, Vercel, custom domains, and Firebase hosting URLs. To add or change an origin, edit the array in `functions/src/index.ts` and redeploy.

2. **README:** No README change required (config is in code).

## Verification
- `cd functions && npm run build`
- With emulator: CORS allows all origins. Deployed: only origins in `ALLOWED_ORIGINS` get CORS headers.
