---
name: Harden Resolved Source Storage
overview: Make resolved sources deterministically computed, persisted, and re-used so the project-level `sources` array is always written even under partial failures.
todos:
  - id: compute-sources
    content: Add computeResolvedSources helper and stats
    status: completed
  - id: persist-sources
    content: Persist sources with retry on 25% update
    status: completed
  - id: protect-overwrite
    content: Avoid overwriting sources on completion update
    status: completed
---

## Approach

- Keep `sources` as resolved string array, with best‑effort fallback to original redirect URLs when resolution fails.
- Make source resolution a dedicated, deterministic step in the research flow and persist it immediately, then re‑use the persisted value for later updates to avoid accidental overwrites.
- Add minimal, non‑noisy diagnostics and retry logic around Firestore updates to make persistence resilient.

## Steps

1. **Centralize resolved source computation**

- In [`functions/src/services/slideGeneration.ts`](functions/src/services/slideGeneration.ts), wrap `resolveSourceUrls` + `getUniqueSources` into a single helper (e.g., `computeResolvedSources`) that returns the final `string[]` plus basic stats (counts).
- Ensure it always returns a non‑null array (possibly empty) to simplify persistence.

2. **Persist resolved sources immediately after research**

- In `generateSlidesAndUpdateFirestore`, after `performUnifiedResearch`, write the resolved `sources` to Firestore at the 25% update as the single source of truth.
- Use a small retry helper for the Firestore update (e.g., 2–3 attempts with short backoff) so transient write failures don’t silently drop sources.

3. **Prevent later overwrites with stale data**

- At the 100% completion update, re‑use the already computed `researchResult.sources` (not recomputed) or re‑read the project’s `sources` field if `researchResult.sources` is empty, so a later step cannot overwrite with empty/missing sources.

4. **Add lightweight diagnostics**

- Log a single summary line with counts (`totalGrounding`, `resolved`, `fallback`, `finalCount`) to confirm resolution results without verbose per‑URL logs.

## Notes

- No schema change required since you want resolved‑only storage in the existing `sources` array, and fallback should keep original redirect URLs when resolution fails.
- This plan focuses on deterministic computation + write resilience to make the project-level `sources` field failure‑proof.