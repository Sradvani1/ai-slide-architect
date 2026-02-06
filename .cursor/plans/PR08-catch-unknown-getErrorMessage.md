# PR8: Use unknown and getErrorMessage in catch blocks

## Purpose
- Align with strict TypeScript and safer error handling by using `unknown` in catch and a small helper instead of `any` and ad-hoc `error?.message`.

## Scope
- **Files:** `functions/src/index.ts`, `functions/src/services/slideGeneration.ts`, `functions/src/services/imageTextExtraction.ts`, `functions/src/services/imageGeneration.ts`
- **New helper:** In shared (so both frontend and backend can use) or in `functions/src/utils`. Plan suggests shared or functions.

## Implementation

1. **Add helper** (e.g. `shared/utils/errorMessage.ts` or `functions/src/utils/errorMessage.ts`):
   ```ts
   export function getErrorMessage(error: unknown): string {
     return error instanceof Error ? error.message : String(error);
   }
   ```

2. **In each handler/service:** Replace `catch (error: any)` with `catch (error: unknown)`. Where you build responses or log, use `getErrorMessage(error)` instead of `error?.message` or `error.message`. Where you do `error instanceof GeminiError` (or similar), keep the type guard.

3. **Index.ts:** 9 occurrences (lines 217, 263, 314, 336, 432, 513, 606, 637, 660, 681). Update all and use `getErrorMessage` for generic message in JSON/log.

4. **slideGeneration.ts:** 3 occurrences (lines 442, 527, 600). Same pattern.

5. **imageTextExtraction.ts:** After PR1, if any `catch (e: any)` or `catch (error: any)` remain (e.g. line 75), update to `unknown` and `getErrorMessage`.

6. **imageGeneration.ts:** 2 occurrences (lines 90, 157). Same pattern.

## Verification
- `cd functions && npm run build`; root `npm run build`
- Run lint if configured. Trigger error paths; confirm error messages still appear correctly in responses and logs.
