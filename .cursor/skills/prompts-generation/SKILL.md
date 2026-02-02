---
name: prompts-generation
description: Applies the project's prompt and AI generation patterns when changing slide generation, image generation, image search, prompts, or model usage. Use when editing shared/promptBuilders.ts, slideGeneration, imageGeneration, imageTextExtraction, model mapping, retry logic, or when changing how research, slides, image prompts, or images are produced.
---

# Prompts & Generation Guidelines

When changing how slides, research, image prompts, or images are generated, follow the project's patterns.

## When to Use This Skill

- Editing `shared/promptBuilders.ts` or prompt text
- Changing slide generation flow, research phase, or retry behavior
- Changing image prompt generation, image generation, or image search
- Editing model selection, usage recording, or shared retry logic

## Source of Truth

- **Prompts:** `shared/promptBuilders.ts` — all system/user prompt builders live here. Functions are imported by the Functions layer only (no frontend import).
- **Models & style:** `shared/constants.ts` — `MODEL_SLIDE_GENERATION`, `MODEL_IMAGE_GENERATION`, `STYLE_GUIDELINES`.
- **Model mapping:** `functions/src/services/modelMappingService.ts` — operation key → model and operation type (text vs image) for usage/pricing.

## Prompt Types

| Purpose | System / user builders | Output |
|--------|-------------------------|--------|
| Research | `buildResearchSystemPrompt`, `buildResearchUserPrompt` | Plain-text report; optional `googleSearch` tool |
| Slide deck | `buildSlideDeckSystemPrompt`, `buildSlideDeckUserPrompt` | JSON array of `{ title, content[], speakerNotes }` |
| Image prompt (per slide) | `buildSingleSlideImagePromptSystemInstructions`, `buildSingleSlideImagePromptUserPrompt` | Single paragraph, no markdown |
| Image search terms | `buildImageSearchTermsSystemInstructions`, `buildImageSearchTermsUserPrompt` | JSON array of strings |

Image generation does not use promptBuilders; it uses the user's prompt plus `STYLE_GUIDELINES` from `shared/constants.ts`. Text extraction uses a fixed inline prompt ("Extract all text from this image.") in `imageTextExtraction.ts`.

## Model Usage

- **Text (research, slides, image prompt, search terms, OCR):** `MODEL_SLIDE_GENERATION` (e.g. gemini-3-flash-preview).
- **Image generation:** `MODEL_IMAGE_GENERATION` (e.g. gemini-3-pro-image-preview); `responseModalities: ['TEXT','IMAGE']`, `imageConfig.aspectRatio`, `imageSize: '1K'`.

Model mapping: `getModelForOperation(operationKey)` and `getOperationType(operationKey)` in `modelMappingService.ts`; operation keys include `slide-research`, `slide-generation`, `image-prompt`, `image-search-terms`, `text-extraction`, `image-generation`. Use these for `recordUsage` and pricing.

## Slide Generation Flow

1. **Research:** `performUnifiedResearch` — optional `tools: [{ googleSearch: {} }]`, source material, grounding; writes `researchContent`, `sources`; `recordUsage(..., 'slide-research')`.
2. **Drafting:** `performSlideGeneration` — `responseMimeType: 'application/json'`, `extractFirstJsonArray`, `validateSlideStructure`; up to `maxGenerationRetries` (3) with backoff; `recordUsage(..., 'slide-generation')`.
3. **Progress:** Firestore `generationPhase` (research → drafting → finalizing) and `generationProgress` (0, 10, 50, 90, 100). Background only; no automatic image prompt generation after batch.

Image prompts are user-triggered per slide via `/generate-prompt` → `generateImagePromptsForSingleSlide` → `generateImagePrompts` in `imageGeneration.ts`; state is `promptGenerationState` / `promptRequestId` on the slide.

## Retry & Parsing

- **Shared:** `shared/utils/retryLogic.ts` — `retryWithBackoff` (default 3 retries), `retryPromptGeneration` (used for single image prompt), `extractFirstJsonArray` for JSON from model output.
- **Slide generation:** Retry loop (e.g. 3 attempts) around `performSlideGeneration` only; research is not retried in a loop.
- **Image generation:** `retryWithBackoff(..., 2)`; handle safety blocks via `ImageGenError`.

## Where to Look

- **Prompt text and structure:** `shared/promptBuilders.ts`
- **Constants and style:** `shared/constants.ts`
- **Slide flow:** `functions/src/services/slideGeneration.ts` (research, drafting, batch write, no auto image prompts)
- **Image prompt / search terms / generate image:** `functions/src/services/imageGeneration.ts`
- **OCR:** `functions/src/services/imageTextExtraction.ts`
- **Model mapping and usage:** `functions/src/services/modelMappingService.ts`, `usageEventsService.ts`
- **Retry and validation:** `shared/utils/retryLogic.ts`, `shared/utils/validation.ts` (`validateSlideStructure`)
