---
name: token_aggregation_and_cost_tracking
overview: Implement comprehensive token aggregation strategy with separate tracking for text and image operations, create a pricing collection for model costs, and calculate costs in real-time when tokens are recorded.
todos:
  - id: create_pricing_types
    content: Add ModelPricing interface to shared/types.ts with model identifier, pricing rates, and metadata fields
    status: pending
  - id: update_project_interface
    content: Update ProjectData interface in projectService.ts to include textInputTokens, textOutputTokens, imageInputTokens, imageOutputTokens, and totalCost fields
    status: pending
  - id: create_pricing_service
    content: Create pricingService.ts with functions to fetch model pricing, calculate costs, and increment project tokens/costs atomically
    status: pending
  - id: update_slide_generation
    content: Update generateSlidesAndUpdateFirestore() to use calculateAndIncrementProjectCost() instead of direct token storage
    status: pending
  - id: create_increment_endpoint
    content: Create POST /increment-project-tokens endpoint in index.ts for frontend to aggregate tokens after operations
    status: pending
  - id: update_prompt_regeneration
    content: Update /regenerate-image-prompt endpoint to call calculateAndIncrementProjectCost() for text tokens
    status: pending
  - id: update_image_generation
    content: Update handleGenerateImage() in SlideCard.tsx to call incrementProjectTokens() after image generation
    status: pending
  - id: update_new_idea
    content: Update handleNewIdea() in SlideCard.tsx to call incrementProjectTokens() after prompt regeneration
    status: pending
  - id: add_gemini_service_function
    content: Add incrementProjectTokens() function to geminiService.ts to call the backend endpoint
    status: pending
  - id: initialize_pricing_data
    content: Create initialization script/function to populate modelPricing collection with current model pricing
    status: pending
  - id: update_firestore_rules
    content: Add Firestore rules for modelPricing collection (read-only for authenticated users)
    status: pending
  - id: display_cost_dashboard
    content: Update Dashboard.tsx to display totalCost on each project card in the metadata row, format as currency (e.g., $0.05)
    status: pending
---

# Token Aggregation and Cost Tracking Implementation

## Overview

Implement a comprehensive token tracking and cost calculation system that:

1. Separates text operations (slide generation + prompt regeneration) from image operations
2. Aggregates tokens at the project level for efficient billing queries
3. Creates a pricing collection to store model input/output rates
4. Calculates and stores costs in real-time when tokens are recorded
5. Displays the total running cost on each project card in the dashboard

## Architecture

### Data Flow

```javascript
Operation (Slide Gen / Prompt Regen / Image Gen)
  └─> Extract tokens from API response
  └─> Determine operation type (text vs image)
  └─> Increment project-level token aggregates
  └─> Lookup model pricing from Firestore
  └─> Calculate cost (inputTokens * inputRate + outputTokens * outputRate)
  └─> Store cost in project document
```



### Token Aggregation Structure

**Project Level:**

- `textInputTokens`: Sum of all text operation input tokens
- `textOutputTokens`: Sum of all text operation output tokens
- `imageInputTokens`: Sum of all image operation input tokens
- `imageOutputTokens`: Sum of all image operation output tokens
- `totalCost`: Calculated cost in USD (or preferred currency)

**Per-Item Level (for auditability):**

- `ImagePrompt.inputTokens` / `outputTokens` (already exists)
- `GeneratedImage.inputTokens` / `outputTokens` (already exists)
- Slide generation tokens stored at project level (already exists)

## Implementation

### 1. Create Pricing Collection Structure

**File:** `shared/types.ts` (or new file `shared/pricing.ts`)Add interface for model pricing:

```typescript
export interface ModelPricing {
    id: string;                    // Model identifier (e.g., "gemini-3-flash-preview")
    modelName: string;             // Display name
    modelType: 'text' | 'image';   // Operation type
    inputPricePer1MTokens: number; // Price per 1M input tokens (e.g., 0.075)
    outputPricePer1MTokens: number;// Price per 1M output tokens (e.g., 0.30)
    effectiveDate: number;         // Timestamp when pricing became effective
    isActive: boolean;             // Whether this pricing is currently active
    createdAt: number;
    updatedAt: number;
}
```

**Firestore Collection:** `modelPricing`

- Document ID: model identifier (e.g., `gemini-3-flash-preview`)
- Structure: One document per model with active pricing

### 2. Update ProjectData Interface

**File:** `src/services/projectService.ts`Update `ProjectData` interface:

```typescript
export interface ProjectData {
    // ... existing fields ...
    
    // Token Aggregation (separated by operation type)
    textInputTokens?: number;      // Slide generation + prompt regeneration
    textOutputTokens?: number;
    imageInputTokens?: number;     // Image generation only
    imageOutputTokens?: number;
    
    // Cost Tracking
    totalCost?: number;             // Total cost in USD (calculated in real-time)
    
    // Legacy fields (deprecated, but keep for now)
    inputTokens?: number;           // Old aggregate (deprecated)
    outputTokens?: number;          // Old aggregate (deprecated)
}
```



### 3. Create Pricing Service

**File:** `functions/src/services/pricingService.ts` (new file)Create service to:

- Fetch model pricing from Firestore
- Calculate cost from tokens
- Handle pricing lookups efficiently
```typescript
import * as admin from 'firebase-admin';
import { ModelPricing } from '@shared/types';

const PRICING_CACHE = new Map<string, ModelPricing>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getModelPricing(modelId: string): Promise<ModelPricing | null> {
    // Check cache first
    const cached = PRICING_CACHE.get(modelId);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL) {
        return cached;
    }
    
    // Fetch from Firestore
    const db = admin.firestore();
    const pricingDoc = await db.collection('modelPricing').doc(modelId).get();
    
    if (!pricingDoc.exists) {
        console.warn(`No pricing found for model: ${modelId}`);
        return null;
    }
    
    const pricing = { id: pricingDoc.id, ...pricingDoc.data() } as ModelPricing;
    PRICING_CACHE.set(modelId, pricing);
    return pricing;
}

export function calculateCost(
    inputTokens: number,
    outputTokens: number,
    pricing: ModelPricing
): number {
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePer1MTokens;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1MTokens;
    return inputCost + outputCost;
}

export async function calculateAndIncrementProjectCost(
    projectRef: admin.firestore.DocumentReference,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    operationType: 'text' | 'image'
): Promise<number> {
    const pricing = await getModelPricing(modelId);
    if (!pricing) {
        console.warn(`Cannot calculate cost: No pricing for ${modelId}`);
        return 0;
    }
    
    const cost = calculateCost(inputTokens, outputTokens, pricing);
    
    // Increment project tokens and cost atomically
    const updateData: any = {
        totalCost: admin.firestore.FieldValue.increment(cost),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (operationType === 'text') {
        updateData.textInputTokens = admin.firestore.FieldValue.increment(inputTokens);
        updateData.textOutputTokens = admin.firestore.FieldValue.increment(outputTokens);
    } else {
        updateData.imageInputTokens = admin.firestore.FieldValue.increment(inputTokens);
        updateData.imageOutputTokens = admin.firestore.FieldValue.increment(outputTokens);
    }
    
    await projectRef.update(updateData);
    return cost;
}
```




### 4. Update Slide Generation

**File:** `functions/src/services/slideGeneration.ts`Update `generateSlidesAndUpdateFirestore()` to use new aggregation:

```typescript
// Around line 297, replace:
await projectRef.update({
    status: 'completed',
    generationProgress: 100,
    sources: result.sources || [],
    inputTokens: result.inputTokens,  // ❌ Remove old fields
    outputTokens: result.outputTokens, // ❌ Remove old fields
    generationCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
});

// With:
import { calculateAndIncrementProjectCost } from './pricingService';
import { MODEL_SLIDE_GENERATION } from '@shared/constants';

await calculateAndIncrementProjectCost(
    projectRef,
    MODEL_SLIDE_GENERATION,
    result.inputTokens,
    result.outputTokens,
    'text'
);

await projectRef.update({
    status: 'completed',
    generationProgress: 100,
    sources: result.sources || [],
    generationCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
});
```



### 5. Update Image Prompt Regeneration

**File:** `functions/src/index.ts`Update `/regenerate-image-prompt` endpoint to aggregate tokens:

```typescript
// After line 199 (after regenerateImagePrompt call):
import { calculateAndIncrementProjectCost } from '../services/pricingService';
import { MODEL_SLIDE_GENERATION } from '@shared/constants';

// Get project reference
const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

// Increment tokens and calculate cost
await calculateAndIncrementProjectCost(
    projectRef,
    MODEL_SLIDE_GENERATION,
    result.inputTokens,
    result.outputTokens,
    'text'
);

res.json({
    imagePrompt: result.imagePrompt,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens
});
```



### 6. Update Image Generation

**File:** `src/components/SlideCard.tsx`Update `handleGenerateImage()` to aggregate tokens:

```typescript
// After line 137 (after uploadImageToStorage):
import { updateProject } from '../services/projectService';
import { calculateAndIncrementProjectCost } from '../services/pricingService'; // Note: This needs to be frontend-compatible

// Option A: Call backend endpoint to increment (recommended)
// Create new endpoint: POST /increment-project-tokens
await authenticatedRequest('/increment-project-tokens', {
    projectId,
    modelId: 'gemini-3-pro-image-preview', // From constants
    inputTokens,
    outputTokens,
    operationType: 'image'
});

// Option B: Direct Firestore update (if pricing service is frontend-compatible)
// This requires making pricingService work on frontend
```

**Better approach:** Create backend endpoint for token aggregation**File:** `functions/src/index.ts`Add new endpoint:

```typescript
// POST /increment-project-tokens
app.post('/increment-project-tokens', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { projectId, modelId, inputTokens, outputTokens, operationType } = req.body;
        
        if (!projectId || !modelId || inputTokens === undefined || outputTokens === undefined || !operationType) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        
        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);
        
        const cost = await calculateAndIncrementProjectCost(
            projectRef,
            modelId,
            inputTokens,
            outputTokens,
            operationType
        );
        
        res.json({ cost, success: true });
    } catch (error: any) {
        console.error("Error incrementing project tokens:", error);
        res.status(500).json({ error: "Failed to update token counts" });
    }
});
```

**File:** `src/services/geminiService.ts`Add function to call the endpoint:

```typescript
export const incrementProjectTokens = async (
    projectId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    operationType: 'text' | 'image'
): Promise<{ cost: number }> => {
    return authenticatedRequest('/increment-project-tokens', {
        projectId,
        modelId,
        inputTokens,
        outputTokens,
        operationType
    });
};
```

**File:** `src/components/SlideCard.tsx`Update `handleGenerateImage()`:

```typescript
// After line 137:
import { incrementProjectTokens } from '../services/geminiService';
import { MODEL_IMAGE_GENERATION } from '../constants';

// After uploadImageToStorage:
await incrementProjectTokens(
    projectId,
    MODEL_IMAGE_GENERATION,
    inputTokens,
    outputTokens,
    'image'
);
```



### 7. Update Prompt Regeneration (Frontend)

**File:** `src/components/SlideCard.tsx`Update `handleNewIdea()` to aggregate tokens:

```typescript
// After line 187 (after regenerateImagePrompt):
import { incrementProjectTokens } from '../services/geminiService';
import { MODEL_SLIDE_GENERATION } from '../constants';

// After getting tokens from regenerateImagePrompt:
await incrementProjectTokens(
    projectId,
    MODEL_SLIDE_GENERATION,
    inputTokens,
    outputTokens,
    'text'
);
```



### 8. Initialize Pricing Data

**File:** `functions/src/utils/initializePricing.ts` (new file, optional)Create script/function to initialize pricing data:

```typescript
import * as admin from 'firebase-admin';
import { ModelPricing } from '@shared/types';

export async function initializeModelPricing(): Promise<void> {
    const db = admin.firestore();
    const now = Date.now();
    
    const pricingData: ModelPricing[] = [
        {
            id: 'gemini-3-flash-preview',
            modelName: 'Gemini 3 Flash',
            modelType: 'text',
            inputPricePer1MTokens: 0.075,   // Example pricing
            outputPricePer1MTokens: 0.30,   // Example pricing
            effectiveDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'gemini-3-pro-image-preview',
            modelName: 'Gemini 3 Pro Image',
            modelType: 'image',
            inputPricePer1MTokens: 0.50,     // Example pricing (typically higher)
            outputPricePer1MTokens: 1.00,   // Example pricing
            effectiveDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        }
    ];
    
    const batch = db.batch();
    pricingData.forEach(pricing => {
        const ref = db.collection('modelPricing').doc(pricing.id);
        batch.set(ref, pricing);
    });
    
    await batch.commit();
    console.log('Model pricing initialized');
}
```

**Note:** Update pricing values with actual Google AI pricing.

### 9. Update Firestore Rules

**File:** `firestore.rules`Add rules for pricing collection (read-only for authenticated users):

```javascript
// Model Pricing Collection (read-only for all authenticated users)
match /modelPricing/{modelId} {
    allow read: if request.auth != null;
    allow write: if false; // Only admin/backend can write
}
```



### 10. Display Cost on Dashboard

**File:** `src/components/Dashboard.tsx`Update project cards to display total cost in the metadata row (Row 3):

```typescript
// Add helper function to format cost
const formatCost = (cost: number | undefined): string => {
    if (cost === undefined || cost === 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4 // Show up to 4 decimals for very small costs
    }).format(cost);
};

// In the project card metadata row (around line 267):
<div className="mt-auto flex items-center text-[13px] text-[#627C81]">
    <span className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 mr-1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        {project.slides?.filter(slide => slide.layout !== 'Title Slide').length || 0}
    </span>
    <span className="mx-2">•</span>
    <span className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 mr-1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-3h6m-3-3h6" />
        </svg>
        {formatCost(project.totalCost)}
    </span>
    <span className="mx-2">•</span>
    <span>{formatDate(project.updatedAt)}</span>
</div>
```

**Alternative placement:** If the metadata row becomes too crowded, consider:

- Adding cost as a badge in Row 2 (with subject/grade level)
- Creating a separate cost row
- Using a tooltip on hover

### 11. Frontend Constants Update

**File:** `src/constants.ts` (or `shared/constants.ts`)Ensure model constants are accessible:

```typescript
export const MODEL_SLIDE_GENERATION = "gemini-3-flash-preview";
export const MODEL_IMAGE_GENERATION = "gemini-3-pro-image-preview";
```



## Files to Create/Modify

### New Files

1. `functions/src/services/pricingService.ts` - Pricing lookup and cost calculation
2. `functions/src/utils/initializePricing.ts` - Initialize pricing data (optional script)

### Modified Files

1. `shared/types.ts` - Add `ModelPricing` interface
2. `src/services/projectService.ts` - Update `ProjectData` interface
3. `functions/src/services/slideGeneration.ts` - Update token aggregation
4. `functions/src/index.ts` - Add `/increment-project-tokens` endpoint, update `/regenerate-image-prompt`
5. `src/services/geminiService.ts` - Add `incrementProjectTokens()` function
6. `src/components/SlideCard.tsx` - Update `handleGenerateImage()` and `handleNewIdea()`
7. `src/components/Dashboard.tsx` - Display `totalCost` on project cards
8. `firestore.rules` - Add pricing collection rules

## Testing Considerations

1. **Pricing Lookup**: Test with missing pricing (should log warning, return 0 cost)
2. **Token Aggregation**: Verify tokens increment correctly for each operation type
3. **Cost Calculation**: Verify cost is calculated correctly (input + output)
4. **Concurrent Updates**: Ensure Firestore increments are atomic
5. **Cache**: Verify pricing cache works and refreshes appropriately

## Edge Cases

1. **Missing Pricing**: Log warning, don't fail operation, return 0 cost
2. **Pricing Changes**: Current implementation uses active pricing (no historical pricing)
3. **Negative Tokens**: Should not occur, but handle gracefully
4. **Very Large Numbers**: Ensure number precision is maintained

## Future Enhancements (Out of Scope)

1. Historical pricing tracking (for accurate historical cost calculation)
2. Cost breakdown by operation type (textCost, imageCost fields)
3. User-level cost aggregation