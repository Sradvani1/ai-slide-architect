# PR2: Add request body size limit

## Purpose
- Prevent unbounded JSON body parsing to avoid memory exhaustion (DoS) from very large payloads.
- 500kb is enough for topic, instructions, file names, and typical request bodies.

## Scope
- **Single file:** `functions/src/index.ts`

## Implementation

1. **Replace** (line 36):
   - From: `app.use(express.json());`
   - To: `app.use(express.json({ limit: '500kb' }));`

2. **Optional:** If you later send large base64 image payloads in JSON (e.g. in `extract-text`), consider a higher limit for that route or a separate parser; 500kb is fine for current usage.

## Verification
- `cd functions && npm run build`
- Manually send a JSON body > 500kb to any POST endpoint; expect 413 or body truncated/error per Express behavior.
