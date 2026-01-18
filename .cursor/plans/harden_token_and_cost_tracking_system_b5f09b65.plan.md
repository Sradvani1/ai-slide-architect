---
name: Harden Token and Cost Tracking System (Server-Authoritative)
overview: "Make token and cost tracking server-authoritative: remove client-side tracking, add server-side tracking in all Gemini functions, implement transaction-based idempotency with usageEvents, create model mapping service, and handle missing pricing via pending cost status."
todos:
  - id: model-mapping-service
    content: "Create modelMappingService.ts: Map operation types to model IDs server-side (text/image operations → model constants)"
    status: pending
  - id: usage-events-service
    content: "Create usageEventsService.ts: Implement recordUsageEvent() with Firestore transaction for idempotency, operation-specific token bounds validation, idempotencyKeySource tracking"
    status: pending
  - id: pricing-service-refactor
    content: "Update pricingService.ts: Use model mapping, integrate with usageEvents, handle costStatus: pending when pricing missing, reduce cache TTL to 1min, add invalidatePricingCache()"
    status: pending
  - id: slide-generation-endpoint-tracking
    content: "Update /generate-slides endpoint in index.ts: Generate requestId, call recordUsageEvent() after performUnifiedResearch() and performSlideGeneration() calls"
    status: pending
  - id: image-prompt-endpoint-tracking
    content: "Update /generate-prompt endpoint in index.ts: Generate requestId, call recordUsageEvent() after generateImagePrompts() call"
    status: pending
  - id: image-generation-endpoint-tracking
    content: "Update /generate-image endpoint in index.ts: Generate requestId, extract projectId, call recordUsageEvent() after generateImage() call"
    status: pending
  - id: text-extraction-endpoint-tracking
    content: "Update /extract-text endpoint in index.ts: Generate requestId, extract projectId, call recordUsageEvent() after extractTextFromImage() call"
    status: pending
  - id: remove-service-tracking
    content: Remove calculateAndIncrementProjectCost() calls from slideGeneration.ts (generateSlidesAndUpdateFirestore, generateImagePromptsForSingleSlide)
    status: pending
  - id: remove-increment-endpoint
    content: Remove /increment-project-tokens endpoint from index.ts (no longer needed, all tracking is server-side)
    status: pending
  - id: remove-frontend-tracking
    content: "Remove frontend token tracking: Delete incrementProjectTokens calls from Editor.tsx (text extraction) and SlideCard.tsx (image generation)"
    status: pending
  - id: pending-cost-processor
    content: "Create pendingCostProcessor.ts: Scheduled Cloud Function with transaction-based claiming (processing flag) to process usageEvents with costStatus: pending when pricing becomes available"
    status: pending
  - id: firestore-rules-update
    content: "Update firestore.rules: Add rules for usageEvents collection - deny all writes (Cloud Functions use Admin SDK), allow read where userId == request.auth.uid"
    status: pending
---

# Harden Token and Cost Tracking System (Server-Authoritative)

## Overview

This plan makes token and cost tracking **server-authoritative** by removing all client-side token reporting and implementing tracking directly in Firebase Functions after each Gemini API call. All Gemini operations are already routed through Firebase Functions, so tokens should be tracked server-side immediately after API responses.

## Architecture Changes

### 1. Server-Authoritative Token Tracking

**Principle**: All token tracking happens server-side immediately after Gemini API calls. The client never reports tokens.

**Implementation**: Each Gemini function extracts `usageMetadata` from API responses and records usage events atomically.

### 2. Usage Events Collection (Replaces pendingCostCalculations)

**New Firestore Collection:** `usageEvents`

- Document structure (document ID = `requestId`):
  ```typescript
  {
    requestId: string;           // Document ID, unique per operation (may be suffixed for multi-step)
    parentRequestId?: string;    // Base requestId for multi-step operations (e.g., '/generate-slides' base)
    userId: string;              // User ID (from Firebase Auth) - required for project path construction
    projectId: string;           // Required - all endpoints must accept projectId
    operationType: 'text' | 'image';  // Derived from operationKey via model mapping
    operationKey: string;       // 'slide-research' | 'slide-generation' | 'image-generation' | 'image-prompt' | 'text-extraction'
    sourceEndpoint?: string;    // Endpoint path for debugging (e.g., '/generate-image', '/generate-slides')
    modelKey: string;           // Server-determined model (from model mapping)
    inputTokens: number;
    outputTokens: number;
    costStatus: 'calculated' | 'pending';
    cost?: number;              // Only set when costStatus === 'calculated'
    pricingId?: string;         // Firestore doc ID from modelPricing collection (e.g., 'gemini-3-flash-preview')
    pricingVersion?: number;    // Milliseconds timestamp from pricing.updatedAt (consistent type for comparisons)
    idempotencyKeySource: 'client' | 'server';  // Track how base requestId was generated
    processing: boolean;         // For pending cost processor concurrency control (always false on creation)
    processingAt?: Timestamp;   // When pending cost processing started
    createdAt: Timestamp;
    processedAt?: Timestamp;
  }
  ```

### 3. Project Aggregates Schema

**Project Document Fields** (in `users/{userId}/projects/{projectId}`):
```typescript
{
  // Token aggregates (always updated immediately when event is created)
  textInputTokens?: number;      // Sum of all text operation input tokens
  textOutputTokens?: number;     // Sum of all text operation output tokens
  imageInputTokens?: number;     // Sum of all image operation input tokens
  imageOutputTokens?: number;    // Sum of all image operation output tokens
  
  // Cost aggregate (updated immediately if pricing available, backfilled later if pending)
  totalCost?: number;            // Sum of all calculated costs (USD)
  
  // Metadata
  updatedAt?: Timestamp;
}
```

**Update Rules**:
- **Token aggregates**: Always incremented immediately when `usageEvent` is created (regardless of `costStatus`)
- **Cost aggregate**: Only incremented when `costStatus === 'calculated'`; if `costStatus === 'pending'`, cost is backfilled later by pending cost processor

### 4. Transaction-Based Idempotency

**Firestore Transaction Pattern**:
```typescript
await db.runTransaction(async (transaction) => {
  const eventRef = db.collection('usageEvents').doc(requestId);
  const eventDoc = await transaction.get(eventRef);
  
  if (eventDoc.exists) {
    return; // Already processed, no-op (idempotent)
  }
  
  // Determine operation type via model mapping service (single source of truth)
  const operationType = getOperationType(operationKey);  // 'text' | 'image'
  
  // Build aggregate updates (tokens always updated, cost only if calculated)
  const aggregateUpdates: any = {
    updatedAt: FieldValue.serverTimestamp()
  };
  
  // Use operationType from mapping service (cannot drift)
  if (operationType === 'text') {
    aggregateUpdates.textInputTokens = FieldValue.increment(inputTokens);
    aggregateUpdates.textOutputTokens = FieldValue.increment(outputTokens);
  } else if (operationType === 'image') {
    aggregateUpdates.imageInputTokens = FieldValue.increment(inputTokens);
    aggregateUpdates.imageOutputTokens = FieldValue.increment(outputTokens);
  }
  
  if (costStatus === 'calculated' && cost !== undefined) {
    aggregateUpdates.totalCost = FieldValue.increment(cost);
  }
  
  // Create event and update project aggregates atomically
  transaction.set(eventRef, eventData);
  transaction.update(projectRef, aggregateUpdates);
});
```

**Idempotency Guarantee**: Clients may retry the same `requestId` on network timeout; server will no-op safely (at-least-once delivery with idempotent processing).

### 5. RequestId Strategy for Multi-Step Operations

**Convention**: For endpoints with multiple Gemini calls, use `baseRequestId + suffix` pattern:

- Base `requestId` generated/accepted at endpoint start
- Stable suffixes per sub-operation:
  - `'-research'` for research phase
  - `'-generation'` for slide generation phase
  - `'-prompt'` for image prompt generation
  - No suffix for single-step operations

**Example**: `/generate-slides` endpoint:
- Research: `requestId + '-research'`
- Generation: `requestId + '-generation'`

This ensures each Gemini call gets a unique `requestId` while maintaining traceability to the parent operation.

### 6. Model Mapping Service

**Server-side operation categorization** prevents client-provided `modelId` mismatches and ensures consistent operation type derivation:

```typescript
// Map operation key to model and operation type
const OPERATION_MAP = {
  'slide-research': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
  'slide-generation': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
  'image-prompt': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
  'text-extraction': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
  'image-generation': { modelKey: MODEL_IMAGE_GENERATION, operationType: 'image' },
};

// Functions:
getModelForOperation(operationKey: string): string
getOperationType(operationKey: string): 'text' | 'image'
```

This ensures `operationType` derivation is centralized and cannot drift from the operation mapping.

## Core Principle: Single Tracking Location

**Rule**: Token tracking happens **only in the endpoint** after the Gemini API call returns. Service functions return tokens in their response, but do NOT call `recordUsageEvent()` themselves. This ensures exactly one `recordUsageEvent()` call per Gemini operation and prevents double-tracking.

**Pattern**:
1. Endpoint generates/accepts `requestId` (or accepts from client for UI correlation)
2. Endpoint calls service function (e.g., `generateImage()`, `extractTextFromImage()`)
3. Service function calls Gemini API and returns `{ result, inputTokens, outputTokens }`
4. Endpoint calls `recordUsageEvent()` with tokens from response
5. Endpoint returns result to client

## Implementation Details

### Phase 1: Core Infrastructure

#### 1.1 Create Model Mapping Service

**File:** `functions/src/services/modelMappingService.ts` (new)

- Centralized mapping of operation keys to model and operation type:
  ```typescript
  export function getModelForOperation(operationKey: string): string
  export function getOperationType(operationKey: string): 'text' | 'image'
  ```
- Prevents client-provided modelId mismatches
- Ensures `operationType` derivation cannot drift from operation mapping
- Single source of truth for operation categorization

#### 1.2 Create Usage Events Service

**File:** `functions/src/services/usageEventsService.ts` (new)

- `recordUsageEvent()` function signature:
  ```typescript
  recordUsageEvent(params: {
    requestId: string;              // Required, document ID (may be suffixed for multi-step)
    parentRequestId?: string;       // Optional, base requestId for multi-step operations
    userId: string;                 // Required, from Firebase Auth (for project path construction)
    projectId: string;              // Required
    operationKey: string;           // Required, e.g., 'slide-research'
    sourceEndpoint?: string;        // Optional, endpoint path for debugging (e.g., '/generate-image')
    inputTokens: number;            // Required, validated
    outputTokens: number;           // Required, validated
    idempotencyKeySource: 'client' | 'server';  // Required, based on base requestId source
  }): Promise<void>
  ```
  - Implementation:
  - Firestore transaction for idempotency check (`usageEvents/{requestId}`)
  - If event exists → no-op (idempotent, return early)
  - If not exists → continue
  - Validate tokens with operation-specific bounds (see Phase 6.1)
  - Determine `modelKey` and `operationType` via model mapping service (single source of truth)
  - Lookup pricing for `modelKey`
  - Determine aggregate fields based on `operationType` from mapping:
    - `'text'` → `textInputTokens`, `textOutputTokens`
    - `'image'` → `imageInputTokens`, `imageOutputTokens`
  - If pricing missing:
    - Create event with `costStatus: 'pending'`
    - Update project token aggregates immediately (determined from `operationType`)
    - Do NOT update `totalCost` (will be backfilled later)
  - If pricing available:
    - Calculate cost using pricing
    - Convert `pricing.updatedAt` to milliseconds: `pricingVersion = pricing.updatedAt.toMillis()`
    - Create event with `costStatus: 'calculated'`, `cost`, `pricingId` (pricing doc ID), `pricingVersion` (milliseconds number, not Timestamp)
    - Update project token aggregates AND `totalCost` immediately
  - Transaction: Create `usageEvents/{requestId}` + Update project aggregates atomically
  - **HARD REQUIREMENT**: Always set `processing: false` on event creation (explicit boolean, required for Query 1 to work correctly)
  - Event creation must include: `processing: false` in the event data (not optional, always written)
  - This ensures Query 1 (`processing == false`) correctly finds all unprocessed pending events
  - Note: `parentRequestId` set only for suffixed `requestId` values (multi-step operations)
  - Store `userId` in event (required for pending cost processor to construct project path)
  - Store `sourceEndpoint` in event (optional, for debugging)

#### 1.3 Refactor Pricing Service

**File:** `functions/src/services/pricingService.ts`

- Remove client `modelId` parameter, use `modelKey` from model mapping
- **Pricing Contract**: When pricing is found, return:
  - `pricingId`: Firestore document ID from `modelPricing` collection (e.g., `'gemini-3-flash-preview'`)
  - `pricingVersion`: Milliseconds number from `pricing.updatedAt.toMillis()` (convert Firestore Timestamp to number for consistent comparisons and storage)
- Integrate with `usageEventsService.recordUsageEvent()`
- Update `calculateAndIncrementProjectCost()` to:
  - Accept `requestId` (required)
  - Accept `operationKey` instead of `operationType`
  - Use model mapping to determine `modelKey`
  - Check `usageEvents/{requestId}` exists (via transaction)
  - Set `costStatus: 'pending'` when pricing missing
  - When pricing available, include `pricingId` and `pricingVersion` in event
  - Use Firestore transaction for atomic updates
- Reduce cache TTL from 5 minutes to 1 minute
- Add `invalidatePricingCache()` function

### Phase 2: Authentication and Authorization Requirements

**File:** `functions/src/index.ts` (all Gemini endpoints)

**Authorization Pattern** (applies to ALL Gemini endpoints):
```typescript
// 1. Verify Firebase Auth (already done by verifyAuth middleware)
// 2. Extract userId from req.user.uid (from verifyAuth)
// 3. Extract projectId from request body
// 4. Verify project exists and belongs to authenticated user:
const userId = req.user.uid;
const projectId = req.body.projectId;
const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

const projectDoc = await projectRef.get();
if (!projectDoc.exists) {
  res.status(404).json({ error: "Project not found or unauthorized" });
  return;
}

// 5. Only after AuthZ check, proceed to call Gemini API
```

**Required on all endpoints**: `/generate-slides`, `/generate-image`, `/extract-text`, `/generate-prompt`

### Phase 3: Update Service Functions to Return Tokens

**Principle**: Service functions extract tokens from Gemini responses and return them, but do NOT call `recordUsageEvent()`. Tracking happens in endpoints.

#### 3.1 Slide Generation Service

**File:** `functions/src/services/slideGeneration.ts`

**Update `performUnifiedResearch()`**:
- Keep existing token extraction (lines 102-103)
- Return tokens in `ResearchResult` (already present)
- Do NOT call `recordUsageEvent()` here

**Update `performSlideGeneration()`**:
- Keep existing token extraction (lines 170-171)
- Return tokens in `GenerationResult` (already present)
- Do NOT call `recordUsageEvent()` here

**Update `generateImagePromptsForSingleSlide()`**:
- Remove existing `calculateAndIncrementProjectCost()` call (line 728)
- `generateImagePrompts()` already returns tokens
- Do NOT call `recordUsageEvent()` here

**Update `generateSlidesAndUpdateFirestore()`**:
- Remove existing `calculateAndIncrementProjectCost()` call (line 625)
- Token tracking will happen in `/generate-slides` endpoint

**Update `/generate-slides` endpoint** in `index.ts`:
- **AuthZ**: Verify Firebase Auth (via `verifyAuth` middleware), extract `userId` from `req.user.uid`, verify `projectId` exists and belongs to user (see Phase 2)
- Generate base `requestId` at endpoint start (or accept from client via `requestId` in body)
- Determine `idempotencyKeySource: requestId from client ? 'client' : 'server'`
- After `performUnifiedResearch()` call:
  - Call `recordUsageEvent()` with:
    - `requestId: baseRequestId + '-research'` (standard suffix)
    - `parentRequestId: baseRequestId` (for traceability)
    - `userId` from `req.user.uid`
    - `projectId` from request (REQUIRED, validated)
    - `operationKey: 'slide-research'`
    - `sourceEndpoint: '/generate-slides'` (for debugging)
    - `inputTokens`, `outputTokens` from research result
    - `idempotencyKeySource` (based on base requestId source)
- After `performSlideGeneration()` call:
  - Call `recordUsageEvent()` with:
    - `requestId: baseRequestId + '-generation'` (standard suffix)
    - `parentRequestId: baseRequestId` (for traceability)
    - `userId` from `req.user.uid`
    - `projectId` from request (REQUIRED, validated)
    - `operationKey: 'slide-generation'`
    - `sourceEndpoint: '/generate-slides'` (for debugging)
    - `inputTokens`, `outputTokens` from generation result
    - `idempotencyKeySource` (based on base requestId source)

**Update `/generate-prompt` endpoint** in `index.ts`:
- **AuthZ**: Verify Firebase Auth (via `verifyAuth` middleware), extract `userId` from `req.user.uid`, verify `projectId` exists and belongs to user (endpoint already validates, ensure consistency with Phase 2 pattern)
- Generate `requestId` at endpoint start
- After `generateImagePrompts()` call (in `generateImagePromptsForSingleSlide()`):
  - Extract tokens from result
  - Call `recordUsageEvent()` with:
    - `requestId` (no suffix for single-step operation)
    - `userId` from `req.user.uid`
    - `projectId` from request (already validated)
    - `operationKey: 'image-prompt'`
    - `sourceEndpoint: '/generate-prompt'` (for debugging)
    - `inputTokens`, `outputTokens` from result
    - `idempotencyKeySource: 'server'`

#### 3.2 Image Generation Service

**File:** `functions/src/services/imageGeneration.ts`

**Update `generateImage()`**:
- Keep existing token extraction (lines 60-61)
- Return tokens in response (already present)
- Do NOT call `recordUsageEvent()` here
- Do NOT accept `projectRef` parameter

**Update `generateImagePrompts()`**:
- Keep existing token extraction (lines 121-122)
- Return tokens in `PromptGenerationResult` (already present)
- Do NOT call `recordUsageEvent()` here

**Update `/generate-image` endpoint** in `index.ts`:
- **AuthZ**: Verify Firebase Auth (via `verifyAuth` middleware), extract `userId` from `req.user.uid`, **REQUIRE `projectId` in request body** (validation error if missing), verify project exists and belongs to user (see Phase 2)
- Generate `requestId` at endpoint start (or accept from client)
- After `generateImage()` call:
  - Call `recordUsageEvent()` with:
    - `requestId` (no suffix for single-step operation)
    - `userId` from `req.user.uid`
    - `projectId` from request (REQUIRED, validated)
    - `operationKey: 'image-generation'`
    - `sourceEndpoint: '/generate-image'` (for debugging)
    - `inputTokens`, `outputTokens` from response
    - `idempotencyKeySource: requestId from client ? 'client' : 'server'`

#### 3.3 Text Extraction Service

**File:** `functions/src/services/imageTextExtraction.ts`

**Update `extractTextFromImage()`**:
- Keep existing token extraction (lines 63-64)
- Return tokens in response (already present)
- Do NOT call `recordUsageEvent()` here
- Do NOT accept `projectRef` parameter

**Update `/extract-text` endpoint** in `index.ts`:
- **AuthZ**: Verify Firebase Auth (via `verifyAuth` middleware), extract `userId` from `req.user.uid`, **REQUIRE `projectId` in request body** (validation error if missing), verify project exists and belongs to user (see Phase 2)
- Generate `requestId` at endpoint start (or accept from client)
- After `extractTextFromImage()` call:
  - Call `recordUsageEvent()` with:
    - `requestId` (no suffix for single-step operation)
    - `userId` from `req.user.uid`
    - `projectId` from request (REQUIRED, validated)
    - `operationKey: 'text-extraction'`
    - `sourceEndpoint: '/extract-text'` (for debugging)
    - `inputTokens`, `outputTokens` from response
    - `idempotencyKeySource: requestId from client ? 'client' : 'server'`

### Phase 4: Remove Client-Side Tracking

#### 4.1 Remove Increment Tokens Endpoint

**File:** `functions/src/index.ts`

- Delete `/increment-project-tokens` endpoint (lines 190-227)
- Remove `incrementProjectTokens` import from `geminiService.ts` usage

#### 4.2 Remove Frontend Token Tracking

**File:** `src/components/Editor.tsx`

- Remove `incrementProjectTokens` import
- Remove token tracking call after text extraction (lines 243-256)
- Text extraction tokens now tracked server-side in `/extract-text` endpoint

**File:** `src/components/SlideCard.tsx`

- Remove `incrementProjectTokens` import
- Remove token tracking call after image generation (lines 158-164)
- Image generation tokens now tracked server-side in `/generate-image` endpoint

**File:** `src/services/geminiService.ts`

- Remove `incrementProjectTokens()` function (lines 254-268)

### Phase 5: Pending Cost Processing

#### 5.1 Create Pending Cost Processor

**File:** `functions/src/services/pendingCostProcessor.ts` (new)

- `processPendingUsageEvents()` function:
  - **Query Implementation (Option B - Two Queries)**:
    - Firestore cannot do arbitrary OR logic in a single query
    - Run two queries with limits and ordering (bounded runtime per scheduled run):
      1. Query 1: `usageEvents` where `costStatus === 'pending'` AND `processing == false` ORDER BY `createdAt` ASC LIMIT 100
      2. Query 2: `usageEvents` where `costStatus === 'pending'` AND `processing === true` AND `processingAt < (now - 15 minutes)` ORDER BY `processingAt` ASC, `createdAt` ASC LIMIT 100
      - **Note**: First `orderBy` must be on `processingAt` (same field as inequality filter) per Firestore requirements
    - Merge query results (deduplicate by `requestId` if needed)
    - The 15-minute timeout allows re-claiming stuck events (e.g., from crashed processor)
    - **Bounded Runtime**: Each scheduled run processes at most 200 events (100 per query), preventing long runtimes from backlog
  - For each event, use Firestore transaction to claim work:
    ```typescript
    await db.runTransaction(async (transaction) => {
      const eventRef = db.collection('usageEvents').doc(eventId);
      const eventDoc = await transaction.get(eventRef);
      const eventData = eventDoc.data();
      
      // Check if already processed (MUST check in transaction to avoid double increments)
      if (eventData?.costStatus !== 'pending') {
        return null; // Already processed, skip
      }
      
      // Check if currently processing (and not stuck)
      const processingAt = eventData?.processingAt?.toMillis();
      const isStuck = processingAt && (Date.now() - processingAt > 15 * 60 * 1000);
      
      if (eventData?.processing && !isStuck) {
        return null; // Currently processing, skip
      }
      
      // Claim this event (or re-claim if stuck)
      transaction.update(eventRef, {
        processing: true,
        processingAt: FieldValue.serverTimestamp()
      });
      
      return eventData;
    });
    ```
  - If claimed, lookup pricing for `modelKey`
  - If pricing available:
    - Calculate cost using pricing
    - Use Firestore transaction to update event AND project (atomic):
      ```typescript
      await db.runTransaction(async (transaction) => {
        const eventRef = db.collection('usageEvents').doc(eventId);
        const eventDoc = await transaction.get(eventRef);
        const eventData = eventDoc.data();
        
        // CRITICAL: Check event is still pending (prevent double increment if race occurs)
        if (eventData?.costStatus !== 'pending') {
          return; // Already processed by another worker, skip
        }
        
        // Convert pricing.updatedAt to milliseconds (consistent type)
        // If updatedAt is missing, skip this event and log (preserve audit comparability)
        if (!pricing.updatedAt) {
          console.error(`[pendingCostProcessor] Pricing ${pricing.id} missing updatedAt, skipping event ${eventId}`);
          // Clear processing flag and processingAt for retry, but do not update costStatus
          transaction.update(eventRef, { 
            processing: false,
            processingAt: admin.firestore.FieldValue.delete()  // Clear to avoid confusion during debugging
          });
          return;
        }
        const pricingVersion = pricing.updatedAt.toMillis();
        
        // Update event
        transaction.update(eventRef, {
          costStatus: 'calculated',
          cost: calculatedCost,
          pricingId: pricing.id,
          pricingVersion: pricingVersion,  // Milliseconds number (not Timestamp)
          processing: false,
          processedAt: FieldValue.serverTimestamp()
        });
        
        // Update project totalCost (atomic with event update)
        // Use userId from event (stored when event was created)
        const projectRef = db.collection('users').doc(eventData.userId).collection('projects').doc(eventData.projectId);
        transaction.update(projectRef, {
          totalCost: FieldValue.increment(calculatedCost),
          updatedAt: FieldValue.serverTimestamp()
        });
      });
      ```
  - If pricing still missing:
    - Clear `processing` flag (will retry on next scheduled run)
    - Do NOT update `costStatus` (remains 'pending')

#### 5.2 Scheduled Cloud Function

**File:** `functions/src/index.ts`

- Add scheduled function (runs every 5 minutes):
  ```typescript
  export const processPendingCosts = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
      await processPendingUsageEvents();
    });
  ```

**Firestore Index Requirements**:
- **Query 1**: `usageEvents` where `costStatus === 'pending'` AND `processing == false` ORDER BY `createdAt` ASC LIMIT 100
  - **Required Composite Index 1**:
    ```
    Collection: usageEvents
    Fields: costStatus (Ascending), processing (Ascending), createdAt (Ascending)
    ```
- **Query 2**: `usageEvents` where `costStatus === 'pending'` AND `processing === true` AND `processingAt < timestamp` ORDER BY `processingAt` ASC, `createdAt` ASC LIMIT 100
  - **Firestore Requirement**: When using inequality filter (`processingAt < timestamp`), first `orderBy` must be on the same field (`processingAt`)
  - **Required Composite Index 2**:
    ```
    Collection: usageEvents
    Fields: costStatus (Ascending), processing (Ascending), processingAt (Ascending), createdAt (Ascending)
    ```
  - Index field order matches query: equality filters first (`costStatus`, `processing`), then inequality field (`processingAt`), then secondary sort (`createdAt`)
- Add both indexes to `firestore.indexes.json` or create via Firebase Console to avoid deployment surprises
- Indexes required because queries use multiple equality/range conditions on different fields
- Firestore cannot do arbitrary OR logic, so two queries are merged (Option B implementation)

**File:** `functions/src/index.ts`

- Add scheduled function (runs every 5 minutes):
  ```typescript
  export const processPendingCosts = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
      await processPendingUsageEvents();
    });
  ```

### Phase 6: Enhanced Validation and Audit

#### 6.1 Token Validation (Operation-Specific Bounds)

**File:** `functions/src/services/usageEventsService.ts`

- Validate tokens in `recordUsageEvent()` with operation-specific bounds:
  ```typescript
  const TOKEN_BOUNDS = {
    'slide-research': { maxInput: 1_000_000, maxOutput: 500_000 },
    'slide-generation': { maxInput: 500_000, maxOutput: 1_000_000 },
    'image-prompt': { maxInput: 50_000, maxOutput: 10_000 },
    'image-generation': { maxInput: 100_000, maxOutput: 50_000 },
    'text-extraction': { maxInput: 200_000, maxOutput: 50_000 },
  };
  ```
- Validation checks:
  - Finite numbers (not NaN, Infinity)
  - Non-negative values
  - Operation-specific upper bounds (per `TOKEN_BOUNDS`)
  - Proper number types (integers)

#### 6.2 Audit Trail

**File:** `functions/src/services/usageEventsService.ts`

- `usageEvents` collection serves as audit log
- All operations recorded with full context
- Enables reconciliation and debugging

#### 6.3 Firestore Security Rules

**File:** `firestore.rules`

- Add rules for `usageEvents` collection (top-level collection):
  ```javascript
  // Usage Events (Audit Log)
  match /usageEvents/{eventId} {
    // Deny all client writes (Cloud Functions use Admin SDK)
    allow write: if false;
    
    // Allow user reads only for events with matching userId
    allow read: if request.auth != null && 
      resource.data.userId == request.auth.uid;
  }
  ```

- **Rationale**:
  - All writes via Cloud Functions (Admin SDK bypasses rules)
  - Client reads restricted to user's own events (`userId == request.auth.uid`)
  - Prevents unauthorized access to other users' usage data
  - **IMPORTANT**: Client queries MUST filter by `userId == request.auth.uid` to satisfy rules (top-level collection requires field-based filtering)

## Data Flow

```
Endpoint receives request (with optional requestId from client)
  ↓
Generate baseRequestId if not provided (crypto.randomUUID())
  ↓
For multi-step operations: append standard suffix (e.g., '-research', '-generation')
  ↓
Call service function (e.g., generateImage(), extractTextFromImage())
  ↓
Service function calls Gemini API
  ↓
Service function extracts usageMetadata tokens
  ↓
Service function returns { result, inputTokens, outputTokens }
  ↓
Endpoint calls recordUsageEvent({ requestId, projectId, operationKey, ... })
  ↓
Transaction: Check usageEvents/{requestId} exists
  ↓
If exists → No-op (idempotent, return early) [Client retry safe]
  ↓
If not exists → Continue
  ↓
Validate tokens (operation-specific bounds)
  ↓
Determine modelKey via model mapping (operationKey → modelKey)
  ↓
Lookup pricing for modelKey (with cache)
  ↓
If pricing missing:
  - Create event with costStatus: 'pending'
  - Update project token aggregates immediately (textInputTokens/textOutputTokens or imageInputTokens/imageOutputTokens)
  - Do NOT update totalCost (will be backfilled later)
  ↓
If pricing available:
  - Calculate cost using pricing
  - Create event with costStatus: 'calculated', cost, pricingId, pricingVersion
  - Update project token aggregates AND totalCost immediately
  ↓
Transaction: Create usageEvents/{requestId} + Update project aggregates atomically
  ↓
Return result to client
```

**Pending Cost Backfill Flow** (Scheduled Function):
```
Scheduled function runs (every 5 minutes)
  ↓
Run TWO queries (with limits) and merge results:
  1. Query: costStatus === 'pending' AND processing == false ORDER BY createdAt ASC LIMIT 100
  2. Query: costStatus === 'pending' AND processing === true AND processingAt < (now - 15min) ORDER BY processingAt ASC, createdAt ASC LIMIT 100
  ↓
For each event: Transaction to claim (set processing: true, processingAt)
  ↓
Lookup pricing for modelKey
  ↓
If pricing available:
  - Calculate cost
  - Transaction: Update event (costStatus: 'calculated', cost, pricingId, pricingVersion, clear processing)
  - Transaction: Increment project totalCost aggregate
  ↓
If pricing still missing:
  - Clear processing flag (will retry on next run)
```

## Edge Cases Handled

1. **Missing Pricing**: Event created with `costStatus: 'pending'`, token aggregates updated immediately, cost backfilled later by scheduled function
2. **Duplicate Requests**: Transaction checks `usageEvents/{requestId}` existence, no-op if found (idempotent)
3. **Client Retries**: Clients may retry same `requestId` on network timeout; server safely no-ops (at-least-once delivery with idempotent processing)
4. **Pending Cost Processor Race**: Transaction checks event is still `pending` before updating cost status and incrementing `totalCost`, preventing double increments
5. **Concurrent Updates**: Firestore transactions ensure atomicity
6. **Invalid Tokens**: Validation rejects bad data before recording (operation-specific bounds)
7. **Cache Staleness**: Reduced TTL (1 minute) and invalidation support
8. **Model Mismatches**: Server-side model mapping prevents client errors
9. **Operation Type Drift**: Centralized model mapping service ensures `operationType` derivation cannot drift from operation categorization
10. **Stuck Processing Flags**: 15-minute timeout allows re-claiming events from crashed processors
11. **Audit Trail**: `usageEvents` collection provides complete history with `pricingId`, `pricingVersion` (milliseconds number), `parentRequestId`, `sourceEndpoint`, and `userId` for deterministic comparisons and multi-step traceability
12. **Missing ProjectId**: All endpoints require `projectId` with AuthZ validation, ensuring proper usage attribution and preventing uncharged operations
13. **Pending Cost Processor userId**: Events store `userId` when created, allowing processor to construct project path (`users/{userId}/projects/{projectId}`) without additional lookups
14. **Firestore Index Requirements**: Pending cost processor requires TWO composite indexes (one per query) on `costStatus`+`processing` and `costStatus`+`processing`+`processingAt` to avoid deployment surprises
15. **Firestore Rules**: `usageEvents` collection denies all client writes (Cloud Functions use Admin SDK), allows user reads where `userId == request.auth.uid` (top-level collection access control)

## Testing Considerations

- Test duplicate requestId handling (transaction no-op)
- Test missing pricing (costStatus: pending)
- Test pending cost processor (backfill when pricing available)
- Test concurrent cost updates (transaction conflicts)
- Test model mapping correctness
- Test token validation (invalid values)
- Test all Gemini functions track tokens correctly

## Client Guidance

**RequestId Handling**:
- Clients may optionally provide `requestId` in request body for UI correlation
- If not provided, server generates `requestId` automatically
- Clients may retry the same `requestId` on network timeout; server will safely no-op (idempotent)
- For multi-step operations (e.g., `/generate-slides`), server appends standard suffixes (`-research`, `-generation`)
- Multi-step operations store `parentRequestId` for traceability

**ProjectId Requirement**:
- **ALL Gemini endpoints require `projectId` in request body** (`/generate-slides`, `/generate-image`, `/extract-text`, `/generate-prompt`)
- **Authorization Pattern** (all endpoints):
  1. Verify Firebase Auth (via `verifyAuth` middleware)
  2. Extract `userId` from `req.user.uid`
  3. Extract `projectId` from request body
  4. Verify project document exists and belongs to authenticated user: `users/{userId}/projects/{projectId}`
  5. Only after AuthZ check, proceed to call Gemini API
- This ensures proper usage attribution and prevents "tokens tracked but not charged correctly" scenarios

**At-Least-Once Delivery**:
- Network timeouts may cause clients to retry
- Server uses `usageEvents/{requestId}` transaction check to ensure idempotency
- Same `requestId` processed exactly once, even if client retries multiple times

## Pre-Implementation Checklist

### Firestore Indexes
**REQUIREMENT**: Both composite indexes MUST be added before deployment to avoid query failures.

- [ ] **Add Composite Index 1** to `firestore.indexes.json`:
  ```
  Collection: usageEvents
  Fields: costStatus (Ascending), processing (Ascending), createdAt (Ascending)
  ```
  Required for Query 1: `costStatus == 'pending' AND processing == false ORDER BY createdAt ASC LIMIT 100`

- [ ] **Add Composite Index 2** to `firestore.indexes.json`:
  ```
  Collection: usageEvents
  Fields: costStatus (Ascending), processing (Ascending), processingAt (Ascending), createdAt (Ascending)
  ```
  Required for Query 2: `costStatus == 'pending' AND processing == true AND processingAt < timestamp ORDER BY processingAt ASC, createdAt ASC LIMIT 100`

### AuthZ Verification Pattern
**REQUIREMENT**: Every Gemini endpoint MUST verify `users/{uid}/projects/{projectId}` exists before calling Gemini API.

- [ ] Verify `/generate-slides` endpoint performs AuthZ pattern:
  1. Firebase Auth via `verifyAuth` middleware
  2. Extract `userId` from `req.user.uid`
  3. Extract `projectId` from request body
  4. Verify `users/{userId}/projects/{projectId}` exists (project document lookup)
  5. Only then call Gemini API

- [ ] Verify `/generate-image` endpoint performs AuthZ pattern (same as above)

- [ ] Verify `/extract-text` endpoint performs AuthZ pattern (same as above)

- [ ] Verify `/generate-prompt` endpoint performs AuthZ pattern (same as above)

### Frontend Query Requirements
- [ ] If frontend queries `usageEvents` collection, ensure query **ALWAYS** includes:
  ```typescript
  .where('userId', '==', auth.currentUser.uid)
  ```
  This is required to satisfy Firestore rules (top-level collection requires field-based filtering)

### Event Creation Requirements
- [ ] Verify `recordUsageEvent()` **always** sets `processing: false` on event creation (hard requirement - see Section 1.2)
- [ ] Confirm Query 1 uses exactly: `costStatus == 'pending' AND processing == false` (not `!= true`)
- [ ] Confirm Query 2 uses exactly: `costStatus == 'pending' AND processing == true AND processingAt < timestamp ORDER BY processingAt ASC, createdAt ASC LIMIT 100`
- [ ] Verify Query 2's first `orderBy` is on `processingAt` (required by Firestore when using inequality filter on that field)
- [ ] Verify both queries include `ORDER BY createdAt ASC LIMIT 100` for bounded runtime

## Migration Notes

- Existing projects continue to work
- Pending usage events processed when pricing becomes available
- `requestId` is required (auto-generated at endpoint if not provided by client)
- Frontend no longer needs token tracking code
- `/increment-project-tokens` endpoint removed (no longer needed)
- Service functions return tokens but do not track (endpoints handle tracking)
- All tracking happens in endpoints to ensure exactly one `recordUsageEvent()` call per Gemini operation
- Token aggregates always updated immediately; cost aggregate only updated when pricing available (or backfilled later)