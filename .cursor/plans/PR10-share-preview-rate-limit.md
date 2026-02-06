# PR10: Rate limit share preview

## Purpose
- Limit abuse of unauthenticated `GET /share/preview` (token probing or DoS). Use in-memory, IP-based limiting so it works without auth.

## Scope
- **New:** In-memory rate limit for `GET /share/preview` only.
- **File:** `functions/src/index.ts` (wire middleware) and optionally a new small module (e.g. `functions/src/middleware/sharePreviewRateLimit.ts`).

## Implementation

1. **Implement IP-based, in-memory rate limit:**
   - Store per-IP request count and window start (e.g. `Map<string, { count: number; windowStart: number }>`).
   - Window: 60 seconds; max requests per IP: e.g. 60/min (or 30/min for stricter limit).
   - On each request: get client IP from `req.ip` or `req.headers['x-forwarded-for']` (first hop if multiple). If over limit, send `res.status(429)` and do not call `next()`. Otherwise increment (and reset window if expired) and call `next()`.

2. **Apply only to `GET /share/preview`:** Use a dedicated middleware function and attach it only to that route (e.g. `app.get('/share/preview', sharePreviewRateLimit, async (req, res) => { ... })`). Do not use the existing Firestore-based `rateLimitMiddleware` (it requires auth).

3. **Return 429** with a JSON body like `{ error: 'Too many requests' }` when limit exceeded.

## Verification
- `cd functions && npm run build`
- Send many requests to `GET /share/preview?token=...` from same IP; confirm 429 after the chosen threshold. Other routes unchanged.
