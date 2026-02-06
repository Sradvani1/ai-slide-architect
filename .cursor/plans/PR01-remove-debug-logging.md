# PR1: Remove debug/agent logging from imageTextExtraction

## Purpose
- Remove development-only code that sends fetch requests to `http://127.0.0.1:7243/ingest/` from production.
- Avoid extra network calls, log noise, and any risk of leaking data to a debug endpoint.

## Scope
- **Single file:** `functions/src/services/imageTextExtraction.ts`

## Implementation

1. **Delete all `#region agent log` / `#endregion` blocks** (lines 2–21).
   - First block: try/catch with `require.resolve('@shared/constants')` and fetch (lines 2–9).
   - Second block: single fetch after `@shared/constants` import (lines 11–12).
   - Third block: try/catch with `require.resolve('@shared/utils/retryLogic')` and fetch (lines 14–20).

2. **Leave the file starting with:**
   - `import { getAiClient } from '../utils/geminiClient';`
   - `import { MODEL_SLIDE_GENERATION } from '@shared/constants';`
   - `import { retryWithBackoff } from '@shared/utils/retryLogic';`
   - `import { GeminiError } from '@shared/errors';`
   - `import { recordUsage } from './usageEventsService';`

3. **Fix remaining `catch (e: any)` in the same file** (lines 6, 18) if they are only inside the removed regions; otherwise leave for PR8 (catch typing).

## Verification
- `cd functions && npm run build`
- Root `npm run build`
- No references to `127.0.0.1:7243` or `ingest` in the codebase.
