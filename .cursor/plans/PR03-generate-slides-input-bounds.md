# PR3: Server-side input bounds for generate-slides

## Purpose
- Enforce documented bounds (2–10 slides, 3–6 bullets) on the server so a malicious client cannot send extreme values and overload generation or costs.

## Scope
- **Single file:** `functions/src/index.ts` (generate-slides handler)

## Implementation

1. **After extracting from `req.body`** (after line 145, before or with the existing validation block), compute validated values:
   - `numSlides`: clamp to [2, 10], default 5.
   - `bulletsPerSlide`: clamp to [3, 6], default 4.

2. **Suggested code** (place after the `req.body` destructuring, before the "Basic validation" block):
   ```ts
   const numSlides = Math.min(10, Math.max(2, Number(req.body.numSlides) || 5));
   const bulletsPerSlide = Math.min(6, Math.max(3, Number(req.body.bulletsPerSlide) || 4));
   ```

3. **Use validated values in the call** (lines 188–203):
   - Replace `numSlides || 5` with `numSlides`.
   - Replace `bulletsPerSlide` with `bulletsPerSlide` (already a number in range).

4. **Imports:** Use numeric literals 5 and 4 as above, or import `DEFAULT_NUM_SLIDES` and `DEFAULT_BULLETS_PER_SLIDE` from `@shared/constants` for defaults. Shared already exports both.

## Verification
- `cd functions && npm run build`
- Call `/generate-slides` with `numSlides: 1`, `numSlides: 100`, `bulletsPerSlide: 0`, `bulletsPerSlide: 20`; confirm 2–10 and 3–6 are enforced.
