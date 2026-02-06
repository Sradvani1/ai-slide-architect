---
name: Cleanup and Hardening Plan
overview: A markdown plan documenting codebase cleanup opportunities and security hardening changes, with clear implementation steps for each item.
todos: []
isProject: false
---

# Codebase Cleanup and Hardening Plan

This plan documents issues identified during review, ordered by priority and effort. Each section describes the issue, affected files, and concrete implementation steps.

---

## Part 1: Critical Cleanup

### Issue 1.1: Remove Debug/Agent Logging from imageTextExtraction.ts

**Problem:** [functions/src/services/imageTextExtraction.ts](functions/src/services/imageTextExtraction.ts) contains debug blocks (lines 2–21) that send fetch requests to `http://127.0.0.1:7243/ingest/`. This is development/debugging code that should not ship. It adds noise, potential data leakage, and extra network calls.

**Implementation:**

- Delete the entire `#region agent log` / `#endregion` blocks (lines 2–21)
- Leave only the clean imports: `@shared/constants`, `@shared/utils/retryLogic`, `@shared/errors`, and local imports
- Verify the file starts with `import { getAiClient } from '../utils/geminiClient';` followed by `import { MODEL_SLIDE_GENERATION } from '@shared/constants';` and `import { retryWithBackoff } from '@shared/utils/retryLogic';`

---

### Issue 1.2: Consolidate Duplicate Icon Libraries

**Problem:** The project uses three icon sources:

- `@heroicons/react` in [src/components/SlideDeck.tsx](src/components/SlideDeck.tsx) (ArrowDownTrayIcon, ClipboardDocumentIcon, DocumentTextIcon, ShareIcon)
- Custom SVGs in [src/components/icons.tsx](src/components/icons.tsx)
- `lucide-react` in package.json (possibly used elsewhere)

**Implementation:**

1. Audit all icon usage: grep for `@heroicons`, `lucide-react`, and icons from `icons.tsx`
2. Choose one source (recommend lucide-react for consistency and tree-shaking)
3. Replace heroicons in SlideDeck with equivalent lucide-react icons (e.g. Download, Copy, FileText, Share)
4. Update SlideDeck imports
5. Remove `@heroicons/react` from [package.json](package.json) dependencies
6. Run `npm install` and verify build

---

### Issue 1.3: Replace Deprecated substr in ErrorBoundary

**Problem:** [src/components/ErrorBoundary.tsx](src/components/ErrorBoundary.tsx) line 83 uses `Math.random().toString(36).substr(2, 9)`. `String.prototype.substr` is deprecated; use `substring` or `slice`.

**Implementation:**

- Change to: `Math.random().toString(36).slice(2, 11).toUpperCase()`
- Note: `slice(2, 11)` yields 9 characters (same as `substr(2, 9)`)

---

## Part 2: Security Hardening

### Issue 2.1: Add Request Body Size Limit

**Problem:** [functions/src/index.ts](functions/src/index.ts) uses `app.use(express.json())` with no limit. Large JSON payloads can cause memory exhaustion (DoS).

**Implementation:**

- Replace `app.use(express.json());` with:
  ```ts
  app.use(express.json({ limit: '500kb' }));
  ```
- 500kb is sufficient for topic, instructions, file names, and typical request bodies
- Adjust if large base64 image payloads are sent in JSON (extract-text uses base64; consider separate limit if needed)

---

### Issue 2.2: Server-Side Input Bounds for generate-slides

**Problem:** The backend accepts `numSlides` and `bulletsPerSlide` from the client without validation. A malicious client could send extreme values. README documents 2–10 slides and 3–6 bullets.

**Implementation:**

- In the `/generate-slides` handler, after extracting from `req.body`:
  ```ts
  const numSlides = Math.min(10, Math.max(2, Number(req.body.numSlides) || 5));
  const bulletsPerSlide = Math.min(6, Math.max(3, Number(req.body.bulletsPerSlide) || 4));
  ```
- Pass these validated values to `generateSlidesAndUpdateFirestore` instead of raw `req.body.numSlides` and `req.body.bulletsPerSlide`
- Import `DEFAULT_BULLETS_PER_SLIDE` from shared if not already available

---

### Issue 2.3: Base64 Size Limit for extract-text

**Problem:** The `extract-text` endpoint accepts `imageBase64` without a size check. Very large base64 strings can cause memory pressure and high Gemini costs.

**Implementation:**

1. Add a constant, e.g. `const MAX_IMAGE_BASE64_BYTES = 10 * 1024 * 1024;` (10MB)
2. In the handler, compute decoded size: base64 is ~4/3 of raw bytes, so `Math.ceil((imageBase64.length * 3) / 4)` approximates byte size
3. If size exceeds limit, return `res.status(400).json({ error: "Image data exceeds size limit" });`
4. Perform this check after verifying `imageBase64` exists and is a string

---

### Issue 2.4: Escape Content-Disposition Filename

**Problem:** In the `/download-images-zip` handler, the filename is set with:

```ts
res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
```

If `safeName` (from user-controlled `filename`) contains `"` or `\`, the header can be malformed or allow header injection.

**Implementation:**

- After `sanitizeFilename`, escape for the header:
  ```ts
  const headerSafeName = safeName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  res.setHeader('Content-Disposition', `attachment; filename="${headerSafeName}.zip"`);
  ```
- `sanitizeFilename` already restricts characters; escaping adds defense-in-depth for the HTTP header

---

### Issue 2.5: Rate Limit Share Preview (Optional but Recommended)

**Problem:** `GET /share/preview` is public and unauthenticated, with no rate limiting. It can be abused for token enumeration or DoS.

**Implementation:**

- Add a lightweight IP-based rate limit for this route only (do not use Firestore-based rate limit, which requires auth)
- Options: in-memory Map with window (e.g. 60 req/min per IP), or a dedicated middleware for unauthenticated routes
- Apply the middleware only to `GET /share/preview`
- Return 429 when limit exceeded

---

### Issue 2.6: Restrict CORS in Production (Optional)

**Problem:** `cors({ origin: true })` reflects any origin. In production, restrict to known frontend URLs.

**Implementation:**

- Add env var `ALLOWED_ORIGINS` (comma-separated) for production
- Use conditional CORS:
  ```ts
  const corsOrigin = process.env.FUNCTIONS_EMULATOR
    ? true
    : (process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || true);
  app.use(cors({ origin: corsOrigin }));
  ```
- Document in README that `ALLOWED_ORIGINS` should be set for deployed Functions (e.g. `https://your-app.vercel.app`)

---

## Part 3: Code Quality

### Issue 3.1: Use unknown Instead of any in Catch Blocks

**Problem:** Many handlers use `catch (error: any)` and access `error.message`. Using `unknown` and type guards is safer and aligns with strict TypeScript.

**Implementation:**

- Create a small helper in shared or functions:
  ```ts
  function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
  ```
- Replace `catch (error: any)` with `catch (error: unknown)` in handlers
- Use `getErrorMessage(error)` or `error instanceof SomeError ? error : ...` when building responses
- Apply gradually to [functions/src/index.ts](functions/src/index.ts) and other backend files

---

### Issue 3.2: Remove Duplicate Constants in src/constants.ts

**Problem:** [src/constants.ts](src/constants.ts) defines `DEFAULT_BULLETS_PER_SLIDE` and `DEFAULT_NUM_SLIDES` and also re-exports from shared. This duplicates values; a change in shared could be missed in src.

**Implementation:**

- Remove the local definitions of `DEFAULT_BULLETS_PER_SLIDE` and `DEFAULT_NUM_SLIDES` from src/constants.ts
- Keep only: `export * from '../shared/constants';`
- Confirm shared/constants.ts defines these; update shared if needed
- Verify no circular dependency; imports should flow: shared -> src

---

## Implementation Order


| #   | Issue                          | Effort  | Dependencies    |
| --- | ------------------------------ | ------- | --------------- |
| 1   | 1.1 Remove debug logging       | Trivial | None            |
| 2   | 2.1 Body size limit            | Trivial | None            |
| 3   | 2.2 Input bounds               | Trivial | None            |
| 4   | 2.4 Content-Disposition escape | Trivial | None            |
| 5   | 1.3 Replace substr             | Trivial | None            |
| 6   | 2.3 Base64 size limit          | Small   | None            |
| 7   | 3.2 Duplicate constants        | Trivial | None            |
| 8   | 3.1 Catch typing               | Small   | Optional helper |
| 9   | 1.2 Consolidate icons          | Medium  | Audit first     |
| 10  | 2.5 Share preview rate limit   | Small   | New middleware  |
| 11  | 2.6 CORS restrict              | Small   | Env/config      |


---

## Verification

After each change:

- Run `npm run build` (root) and `npm run build` in functions
- Run `npm run lint` if ESLint is configured
- Manually test affected endpoints (generate-slides, extract-text, download-images-zip, share/preview)

