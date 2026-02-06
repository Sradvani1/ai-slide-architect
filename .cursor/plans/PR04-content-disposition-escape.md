# PR4: Escape Content-Disposition filename

## Purpose
- Prevent malformed `Content-Disposition` or header injection if `safeName` (from user-controlled `filename`) contains `"` or `\`.
- `sanitizeFilename` already restricts characters; this adds defense-in-depth for the header value.

## Scope
- **Single file:** `functions/src/index.ts` (download-images-zip handler)

## Implementation

1. **After** `const safeName = sanitizeFilename(...)` (line 631), **add** a header-safe name:
   ```ts
   const headerSafeName = safeName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
   ```

2. **Replace** (line 634):
   - From: `res.setHeader('Content-Disposition', \`attachment; filename="${safeName}.zip"\`);`
   - To: `res.setHeader('Content-Disposition', \`attachment; filename="${headerSafeName}.zip"\`);`

## Verification
- `cd functions && npm run build`
- Call `/download-images-zip` with a filename containing `"` or `\` (if allowed by sanitizeFilename); confirm header is well-formed and file downloads.
