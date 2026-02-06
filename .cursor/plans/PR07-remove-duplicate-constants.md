# PR7: Remove duplicate constants in src/constants.ts

## Purpose
- Single source of truth for `DEFAULT_BULLETS_PER_SLIDE` and `DEFAULT_NUM_SLIDES` in `shared/constants.ts` so frontend and backend stay in sync and local duplicates are not missed when shared changes.

## Scope
- **File to edit:** `src/constants.ts`
- **Consumers:** `src/components/Editor.tsx` imports `DEFAULT_NUM_SLIDES` and `DEFAULT_BULLETS_PER_SLIDE` from `../constants`; no change needed if `src/constants.ts` only re-exports from shared.

## Implementation

1. **In `src/constants.ts`:** Remove the two local definitions (lines 1–2):
   - `export const DEFAULT_BULLETS_PER_SLIDE = 4;`
   - `export const DEFAULT_NUM_SLIDES = 5;`
   Keep only: `export * from '../shared/constants';`

2. **Confirm** `shared/constants.ts` exports both (already does: lines 1–2).

3. **Check for circular dependency:** shared must not import from `src`. Current flow is `shared` → used by `src` and `functions`; no circular dependency.

## Verification
- Root `npm run build`
- Grep for `DEFAULT_BULLETS_PER_SLIDE` and `DEFAULT_NUM_SLIDES`; confirm only defined in `shared/constants.ts` and re-exported from `src/constants.ts`.
