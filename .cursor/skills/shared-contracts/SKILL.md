---
name: shared-contracts
description: Applies the project's shared code and contract patterns when changing types, errors, constants, validation, or retry logic used by both frontend and backend. Use when editing shared/, changing Slide or ProjectData shape, error codes, API request/response contracts, or when adding or changing validation or retry behavior used across the app.
---

# Shared & Contracts Guidelines

When changing types, errors, constants, validation, or retry logic that are used by both the frontend and the backend, follow the project's patterns.

## When to Use This Skill

- Editing files in `shared/` (types, errors, constants, schemas, promptBuilders, utils)
- Changing `Slide`, `ProjectData`, `GeneratedImage`, `ImagePrompt`, or `ModelPricing`
- Changing error classes or error codes used by API or frontend
- Changing constants (models, defaults, style guidelines) used by functions or UI
- Adding or changing validation or retry logic used in generation or API

## Layout

```
shared/
├── types.ts         # Core domain types (Slide, ProjectData, etc.)
├── errors.ts        # GeminiError, ImageGenError
├── constants.ts     # Model IDs, defaults, STYLE_GUIDELINES
├── schemas.ts       # SLIDES_SCHEMA (JSON schema for slide array)
├── promptBuilders.ts  # Prompt text builders (used by functions only)
└── utils/
    ├── retryLogic.ts   # retryWithBackoff, retryPromptGeneration, extractFirstJsonArray, RateLimiter
    └── validation.ts   # validateSlideStructure
```

## Who Uses What

- **Frontend:** Imports types via `src/types.ts` (re-exports `@shared/types` and `ImageGenError`). Imports constants via `src/constants.ts` (re-exports `../shared/constants`). May import errors from `../../shared/errors` (e.g. geminiService). Does **not** import promptBuilders, retryLogic, or validation (those are backend-only).
- **Backend (functions):** Imports via `@shared/` alias: types, errors, constants, promptBuilders, `@shared/utils/retryLogic`, `@shared/utils/validation`. promptBuilders and retry/validation are used only in functions.

**Contract rule:** Changes to `shared/types.ts`, `shared/errors.ts`, or `shared/constants.ts` can affect both frontend and backend. Keep request/response shapes and error codes in sync. When adding or renaming fields on `Slide` or `ProjectData`, consider Firestore structure and any frontend that reads/writes those documents.

## Types (shared/types.ts)

- **GeneratedImage** — id, url, storagePath?, createdAt, aspectRatio?, inputTokens?, outputTokens?, promptId?, source? ('generated'|'search'), thumbnailUrl?, sourcePageUrl?, provider?.
- **ImagePrompt** — id, text, createdAt, isOriginal?, inputTokens?, outputTokens?.
- **Slide** — id, sortOrder, title, content[], imagePrompts?, currentPromptId?, generatedImages?, backgroundImage?, speakerNotes, layout?, aspectRatio?, updatedAt?; promptGenerationState?, promptGenerationError?, promptRequestId?.
- **ModelPricing** — id, modelName, modelType ('text'|'image'), inputPricePer1MTokens, outputPricePer1MTokens, effectiveDate, isActive, createdAt, updatedAt.
- **ProjectFile** — id, name, storagePath, downloadUrl, mimeType, size, extractedContent?.
- **ProjectData** — userId, title, topic, gradeLevel, subject; optional: additionalInstructions, files, token/cost fields, timestamps, generation fields (status, phase, message, error, requestId, etc.), shareToken, shareCreatedAt. slides usually from subcollection.

Firestore: project doc matches ProjectData; slides live in `projects/{id}/slides` as Slide docs. Use `any` for Firestore Timestamp fields where needed (updatedAt, createdAt, etc.).

## Errors (shared/errors.ts)

- **GeminiError** — message, code: 'TIMEOUT'|'RATE_LIMIT'|'BUSY'|'CIRCUIT_OPEN'|'INVALID_REQUEST'|'API_ERROR'|'UNKNOWN', isRetryable, details?. Backend maps to HTTP status (e.g. 429 for RATE_LIMIT).
- **ImageGenError** — message, code: 'NO_IMAGE_DATA'|'INVALID_MIME_TYPE'|'NETWORK'|'TIMEOUT'|'UNKNOWN', isRetryable, context?. Used by image generation and frontend when handling image errors.

When adding or changing error codes, update backend handlers (e.g. index.ts) and any frontend that switches on code or isRetryable.

## Constants (shared/constants.ts)

- **Defaults:** DEFAULT_BULLETS_PER_SLIDE (4), DEFAULT_NUM_SLIDES (5).
- **Models:** MODEL_SLIDE_GENERATION, MODEL_REPAIR_PASS, MODEL_SPEC_REGENERATION (e.g. gemini-3-flash-preview), MODEL_IMAGE_GENERATION (e.g. gemini-3-pro-image-preview).
- **STYLE_GUIDELINES** — multi-line string for image generation prompt; used only in functions.

Frontend may use default constants for form defaults; functions use model constants and STYLE_GUIDELINES. Changing model IDs or defaults can affect both; changing STYLE_GUIDELINES affects only backend.

## Validation & Retry

- **validateSlideStructure(slide, idx)** — Returns string[] of errors; requires title (string), content (array), speakerNotes; optional layout must be 'Title Slide'|'Content'. Used in slideGeneration after parsing JSON.
- **retryLogic** — retryWithBackoff (default 3 retries, deadline, RateLimiter), retryPromptGeneration (for single prompt), extractFirstJsonArray(text). Used by slideGeneration, imageGeneration, imageTextExtraction. See prompts-generation skill for usage details.

## Schemas (shared/schemas.ts)

- **SLIDES_SCHEMA** — JSON schema for slide array (title, content[], layout enum, speakerNotes). Used for documentation or validation; validateSlideStructure is the primary runtime check.

## Where to Look

- **Types and Firestore shape:** `shared/types.ts`; Firestore paths in backend skill.
- **Errors and HTTP mapping:** `shared/errors.ts`; `functions/src/index.ts` for status mapping.
- **Constants and models:** `shared/constants.ts`; `functions/src/services/modelMappingService.ts`.
- **Validation:** `shared/utils/validation.ts`; `shared/schemas.ts`.
- **Retry:** `shared/utils/retryLogic.ts`; used in slideGeneration, imageGeneration, imageTextExtraction.
- **Frontend re-exports:** `src/types.ts`, `src/constants.ts`.
