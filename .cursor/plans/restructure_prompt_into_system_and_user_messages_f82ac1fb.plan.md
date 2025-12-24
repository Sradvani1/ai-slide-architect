---
name: Restructure prompt into system and user messages
overview: Refactor the slide generation prompt to separate system instructions (persona, standards, structure, format) from user-specific data (topic, grade, material, instructions) using the SDK's systemInstruction config pattern.
todos:
  - id: create-system-prompt-function
    content: Create buildSlideDeckSystemPrompt() function in shared/promptBuilders.ts with role, content_standards, structure_requirements, and formatting_constraints sections
    status: pending
  - id: create-user-prompt-function
    content: Create buildSlideDeckUserPrompt() function in shared/promptBuilders.ts with presentation context and source material/research instructions
    status: pending
  - id: update-slide-generation-service
    content: Update generateSlides() in functions/src/services/slideGeneration.ts to use new prompt functions and add systemInstruction to config
    status: pending
    dependencies:
      - create-system-prompt-function
      - create-user-prompt-function
  - id: remove-old-functions
    content: Remove or deprecate old prompt builder functions after verifying no other usage
    status: pending
    dependencies:
      - update-slide-generation-service
  - id: verify-no-breaking-changes
    content: Search codebase for any other usages of old prompt building functions and update if found
    status: pending
---

# Restructure Slide Generation Prompt into System and User Messages

## Overview

Refactor the prompt building system to separate reusable system instructions from request-specific user data. This will use the `systemInstruction` config pattern (like `generateImagePrompts` already does) rather than a `role: 'system'` in contents.

## Current State

- `buildSlideGenerationPrompt()` in `shared/promptBuilders.ts` combines all sections into one string
- `generateSlides()` in `functions/src/services/slideGeneration.ts` sends everything as a single user message
- The prompt includes: system role, context, source material, content standards, structure requirements, formatting constraints, and output format

## Implementation Plan

### 1. Create New Prompt Builder Functions in `shared/promptBuilders.ts`

**Replace** `buildSlideGenerationPrompt()` with two new functions:

- **`buildSlideDeckSystemPrompt()`**: Returns system instructions (persona, standards, structure, format)
- Based on user's proposed template with XML-style tags
- Includes: role, content_standards, structure_requirements, formatting_constraints
- No parameters needed (static content)
- **`buildSlideDeckUserPrompt()`**: Returns user-specific data
- Parameters: `topic`, `subject`, `gradeLevel`, `totalSlides`, `numContentSlides`, `bulletsPerSlide`, `sourceMaterial?`, `useWebSearch?`, `additionalInstructions?`
- Includes: presentation context, source material OR research instructions
- Returns trimmed string

**Update**: Make `sourceMaterial` and `useWebSearch` optional in the user prompt function signature (user's proposal already has this).

### 2. Update `functions/src/services/slideGeneration.ts`

**Modify `generateSlides()` function** (around lines 31-62):

- Replace the single `buildSlideGenerationPrompt()` call with:
  ```typescript
    const systemPrompt = buildSlideDeckSystemPrompt();
    const userPrompt = buildSlideDeckUserPrompt(
      topic,
      subject,
      gradeLevel,
      numSlides + 1, // totalSlides
      numSlides,     // numContentSlides
      bulletsPerSlide || DEFAULT_BULLETS_PER_SLIDE,
      sourceMaterial,
      useWebSearch,
      additionalInstructions
    );
  ```




- Update the `generateContent` call to use `systemInstruction` in config:
  ```typescript
    const result = await getAiClient().models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        ...config, // existing config (temperature, tools, responseMimeType)
        systemInstruction: { parts: [{ text: systemPrompt }] }
      }
    });
  ```




### 3. Clean Up Old Functions in `shared/promptBuilders.ts`

**Remove or deprecate** (after confirming no other usage):

- `buildSlideGenerationPrompt()` (being replaced)
- `buildSystemRoleSection()` (content moved to system prompt)
- `buildInputContextSection()` (content moved to user prompt)
- `buildSourceMaterialSection()` (content moved to user prompt)
- `buildContentStandardsSection()` (content moved to system prompt)
- `buildStructureRequirementsSection()` (content moved to system prompt, but needs template variables)
- `buildFormattingConstraintsSection()` (content moved to system prompt)
- `buildOutputFormatSection()` (content moved to system prompt)

**Note**: `buildStructureRequirementsSection()` uses template variables (`subject`, `gradeLevel`, `totalSlides`) - these should be handled in the system prompt using placeholders like `<subject>` and `<grade_level>`, OR we keep those as template variables in the system prompt function if needed.**Decision needed**: The user's proposed system prompt has placeholders like `<subject>` and `<grade_level>` in the structure requirements. We should either:

- Keep them as placeholders (AI infers from context)
- OR make the system prompt function accept these as parameters and interpolate

**Recommendation**: Keep placeholders since the user prompt provides context that the AI can use to fill them.

### 4. Verify No Other Usage

Check if `buildSlideGenerationPrompt` or the section builder functions are used elsewhere:

- Search codebase for imports/usages
- Update any other call sites if found

## Files to Modify

1. `shared/promptBuilders.ts`

- Add `buildSlideDeckSystemPrompt()`
- Add `buildSlideDeckUserPrompt()`
- Remove deprecated functions (after verification)

2. `functions/src/services/slideGeneration.ts`

- Update `generateSlides()` to use new functions
- Update `generateContent` call to include `systemInstruction`

## Testing Considerations

- Verify the prompt structure matches user's proposed format
- Test with source material provided
- Test with web search (no source material)
- Test with additional instructions
- Verify token counting still works correctly
- Ensure JSON output format still enforced when appropriate

## Benefits

- System prompt can be cached (token efficiency)
- Clear separation of concerns (behavior vs data)
- Easier to maintain (change system prompt once, affects all requests)