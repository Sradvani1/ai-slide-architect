# PR6: Base64 size limit for extract-text

## Purpose
- Reject oversized `imageBase64` payloads to avoid memory pressure and excessive Gemini usage.

## Scope
- **Single file:** `functions/src/index.ts` (extract-text handler, ~lines 278–317)

## Implementation

1. **Add a constant** near other constants (e.g. after `MAX_IMAGE_BYTES`):
   ```ts
   const MAX_IMAGE_BASE64_BYTES = 10 * 1024 * 1024; // 10MB decoded size
   ```

2. **In the handler**, after confirming `imageBase64` exists and is a string (after the existing `if (!imageBase64)` check), **add**:
   - Decoded size: `const decodedBytes = Math.ceil((imageBase64.length * 3) / 4);`
   - If `decodedBytes > MAX_IMAGE_BASE64_BYTES`: `res.status(400).json({ error: "Image data exceeds size limit" }); return;`

3. **Order:** Check size after presence/type and before calling `extractTextFromImage`.

## Verification
- `cd functions && npm run build`
- Send a very large base64 string to `/extract-text`; expect 400 with "Image data exceeds size limit". Send a normal-sized image; expect success.
