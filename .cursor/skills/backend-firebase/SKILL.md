---
name: backend-firebase
description: Applies the project's backend and Firebase patterns when editing Cloud Functions, API routes, auth, Firestore, or Storage. Use when making backend changes, editing files in functions/, changing API endpoints, auth middleware, rate limiting, or when discussing Firestore/Storage structure or secrets.
---

# Backend & Firebase Guidelines

When changing backend code (Cloud Functions, API, auth, data), follow the project's patterns.

## When to Use This Skill

- Editing files in `functions/` (index, middleware, services, utils)
- Adding or changing API routes, auth, or rate limiting
- Changing Firestore structure, Security Rules, or Storage usage
- Configuring Firebase or secrets (Gemini, Brave, admin)

## Stack Summary

- **Runtime:** Firebase Functions v2, Node 20, Express app behind `functions.https.onRequest`
- **Auth:** Firebase Google Sign-In; backend uses `verifyAuth` middleware and `admin.auth().verifyIdToken` (Bearer)
- **Data:** Firestore (projects/slides, shares, rateLimits, modelPricing); Firebase Storage (uploads, generated images)
- **Secrets:** `defineSecret()` for `ADMIN_USER_ID`, `BRAVE_API_KEY`, and Gemini API key (see `functions/src/utils/geminiClient.ts`)

## Key Patterns

1. **Routes** — All API routes live in `functions/src/index.ts`. Use `verifyAuth` and (where appropriate) `rateLimitMiddleware`; validate `projectId` and that the project belongs to `req.user.uid` before touching project/slides.
2. **Auth** — `AuthenticatedRequest` extends Express Request with `user?: DecodedIdToken`. Project path: `users/{userId}/projects/{projectId}`; always resolve `projectRef` from `userId` (from token) and validate project exists.
3. **Rate limit** — `rateLimitMiddleware` uses Firestore `rateLimits/{userId}` (e.g. 10 req/min). Applied to generate-slides, generate-image, extract-text, search-images; not on share/claim, share/preview, generate-prompt, or admin.
4. **Background work** — Long work (slide generation, prompt generation) returns 202 and runs in background; update Firestore on progress/error. Use `requestId`/`promptRequestId` for idempotency and retries.
5. **Errors** — Use shared errors from `@shared/errors` (e.g. `GeminiError`, `ImageGenError`) and map to appropriate HTTP status (429, 500, etc.).
6. **Firestore layout** — `users/{userId}/projects/{projectId}` (project doc + `slides` subcollection), `shares/{token}` (and `claims` subcollection), `rateLimits/{userId}`, `modelPricing/{id}`. Firestore trigger: `onDocumentCreated('users/{userId}/projects/{projectId}')` creates share link.

## API Surface (Reference)

- **POST** `/generate-slides` — auth + rate limit; 202 + background generation
- **POST** `/generate-image` — auth + rate limit
- **POST** `/generate-prompt` — auth; background prompt generation per slide
- **POST** `/search-images` — auth + rate limit; Brave search, one-time per slide
- **POST** `/extract-text` — auth + rate limit; OCR
- **POST** `/share/claim` — auth
- **GET** `/share/preview` — no auth
- **POST** `/admin/initialize-pricing` — auth + admin secret

Base URL: see README (emulator vs production).

## Where to Look

- **Routes and middleware:** `functions/src/index.ts`
- **Auth / rate limit:** `functions/src/middleware/auth.ts`, `rateLimiter.ts`
- **Business logic:** `functions/src/services/` (slideGeneration, imageGeneration, imageSearch, imageTextExtraction, shareService, pricingService, usageEventsService, modelMappingService)
- **Shared types/errors:** `shared/types.ts`, `shared/errors.ts` — keep request/response and error shapes in sync with the frontend.
