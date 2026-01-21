---
name: research_prompt_cleanup
overview: Update the research prompt builder to reflect effective web search rules and remove redundant Google Search wording while keeping behavior aligned with product constraints.
todos:
  - id: analyze-research-prompt
    content: Review current buildResearchUserPrompt usage and branches
    status: completed
  - id: add-effective-search-flag
    content: Add effectiveUseWebSearch and swap in all branches
    status: completed
  - id: dedupe-instructions
    content: Move Google Search text to research_instructions only
    status: completed
  - id: sanity-check-output
    content: Verify output sections remain consistent and non-redundant
    status: completed
---

- Inspect `buildResearchUserPrompt` in [`/Users/sameer/ai-slide-architect/shared/promptBuilders.ts`](/Users/sameer/ai-slide-architect/shared/promptBuilders.ts) to identify where `useWebSearch` is used in `<context>`, `<source_material>`, and `<research_instructions>`.
- Introduce `effectiveUseWebSearch` (true when no `sourceMaterial`) and use it for `<use_web_search>` and all logic that decides whether to include search instructions.
- Simplify `<source_material>` to only describe the document as primary source, removing Google Search directives, and centralize Google Search requirements in `<research_instructions>`.
- Ensure the no-search path clearly restricts to source material and removes citations/sources, matching the existing structure.
- Recheck for redundant phrases and consistent instructions, then finalize without changing other files.