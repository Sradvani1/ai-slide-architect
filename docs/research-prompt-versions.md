# `buildResearchSystemPrompt` and `buildResearchUserPrompt` — Version History

## Summary: Where Things Live and Why It Feels "Lost"

### Single source file

- **Git-tracked source:** `shared/promptBuilders.ts` — this is the only `promptBuilders` in version control.
- **`functions/src/shared/`** is listed in `.gitignore`. It is **not** a second source. The functions `prebuild` does:
  ```text
  rm -rf lib src/shared && cp -R ../shared src/
  ```
  So `functions/src/shared/promptBuilders.ts` is a **build-time copy** of `shared/promptBuilders.ts`. It has no git history. **Important:** `prebuild` runs `rm -rf ... src/shared` before copying. If you edit `functions/src/shared/promptBuilders.ts` by hand, the next `npm run build` **deletes it and replaces it** with a fresh copy from `shared/`. That is how the **"summary → report"** version was lost (see §4).

### What’s in git vs. what’s only local

- **Committed (HEAD and 09755a8):** The **simpler** research prompts (Accuracy, Clarity, Structure, No Sources; “No lists of sources”; no grounding/citations/.gov/.edu/encyclopedic/recency rules).
- **Working tree of `shared/promptBuilders.ts`:** Your **comprehensive/encyclopedic** edits: grounding, inline citations, 5–10 reputable sources, .gov/.edu/museums/encyclopedias, recency check, `<use_web_search>`, “collect sources first”, “Do not rely on memory”, “Add inline citations [n]…”, and Sources section. **These exist only as uncommitted changes.**

So the “comprehensive” version is not in any commit. It’s in your working copy of `shared/promptBuilders.ts`. The “loss” is likely from:

1. **Never committing** those edits, and/or  
2. **Deployed/CI builds** using the committed `shared/` (simple version), and/or  
3. **`functions/src/shared/`** containing a copy from a build that ran when `shared/` still had the simple version (or from a clean checkout).

---

## 1. Before the split (no `buildResearch*` — logic inside `buildSlideDeckUserPrompt`)

**Commit:** parent of `09755a8` (i.e. `f9623a3`)

`buildResearchSystemPrompt` and `buildResearchUserPrompt` did not exist. Research behavior lived inside `buildSlideDeckUserPrompt` via `sourceMaterial`, `useWebSearch`, and a `<research_instructions>` block:

```ts
// buildSlideDeckUserPrompt had:
//   sourceMaterial?: string,
//   useWebSearch?: boolean,

if (sourceMaterial) {
  const instruction = useWebSearch
    ? 'Use the following text as your primary source of truth. Supplement with web search for additional context.'
    : 'You must derive your content ENTIRELY from the following text.';
  // ... <source_material>...
}

if (useWebSearch) {
  const instruction = sourceMaterial
    ? 'Use web search to supplement the source material with additional details, context, and examples.'
    : 'Since no source material is provided, you MUST use Google Search to research this topic.';

  sections.push(`<research_instructions>
${instruction}

1. Find high-quality, age-appropriate information.
2. Synthesize results as the core content for the presentation.
</research_instructions>`.trim());
}
```

No separate system prompt for research; no encyclopedic/citation/source-quality/recency rules.

---

## 2. First (and only) committed version — `buildResearch*` introduced (simple)

**Commit:** `09755a8` — *Update slide generation service and workflow*  
**Same as:** `HEAD` (no later commit touches `shared/promptBuilders.ts`)

### `buildResearchSystemPrompt`

```ts
export function buildResearchSystemPrompt(): string {
  return `<role>
You are an educational content researcher and curriculum designer.
</role>

<task>
Create a single, structured research summary that will be used to generate slides.
The summary should be complete, coherent, and organized for easy conversion into a slide deck.
</task>

<constraints>
1. Accuracy: Use factual, verifiable information.
2. Clarity: Use clear, age-appropriate language.
3. Structure: Organize the summary logically for slide creation.
4. No Sources: Do NOT include citations, URLs, or references in the research summary.
</constraints>

<output_format>
Return a single plain-text research summary. No markdown. No JSON. No lists of sources.
</output_format>`.trim();
}
```

### `buildResearchUserPrompt`

```ts
export function buildResearchUserPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  sourceMaterial?: string,
  useWebSearch: boolean = true,
  additionalInstructions?: string
): string {
  const gradeString = gradeLevel.toLowerCase().includes('grade')
    ? gradeLevel
    : `${gradeLevel} Grade`;

  const sections: string[] = [];

  sections.push(`<context>
<topic>${topic}</topic>
<subject>${subject}</subject>
<grade_level>${gradeString}</grade_level>
${additionalInstructions ? `<additional_instructions>${additionalInstructions}</additional_instructions>` : ''}
</context>`.trim());

  if (sourceMaterial) {
    const instruction = useWebSearch
      ? 'Use the following text as your primary source of truth. Supplement with web search for additional context.'
      : 'Use ONLY the following text as your source. Do NOT use web search.';

    sections.push(`<source_material>
${instruction}

SOURCE BEGIN:
${sourceMaterial}
SOURCE END
</source_material>`.trim());
  }

  if (useWebSearch) {
    const instruction = sourceMaterial
      ? 'Use web search to supplement the source material with additional details, context, and examples.'
      : 'Since no source material is provided, you MUST use Google Search to research this topic.';

    sections.push(`<research_instructions>
${instruction}

1. Find high-quality, age-appropriate information.
2. Synthesize results into a single, structured research summary.
3. Focus on facts, concepts, and explanations appropriate for ${gradeString} students.
</research_instructions>`.trim());
  } else {
    sections.push(`<research_instructions>
You must derive your research summary ENTIRELY from the provided source material.
Do NOT include sources, citations, URLs, or references.
</research_instructions>`.trim());
  }

  return sections.join('\n\n').trim();
}
```

Note: context has no `<use_web_search>`. No citation, source-quality, or recency rules.

---

## 3. Working tree — comprehensive/encyclopedic (uncommitted)

**Source:** Current working tree of `shared/promptBuilders.ts`  
**Status:** Uncommitted (only in `git diff`).

This is the version with grounding, citations, 5–10 sources, .gov/.edu/encyclopedias, recency, and “collect sources first / do not rely on memory.”

### `buildResearchSystemPrompt` (working tree)

```ts
export function buildResearchSystemPrompt(): string {
  return `<role>
You are an educational content researcher and curriculum designer.
</role>

<task>
Create a single, structured research summary that will be used to generate slides.
The summary should be complete, coherent, and organized for easy conversion into a slide deck.
</task>

<constraints>
2. Grounding requirement: When <use_web_search>true</use_web_search> is present in the user prompt, you MUST use the Google Search tool for the research.
3. Evidence: When web search is enabled, every factual claim must have an inline citation marker placed at the end of the sentence.
4. Source quality: When web search is enabled, use 5–10 reputable sources (prefer .gov, .edu, museums, major encyclopedias, and well-known publishers).
5. Recency check: When web search is enabled, include at least one source from the last 12 months OR explicitly state "No major updates found in the last 12 months" and cite a source supporting the current understanding.
6. Clarity: Use clear, age-appropriate language.
7. Structure: Organize the summary logically for slide creation.
</constraints>

<output_format>
Return a single plain-text research summary. No markdown. No JSON.
When web search is enabled, include inline citations [1], [2], etc.
When web search is enabled, end with a "Sources" section mapping [n] -> Title — Publisher/Organization — Year (no URLs).
</output_format>`.trim();
}
```

Note: Constraints are numbered 2–7; “1” is missing (likely from replacing the old 1–4 and renumbering).

### `buildResearchUserPrompt` (working tree)

```ts
export function buildResearchUserPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  sourceMaterial?: string,
  useWebSearch: boolean = true,
  additionalInstructions?: string
): string {
  const gradeString = gradeLevel.toLowerCase().includes('grade')
    ? gradeLevel
    : `${gradeLevel} Grade`;

  const sections: string[] = [];

  sections.push(`<context>
<use_web_search>${useWebSearch ? 'true' : 'false'}</use_web_search>
<topic>${topic}</topic>
<subject>${subject}</subject>
<grade_level>${gradeString}</grade_level>
${additionalInstructions ? `<additional_instructions>${additionalInstructions}</additional_instructions>` : ''}
</context>`.trim());

  if (sourceMaterial) {
    const instruction = useWebSearch
      ? 'Use the following text as your primary source of truth. Supplement with web search for additional context.'
      : 'Use ONLY the following text as your source. Do NOT use web search.';

    sections.push(`<source_material>
${instruction}

SOURCE BEGIN:
${sourceMaterial}
SOURCE END
</source_material>`.trim());
  }

  if (useWebSearch) {
    const instruction = sourceMaterial
      ? 'Use web search to supplement the source material with additional details, context, and examples.'
      : `Since no source material is provided, you MUST use Google Search to research this topic.
You must collect sources first, then write the summary with citations.
Do not rely on memory when web search is enabled.`;

    sections.push(`<research_instructions>
${instruction}

1. Find high-quality, age-appropriate information.
2. Synthesize results into a single, structured research summary.
3. Focus on facts, concepts, and explanations appropriate for ${gradeString} students.
4. Add inline citations [n] after the sentences they support and finish with a Sources section.
</research_instructions>`.trim());
  } else {
    sections.push(`<research_instructions>
You must derive your research summary ENTIRELY from the provided source material.
Do NOT include sources, citations, URLs, or references.
</research_instructions>`.trim());
  }

  return sections.join('\n\n').trim();
}
```

Differences from the committed version:

- `<use_web_search>true/false</use_web_search>` in context.
- When no source material: “You must collect sources first, then write the summary with citations” and “Do not rely on memory when web search is enabled.”
- Extra research instruction: “4. Add inline citations [n] after the sentences they support and finish with a Sources section.”

---

## 4. "Summary → Report" / encyclopedic version (recovered from Cursor local history)

**Where it lived:** `functions/src/shared/promptBuilders.ts`  
**Status:** **Lost** — that path is gitignored and is **wiped by `prebuild`** (`rm -rf lib src/shared` then `cp -R ../shared src/`). Any edits you made there were overwritten the next time you ran `npm run build` in `functions/`.  
**Recovered from:** Cursor's local history: `~/Library/Application Support/Cursor/User/History/-436b19fa/`. The `entries.json` there shows the resource as `file:///.../functions/src/shared/promptBuilders.ts`.

This version changes **"summary" → "report"** everywhere in the research helpers and adds **encyclopedic/depth** constraints: exhaustive, high-density, thematic headings, "explicitly avoid brevity", and "3–4 supporting facts, examples, or analogies" per sub-topic.

### `buildResearchSystemPrompt` (report / encyclopedic)

```ts
export function buildResearchSystemPrompt(): string {
  return `<role>
You are an educational content researcher and curriculum designer.
</role>

<task>
Create an exhaustive, high density research report that will be used to generate presentation slides.
The report should be a complete, coherent, and organized knowledge base for conversion into a slide presentation.
</task>

<constraints>
1. Accuracy: Use factual, verifiable information.
2. Clarity: Use clear, age-appropriate language.
3. Structure: Organize the report logically for slide creation.
4. Detail: Provide exhaustive encyclopedic explanations. Explicitly avoid brevity.
5. Depth: Every sub-topic must include at least 3-4 specific supporting facts, examples, or analogies.
</constraints>

<output_format>
Return a single plain-text research report. No markdown. No JSON. No lists of sources. Use thematic headings.
</output_format>`.trim();
}
```

### `buildResearchUserPrompt` (report / encyclopedic)

```ts
export function buildResearchUserPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  sourceMaterial?: string,
  useWebSearch: boolean = true,
  additionalInstructions?: string
): string {
  const gradeString = gradeLevel.toLowerCase().includes('grade')
    ? gradeLevel
    : `${gradeLevel} Grade`;

  const sections: string[] = [];

  sections.push(`<context>
<topic>${topic}</topic>
<subject>${subject}</subject>
<grade_level>${gradeString}</grade_level>
${additionalInstructions ? `<additional_instructions>${additionalInstructions}</additional_instructions>` : ''}
</context>`.trim());

  if (sourceMaterial) {
    const instruction = useWebSearch
      ? 'Use the following text as your primary source of truth. Supplement with web search for additional context.'
      : 'Use ONLY the following text as your source. Do NOT use web search.';

    sections.push(`<source_material>
${instruction}

SOURCE BEGIN:
${sourceMaterial}
SOURCE END
</source_material>`.trim());
  }

  if (useWebSearch) {
    const instruction = sourceMaterial
      ? 'Use web search to supplement the source material with additional details, context, and examples.'
      : 'Since no source material is provided, you MUST use Google Search to research this topic.';

    sections.push(`<research_instructions>
${instruction}

1. Find high-quality, age-appropriate information.
2. Focus on concepts, facts and vivid explanations appropriate for ${gradeString} students.
</research_instructions>`.trim());
  } else {
    sections.push(`<research_instructions>
You must derive your research report ENTIRELY from the provided source material.
</research_instructions>`.trim());
  }

  return sections.join('\n\n').trim();
}
```

**Differences vs. committed (§2):** "Summary" → "report" everywhere; task: "exhaustive, high density research **report**" and "organized **knowledge base**"; constraints: "Organize the **report**", plus **4. Detail: Provide exhaustive encyclopedic explanations. Explicitly avoid brevity.** and **5. Depth: Every sub-topic must include at least 3-4 specific supporting facts, examples, or analogies.** (removed "No Sources"); output: "research **report**" and **"Use thematic headings."**; user prompt (useWebSearch): 2 bullets only, no "Synthesize…summary"; user prompt (else): "research **report** ENTIRELY", no "Do NOT include sources…". **Why it disappeared:** Edits were in `functions/src/shared/promptBuilders.ts`, which is deleted and replaced from `shared/` on each `npm run build`.

---

## 5. `functions/src/shared/promptBuilders.ts` (current build-time copy)

**Origin:** `prebuild` copies `../shared` into `functions/src/shared/`. This path is gitignored.

**Content:** Matches **§2** (committed simple version). The "report" / encyclopedic version (§4) was overwritten by prebuild.

---

## 6. Git log for `shared/promptBuilders.ts`

Only one commit touches the research helpers:

```text
09755a8 Update slide generation service and workflow
```

All commits that modify `shared/promptBuilders.ts` (including earlier ones that don’t touch research):

```text
09755a8 Update slide generation service and workflow
f9623a3 feat: clarify slide JSON structure in prompt instructions and remove concurrency test plan.
d965cfa chore: Simplify slide count and grade level references in prompt and remove redundant `content_slides_count`.
9b87573 refactor: Update slide deck prompts with structured XML tags, internal total slide calculation, and refined instructions.
8c13c7e feat: Restructure slide generation prompt into distinct system and user messages for Gemini API and remove image prompt regeneration.
... (older commits for image prompts, shared module, etc.)
```

---

## 7. Recommendations

1. **Commit the comprehensive version**  
   Your encyclopedic/citation/grounding/recency logic is only in the working tree. To keep it:
   - Run `git add shared/promptBuilders.ts && git commit -m "feat: make research comprehensive — grounding, citations, 5–10 sources, .gov/.edu/encyclopedias, recency"`  
   (or equivalent message).

2. **Fix constraint numbering in `buildResearchSystemPrompt`**  
   In the working-tree version, constraints run 2–7. Add a “1.” (e.g. “1. Accuracy: Use factual, verifiable information.”) if you want to keep the original accuracy rule and consistent numbering.

3. **Ensure `functions` uses the right `shared/`**  
   After committing, run `npm run build` in `functions/` so `functions/src/shared/` (and then `lib/`) is updated from the new `shared/promptBuilders.ts`. Deploys will then use the comprehensive research prompts.

4. **Avoid editing `functions/src/shared/` by hand**  
   It is overwritten by `prebuild`. All prompt changes should go in `shared/promptBuilders.ts`.

5. **To restore the "summary → report" / encyclopedic version (§4):**  
   Copy the `buildResearchSystemPrompt` and `buildResearchUserPrompt` from §4 into `shared/promptBuilders.ts`, then commit and run `npm run build` in `functions/`. You can merge §4’s report/encyclopedic wording with §3’s grounding/citation rules if you want both.

---

## 8. Quick reference

| Location | buildResearchSystemPrompt | buildResearchUserPrompt |
|----------|---------------------------|--------------------------|
| **09755a8 / HEAD** (`shared/`) | Simple: Accuracy, Clarity, Structure, No Sources; “No lists of sources” | No `<use_web_search>`; no “collect sources first” or citation step |
| **§4 Report / encyclopedic** (Cursor history, was in `functions/src/shared/`) | "**report**"; "exhaustive, high density"; "knowledge base"; Detail + Depth (encyclopedic, 3–4 facts); "Use thematic headings" | "**report**"; 2 research bullets; "research report ENTIRELY" in else |
| **Working tree** (`shared/`) | Grounding, Evidence, Source quality (5–10, .gov/.edu/encyclopedias), Recency; citations + Sources in output | `<use_web_search>`; “collect sources first”, “Do not rely on memory”; “Add inline citations [n]…” |
| **`functions/src/shared/`** (current) | Same as 09755a8/HEAD (copy) | Same as 09755a8/HEAD (copy) |

---

*Generated from `shared/promptBuilders.ts` history and working tree. `functions/src/shared/` is gitignored and is a build-time copy of `shared/`.*
