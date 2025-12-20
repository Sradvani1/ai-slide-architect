---
name: regenerate_image_prompt_feature
overview: Add a feature to generate new image prompt ideas using AI. Users can click "New Idea" to generate a completely new image prompt based on the slide content and project context. Each prompt is saved in history, and images are mapped to specific prompts. Users can scroll through prompts and see associated images.
todos:
  - id: update_types
    content: Update Slide and GeneratedImage types to support prompt history - add ImagePrompt interface with id, text, createdAt, and add promptId to GeneratedImage
    status: pending
  - id: backend_endpoint
    content: Create /regenerate-image-prompt endpoint in functions/src/index.ts that accepts slideId and projectId, fetches project metadata and slide data, and calls the regeneration service
    status: pending
  - id: regeneration_service
    content: Create regenerateImagePrompt() function in functions/src/services/imageGeneration.ts that builds a simplified single-slide prompt (slide + project context + buildImagePromptInstructionsSection), uses MODEL_SLIDE_GENERATION, returns plain text string
    status: pending
  - id: frontend_service
    content: Add regenerateImagePrompt() function to src/services/geminiService.ts that calls the backend endpoint
    status: pending
  - id: update_image_generation
    content: Update handleGenerateImage in SlideCard to save promptId with each generated image, and update uploadImageToStorage to accept promptId parameter
    status: pending
  - id: prompt_history_ui
    content: Add prompt history UI to SlideCard - display current prompt (expandable), add dot indicators for navigation, filter images by promptId (show orphaned images in all), show Generate Image button when no images, default to first prompt in array
    status: pending
  - id: new_idea_button
    content: Add 'New Idea' button next to Edit Prompt button - generate Firestore ID for new prompt, show loading spinner on button only (keep prompt visible), add to imagePrompts array, set as currentPromptId
    status: pending
  - id: edit_prompt_behavior
    content: Update handleSavePrompt to only allow editing current prompt (currentPromptId), save edit to that prompt's text field, do not trigger regeneration
    status: pending
  - id: update_slide_generation
    content: "Update slideGeneration.ts to save initial prompts as imagePrompts array (not imagePrompt string) - create ImagePrompt object with Firestore ID, set isOriginal: true, set as currentPromptId"
    status: pending
---

# Regenerate Image Prompt Feature

## Overview

Add functionality to generate new image prompt ideas for individual slides using AI. When a user clicks "New Idea", the system will generate a completely new image prompt based on the slide's title, content, and project context (topic, subject, grade level). Each generated prompt is saved in a history, and users can scroll through all prompts. Images generated from a specific prompt are mapped to that prompt, so when users navigate through prompts, the image carousel updates to show only images for that prompt.

## Key Requirements

1. **Exact Prompt Instructions**: Use the exact same modular prompt building functions (`buildSlideGenerationPrompt` with `buildImagePromptInstructionsSection`) - rely on model variability for new ideas, not different instructions
2. **Prompt History**: Save each generated prompt in the database on a per-slide basis with history tracking
3. **Image-to-Prompt Mapping**: Each generated image is mapped to a specific prompt via `promptId`
4. **Prompt Navigation**: Users can scroll through prompts, and the image carousel updates to show images for the selected prompt
5. **Edit Behavior**: Editing a prompt just saves the edit (overwrites that prompt), does NOT trigger regeneration
6. **Button Name**: The trigger button is called "New Idea"

## Data Model Changes

### Updated Types

**File:** `shared/types.ts`

```typescript
export interface ImagePrompt {
    id: string;
    text: string;
    createdAt: number;
    isOriginal?: boolean; // True for prompts generated during initial slide creation
}

export interface GeneratedImage {
    id: string;
    url: string;
    storagePath: string;
    createdAt: number;
    aspectRatio?: '16:9' | '1:1';
    inputTokens?: number;
    outputTokens?: number;
    promptId: string; // NEW: Maps image to specific prompt
}

export interface Slide {
    id: string;
    sortOrder: number;
    title: string;
    content: string[];
    
    imagePrompts?: ImagePrompt[]; // Array of prompts with history
    currentPromptId?: string;     // ID of currently selected/active prompt
    generatedImages?: GeneratedImage[];
    backgroundImage?: string;
    speakerNotes: string;
    layout?: 'Title Slide' | 'Content' | string;
    aspectRatio?: '16:9' | '1:1';
    updatedAt?: any;
}
```



## Architecture

The feature will follow this flow:

```javascript
SlideCard Component
  └─> Click "New Idea" button
      └─> Frontend Service (geminiService.ts)
          └─> Backend Endpoint (/regenerate-image-prompt)
              └─> Fetch project metadata & slide data
              └─> Generate new prompt using EXACT same prompt building functions
              └─> Return new prompt
          └─> Add new prompt to slide.imagePrompts array
          └─> Set as currentPromptId
  └─> User scrolls through prompts
      └─> Update currentPromptId
      └─> Filter images by promptId
      └─> Update image carousel display
  └─> User edits prompt
      └─> Save edit to current prompt (overwrite text)
      └─> NO regeneration triggered
  └─> User generates image
      └─> Save image with currentPromptId
```



## Implementation

### 1. Type Definitions Update

**File:** `shared/types.ts`

- Add `ImagePrompt` interface
- Add `promptId` field to `GeneratedImage` (make it required, not optional)
- Update `Slide` interface to use `imagePrompts` array and `currentPromptId`
- Remove `imagePrompt` field entirely (no backward compatibility needed)

### 2. Backend: New Endpoint

**File:** `functions/src/index.ts`Add a new POST endpoint `/regenerate-image-prompt` that:

- Accepts: `{ slideId: string, projectId: string }` (userId from auth middleware)
- Fetches project metadata (topic, gradeLevel, subject) from Firestore project document
- Fetches slide data (title, content) from Firestore slides subcollection
- Calls `regenerateImagePrompt()` service function
- Returns: `{ imagePrompt: string, inputTokens: number, outputTokens: number }`

### 3. Prompt Generation Service

**File:** `functions/src/services/imageGeneration.ts`Create `regenerateImagePrompt()` function that:

- Takes slide data (title, content) and project context (topic, subject, gradeLevel)
- Builds a **simplified single-slide prompt** that includes:
- Slide title and content
- Project context (topic, subject, gradeLevel)
- Uses `buildImagePromptInstructionsSection(gradeLevel)` (same function as slide generation)
- Uses MODEL_SLIDE_GENERATION
- **Response format**: Plain text string (just the image prompt, not JSON)
- Returns just the image prompt string

**Important**: Reuse the existing `buildImagePromptInstructionsSection()` function from `shared/promptBuilders.ts`. The variability comes from the AI model, not different instructions. Do NOT use the full `buildSlideGenerationPrompt()` - create a simplified version focused only on image prompt generation.

### 4. Frontend Service

**File:** `src/services/geminiService.ts`Add new function `regenerateImagePrompt()` that:

- Calls `/regenerate-image-prompt` endpoint
- Handles errors and retries
- Returns: `{ imagePrompt: string, inputTokens: number, outputTokens: number }`

### 5. Update Image Generation

**File:** `src/components/SlideCard.tsx`Update `handleGenerateImage()` to:

- Get `currentPromptId` from slide state (must exist - require at least one prompt)
- Validate that `currentPromptId` exists and matches a prompt in `imagePrompts` array
- Pass `promptId: currentPromptId` to `uploadImageToStorage()` (required parameter)
- Save `promptId` in the `GeneratedImage` object

**File:** `src/services/projectService.ts`Update `uploadImageToStorage()` to:

- Accept required `promptId: string` parameter (not optional)
- Include `promptId` in returned `GeneratedImage` object

### 6. Prompt History UI

**File:** `src/components/SlideCard.tsx`Add prompt history navigation:

- Display current prompt (from `currentPromptId` or first in array - **default to first in array**)
- Add **dot indicators** (like carousel) to navigate through prompts
- Show prompt index (e.g., "Prompt 1 of 3")
- When prompt changes, filter `generatedImages` by `promptId` matching `currentPromptId`
- **Orphaned images** (no promptId): Show in all prompts (don't filter them out)
- Update image carousel to show only images for selected prompt (or orphaned images)
- If no images for selected prompt, show **"Generate Image" button prominently** (not empty state message)
- **Prompt display**: Make prompts expandable/collapsible (not always fully visible)

### 7. New Idea Button

**File:** `src/components/SlideCard.tsx`Add:

- New state: `isGeneratingNewIdea` (boolean)
- New handler: `handleNewIdea()` that:
- Sets loading state
- Calls `regenerateImagePrompt()` service
- Creates new `ImagePrompt` object with unique ID and timestamp
- Adds to `slide.imagePrompts` array (or creates array if first)
- Sets as `currentPromptId`
- Updates slide via `onUpdateSlide()`
- Handles errors with user-friendly messages
- New button: "New Idea" **placed next to "Edit Prompt" button**
- Button should be disabled when `isGeneratingNewIdea` is true
- **Loading state**: Show loading spinner on button only (keep current prompt visible, don't overlay)
- **Prompt IDs**: Use Firestore auto-generated IDs (create doc reference, get ID)

### 8. Edit Prompt Behavior

**File:** `src/components/SlideCard.tsx`Update `handleSavePrompt()` to:

- **Only allow editing the currently selected prompt** (currentPromptId)
- Find the prompt in `imagePrompts` array matching `currentPromptId`
- Update that prompt's `text` field with edited text
- Save via `onUpdateSlide({ imagePrompts: updatedArray })`
- **Do NOT** trigger regeneration - just save the edit
- If user tries to edit a different prompt, switch to that prompt first (set as currentPromptId)

### 9. Update Slide Generation

**File:** `functions/src/services/slideGeneration.ts`Update slide generation to save prompts in new format:

- When AI generates slides with `imagePrompt` field:
- Create `ImagePrompt` object with Firestore auto-generated ID
- Set `isOriginal: true`
- Create `imagePrompts` array with this single prompt
- Set `currentPromptId` to this prompt's ID
- Save to slide object (not `imagePrompt` string)
- Remove any code that saves `imagePrompt` as a string

### 10. Edge Cases & Validation

- **No prompts state**: If slide has no prompts at all, **hide the prompt section entirely**
- **Prompt deletion**: Users cannot delete prompts (prompts are permanent, only editing allowed)
- **Orphaned images**: If an image somehow has no `promptId`, show it in all prompts (don't filter out)
- Ensure `currentPromptId` always points to a valid prompt in `imagePrompts` array

## Files to Modify

1. `shared/types.ts` - Update type definitions
2. `functions/src/index.ts` - Add new endpoint
3. `functions/src/services/imageGeneration.ts` - Add `regenerateImagePrompt()` function
4. `shared/promptBuilders.ts` - NO CHANGES (reuse existing functions)
5. `src/services/geminiService.ts` - Add `regenerateImagePrompt()` function
6. `src/services/projectService.ts` - Update `uploadImageToStorage()` to require `promptId` parameter
7. `src/components/SlideCard.tsx` - Major updates for prompt history, navigation, and "New Idea" button
8. `functions/src/services/slideGeneration.ts` - Update to save initial prompts as `imagePrompts` array (not string)

## UI/UX Considerations

- **Prompt navigation**: Use dot indicators (carousel style) to navigate through prompts
- Show clear indication of which prompt is currently selected (highlighted dot)
- **Prompt display**: Expandable/collapsible prompts (not always fully visible)
- Image carousel should smoothly update when switching prompts
- **"New Idea" button**: Placed next to "Edit Prompt" button, visually distinct
- **Loading state**: Show loading spinner on button only (keep current prompt visible)
- **No images state**: Show "Generate Image" button prominently (not empty state message)
- **No prompts state**: Hide prompt section entirely if slide has no prompts
- Smooth transitions when switching between prompts
- **Orphaned images**: Show in all prompts (images without promptId)

## Data Flow Example

1. **Initial Slide Creation**: 

- AI generates slide with image prompt text
- Slide generation service creates `imagePrompts: [{ id: "firestore-id", text: "...", isOriginal: true, createdAt: Date.now() }]`
- Sets `currentPromptId: "firestore-id"`
- **Default selection**: First prompt in array (or currentPromptId if set)

2. **User Clicks "New Idea"**:

- Backend generates new prompt using simplified prompt (slide + project context + imagePromptInstructionsSection)
- Response: Plain text string (not JSON)
- Frontend creates Firestore doc reference to get auto-generated ID
- Adds `{ id: "firestore-id", text: "new prompt", createdAt: Date.now() }` to array
- Sets `currentPromptId: "firestore-id"`
- **Loading**: Button shows spinner, current prompt stays visible

3. **User Generates Image**:

- Image saved with `promptId: "currentPromptId"`
- Image appears in carousel for that prompt
- Orphaned images (no promptId) also appear

4. **User Navigates to Prompt p1** (via dot indicators):

- Sets `currentPromptId: "p1"`
- Image carousel filters to show images with `promptId: "p1"` OR no promptId (orphaned)
- If no images, shows "Generate Image" button prominently

5. **User Edits Prompt p1**:

- Only current prompt (p1) can be edited
- Updates `imagePrompts[0].text = "edited text"`
- Saves to database
- No regeneration triggered

6. **Edge Cases**:

- **No prompts**: Hide prompt section entirely
- **Orphaned images**: Show in all prompts (don't filter out)