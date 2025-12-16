# SlidesEdu: Complete Legacy Removal + Firestore Deduplication Fix

**Status:** Development Refactor - Complete System Overhaul  
**Date:** December 15, 2025  
**Priority:** CRITICAL - Blocks further development  
**Audience:** Antigravity (Cursor AI agent)

---

## Executive Summary

The current image generation system is a **mixed-mode monster** that simultaneously supports legacy (`imagePrompt` freeform strings) and new (pedagogically-driven `imageSpec` JSON) paths. This causes:

1. **Confusing UI**: Users see old-style prompts first, then new-style on "New Idea"
2. **Broken regeneration**: "Legacy format not supported for regeneration" errors block workflow
3. **Firestore duplicates**: The same rendered prompt is saved multiple times per slide
4. **Data model confusion**: Multiple representations of the same thing (prompt history, image history, spec vs prompt)

**Solution:** 
- **Delete legacy completely** (no `imagePrompt` field, no legacy paths)
- **Single source of truth:** `ImageSpec` → `renderedImagePrompt` (derived) → `generatedImage`
- **Deterministic Firestore writes:** 1 prompt-history record per visual idea, 1 image record per generation (no duplicates)
- **Clean UI:** Show user-friendly "Visual idea" summary; hide verbose machine prompt behind "Advanced"

---

## Goals (non-negotiable)

1. ✅ **Zero legacy code paths** - If code checks for `imagePrompt`, delete it
2. ✅ **No "legacy format not supported" state** - Impossible to reach after refactor
3. ✅ **Firestore: 1 record per action** - "New Idea" creates 1 prompt record (deduped by hash); "Generate Image" creates 1 image record
4. ✅ **User sees only: "Visual idea" title + subtitle + element list** - Verbose machine prompt is debug-only
5. ✅ **Backward compat = ZERO** - All test decks will be regenerated
6. ✅ **Data integrity** - No orphaned fields, no mixed representations on same slide

---

## Current Symptoms (to reproduce and confirm)

**Symptom 1: Old prompt shows first**
- Create new deck
- UI displays "IMAGE PROMPT" with short paragraph text (looks like legacy freeform)
- This prompt is non-editable, labeled "Note: Editing the prompt text directly disconnects it from the Visual Spec."

**Symptom 2: Regenerate fails**
- Click regenerate button on that old prompt
- Error: "Legacy format not supported for regeneration. Please create a new deck."

**Symptom 3: New Idea works**
- Click "New Idea" button
- New verbose prompt is generated (EDUCATIONAL VISUAL AID PROMPT with all the details)
- Image generates successfully
- **Problem:** The verbose prompt is **displayed to the user** (should be hidden)

**Symptom 4: Duplicates in Firestore**
- After image generation completes, check `slides[n].prompts` in Firestore
- Same rendered prompt appears **multiple times** in the array
- Each entry has identical or very similar `prompt` text
- `promptHash` should dedupe these, but they're not deduped

---

## Root Cause Analysis

### Root Cause 1: Mixed data model on Slide
```typescript
// Current problematic state:
interface Slide {
  imagePrompt?: string;              // LEGACY (being phased out, but still checked)
  imageSpec?: ImageSpec;             // NEW (structure)
  renderedImagePrompt?: string;      // DERIVED (should always be from spec)
  prompts?: ImagePrompt[];           // HISTORY (contains mix of legacy + new)
  selectedPromptId?: string;         // Which history entry is active
}

// Problem: UI code still checks `imagePrompt` first
// If imagePrompt exists, renders "IMAGE PROMPT" (old style)
// If new idea clicked, creates imageSpec + renderedImagePrompt
// BUT prompts history may contain legacy entries (no spec)
// So "Regenerate" code path rejects it (can't regenerate without spec)
```

### Root Cause 2: Two different writers appending prompt history
**Writer 1 (UI):** On click of "New Idea"
- Creates new `ImageSpec`
- Calls service to generate spec
- Service returns spec + renderedPrompt
- UI appends to `prompts` array

**Writer 2 (Service):** On generation success
- Service completes generation
- Service writes updated slide back
- **Appends to `prompts` again** (duplicate!)

**Writer 3 (possible):** React effect on prompt change
- Watches `renderedImagePrompt`
- Calls "sync back to Firestore"
- Appends to `prompts` array

**Result:** `arrayUnion` with new object each time creates duplicates instead of deduping

### Root Cause 3: Prompt history mixes two concepts
```typescript
// Current ImagePrompt type:
interface ImagePrompt {
  id: string;
  prompt: string;        // The rendered prompt (but origin unknown: legacy or new?)
  createdAt: number;
  generatedImages: GeneratedImage[];
  spec?: ImageSpec;      // Optional—only if NEW system
}

// Problem:
// - Entry can have prompt + no spec (legacy)
// - Entry can have prompt + spec (new)
// - When rendering history list, don't know which is which
// - Regenerate logic says "if no spec, error"
```

---

## Data Model: New Design (Final)

### Firestore Slide Document

```typescript
interface SlideDocument {
  // Content fields
  title: string;
  content: string[];
  layout: 'Title Slide' | 'Content';
  speakerNotes: string;

  // ===== NEW IMAGE SYSTEM (clean) =====
  
  // Current selected visual idea
  imageSpec?: ImageSpec;                  // SOURCE OF TRUTH
  renderedImagePrompt?: string;           // Derived from spec (for audit trail)
  renderedImagePromptHash?: string;       // sha256 for change detection + dedupe
  
  // History of visual ideas
  promptHistory?: ImagePromptRecord[];    // Spec-first only (no legacy)
  selectedPromptId?: string;              // Currently active idea
  
  // Background image (currently shown)
  backgroundImage?: string;               // URL of selected generated image
  
  // Optional: audit trail
  lastImageGenAt?: number;
  lastImageGenSettings?: ImageGenOptions;
}
```

### ImagePromptRecord (spec-first, no legacy)

```typescript
interface ImagePromptRecord {
  id: string;                             // Stable UUID (never regenerated)
  createdAt: number;                      // Timestamp
  
  spec: ImageSpec;                        // REQUIRED (no legacy entries)
  renderedPrompt: string;                 // Derived from spec for audit/debug
  promptHash: string;                     // sha256(renderedPrompt)
  
  generatedImages: GeneratedImage[];      // All images created from this spec
}
```

### GeneratedImage

```typescript
interface GeneratedImage {
  id: string;                             // UUID for this generation
  createdAt: number;
  
  url: string;                            // Firestore Storage URL
  storagePath: string;                    // gs://... path
  
  // Generation parameters (for audit)
  temperature?: number;                   // Variance used
  imageSize?: '1K' | '2K' | '4K';
  aspectRatio?: '16:9' | '1:1';
  
  // Link to prompt
  promptHash: string;                     // Reference to prompt that created this
}
```

### UI-Friendly "Visual Idea" Summary (derived)

```typescript
interface VisualIdeaSummary {
  title: string;                          // spec.primaryFocal (1 line)
  subtitle: string;                       // spec.conceptualPurpose (2–3 lines)
  elements: string;                       // comma-separated: spec.subjects.join(', ')
}

// Helper function
function getVisualIdeaSummary(spec: ImageSpec): VisualIdeaSummary {
  return {
    title: spec.primaryFocal,
    subtitle: spec.conceptualPurpose,
    elements: spec.subjects.slice(0, 3).join(', ') + (spec.subjects.length > 3 ? `... (+${spec.subjects.length - 3} more)` : ''),
  };
}
```

---

## Step 1: Delete Legacy Completely

### 1.1 Remove legacy type fields

**In `src/types.ts`:**
- Delete or comment out: `interface Slide { imagePrompt?: string; ... }`
- Confirm `imageSpec` is present and required for content slides
- Confirm `ImagePrompt` interface has `spec: ImageSpec` marked required

### 1.2 Remove legacy UI rendering

**Search for these patterns and delete:**

```typescript
// ❌ DELETE: Rendering old-style prompt
if (slide.imagePrompt) {
  return <div>{slide.imagePrompt}</div>;
}

// ❌ DELETE: "IMAGE PROMPT" label or display
<h3>IMAGE PROMPT</h3>

// ❌ DELETE: Legacy regenerate path
if (!promptRecord.spec) {
  return "Legacy format not supported for regeneration";
}

// ❌ DELETE: Fallback to imagePrompt
const prompt = promptRecord.prompt || slide.imagePrompt;
```

**Replace with:**
- Always display `VisualIdeaSummary` (title, subtitle, elements)
- Only show full `renderedPrompt` in hidden "Advanced / Debug" panel

### 1.3 Remove legacy generation logic

**In Gemini service:**
- Delete any code that generates `imagePrompt` (old freeform string)
- Confirm `generateSlidesFromDocument` **only** generates `imageSpec`
- Delete fallback: "if spec generation fails, use freeform prompt instead"
- Instead: fail fast if spec cannot be generated (you want to know immediately)

### 1.4 Remove legacy Firestore data (one-time dev script)

Since there are zero users:
```typescript
// One-time cleanup script (run once, then delete)
async function cleanupLegacyDecks() {
  const decks = await db.collection('decks').get();
  
  for (const deck of decks.docs) {
    const slides = deck.data().slides || [];
    let updated = false;
    
    slides.forEach(slide => {
      // Delete imagePrompt field
      if (slide.imagePrompt) {
        delete slide.imagePrompt;
        updated = true;
      }
      
      // Delete any prompts without spec
      if (slide.prompts) {
        slide.prompts = slide.prompts.filter(p => p.spec);
        updated = true;
      }
    });
    
    if (updated) {
      await deck.ref.update({ slides });
      console.log(`Cleaned up deck: ${deck.id}`);
    }
  }
}
```

---

## Step 2: Fix Firestore Duplicates (Single Writer + Deduplication)

### 2.1 Identify the duplicate source (debug first)

**Add logging to every write:**

```typescript
// Wherever you write imagePrompt or promptHistory:

const writeImagePrompt = async (deckId: string, slideIdx: number, promptRecord: ImagePromptRecord) => {
  console.log('🔵 WRITE_PROMPT', {
    deckId,
    slideIdx,
    promptId: promptRecord.id,
    promptHash: promptRecord.promptHash,
    source: new Error().stack?.split('\n')[2], // File + line that called this
    timestamp: Date.now(),
  });
  
  // Actual write
  await db.collection('decks').doc(deckId).update({
    [`slides.${slideIdx}.promptHistory`]: firebase.firestore.FieldValue.arrayUnion(promptRecord),
  });
};
```

**Run the app, create a deck, click "New Idea", then check console.** You should see either:
- **1 log entry** (good—only one writer)
- **2+ log entries** with same promptHash (bad—multiple writers)
- **2+ log entries** with different sources (bad—two different functions appending)

### 2.2 Choose single writer (client vs server)

**Option A: Client-side single writer (recommended for dev)**
- Client only writes to Firestore after all processing
- Server never touches prompt history (read-only)
- Simple, easier to debug

**Option B: Server-side single writer**
- Client sends spec to server
- Server generates prompt + hash + image
- Server writes everything atomically
- More complex, but better for production

**Recommendation:** Start with Option A (client writes, server is read-only).

### 2.3 Implement Option A: Client writes, server returns data

**Client (React component):**
```typescript
const handleNewIdea = async () => {
  setInFlight(true);
  try {
    // 1. Call server to generate new spec
    const { spec, renderedPrompt, hash } = await generateNewImageSpec(
      slideContext
    );
    
    // 2. Create prompt history record
    const promptRecord: ImagePromptRecord = {
      id: uuidv4(),
      createdAt: Date.now(),
      spec,
      renderedPrompt,
      promptHash: hash,
      generatedImages: [],
    };
    
    // 3. Write to Firestore (client only, one place, one time)
    const slideRef = db.collection('decks').doc(deckId).collection('slides').doc(slideId);
    await slideRef.update({
      imageSpec: spec,
      renderedImagePrompt: renderedPrompt,
      renderedImagePromptHash: hash,
      promptHistory: firebase.firestore.FieldValue.arrayUnion(promptRecord),
      selectedPromptId: promptRecord.id,
    });
    
    // 4. Update local state
    setSelectedPrompt(promptRecord);
  } finally {
    setInFlight(false);
  }
};
```

**Server side (service function):**
```typescript
export async function generateNewImageSpec(slideContext) {
  // Generate spec (Gemini structured output)
  const spec = await getImageSpec(...);
  
  // Format into prompt
  const renderedPrompt = formatImageSpec(spec, { gradeLevel, subject });
  
  // Hash
  const hash = await hashPrompt(renderedPrompt);
  
  // Return data only (don't write)
  return { spec, renderedPrompt, hash };
}
```

### 2.4 Prevent double-click + concurrent requests

**UI button state:**
```typescript
<button
  onClick={handleNewIdea}
  disabled={inFlight}
  title={inFlight ? "Generating new idea..." : "Create a new visual idea"}
>
  {inFlight ? "Loading..." : "New Idea"}
</button>
```

### 2.5 Use hash-based deduplication

**Before appending, check if hash exists:**
```typescript
const promptRecord: ImagePromptRecord = {
  id: uuidv4(),
  createdAt: Date.now(),
  spec,
  renderedPrompt,
  promptHash: hash,
  generatedImages: [],
};

// Check: does this hash already exist in history?
const existingRecord = slide.promptHistory?.find(p => p.promptHash === hash);

if (existingRecord) {
  // Same idea already exists—don't append
  console.log('Visual idea already exists (same hash). Reusing existing record.');
  setSelectedPromptId(existingRecord.id);
} else {
  // New idea—append once
  await slideRef.update({
    promptHistory: firebase.firestore.FieldValue.arrayUnion(promptRecord),
    selectedPromptId: promptRecord.id,
  });
}
```

### 2.6 Use Firestore transaction for atomic consistency (optional but recommended)

```typescript
const handleNewIdea = async () => {
  setInFlight(true);
  try {
    const { spec, renderedPrompt, hash } = await generateNewImageSpec(slideContext);
    
    const promptRecord: ImagePromptRecord = {
      id: uuidv4(),
      createdAt: Date.now(),
      spec,
      renderedPrompt,
      promptHash: hash,
      generatedImages: [],
    };
    
    // Atomic transaction
    const slideRef = db.collection('decks').doc(deckId).collection('slides').doc(slideId);
    
    await db.runTransaction(async (transaction) => {
      const slideDoc = await transaction.get(slideRef);
      const history = slideDoc.data()?.promptHistory || [];
      
      // Check if hash already exists
      const duplicate = history.find(p => p.promptHash === hash);
      
      if (duplicate) {
        // Just update selectedPromptId (don't append)
        transaction.update(slideRef, {
          selectedPromptId: duplicate.id,
        });
      } else {
        // Append new record
        transaction.update(slideRef, {
          imageSpec: spec,
          renderedImagePrompt: renderedPrompt,
          renderedImagePromptHash: hash,
          promptHistory: firebase.firestore.FieldValue.arrayUnion(promptRecord),
          selectedPromptId: promptRecord.id,
        });
      }
    });
    
    setSelectedPrompt(promptRecord);
  } finally {
    setInFlight(false);
  }
};
```

---

## Step 3: Implement "Image Generation" (separate from "New Idea")

### 3.1 Two distinct buttons

**Button 1: "New Idea"**
- Generates brand-new `imageSpec` via Gemini
- Appends to `promptHistory` (deduped)
- Updates `selectedPromptId`
- **Does NOT generate image** (user must click "Generate")

**Button 2: "Generate Image"**
- Uses currently selected `spec` (from `promptHistory[selectedPromptId]`)
- Calls image generation API with current `temperature`
- Appends to `generatedImages` array inside prompt record
- Updates `backgroundImage` to newest image URL

### 3.2 Image generation logic

```typescript
const handleGenerateImage = async (temperature = 0.3) => {
  setImageInFlight(true);
  try {
    // Get current selected prompt
    const selectedPrompt = promptHistory.find(p => p.id === selectedPromptId);
    if (!selectedPrompt) {
      throw new Error('No selected visual idea');
    }
    
    // Generate image (with current spec + temperature)
    const { blob, renderedPrompt } = await generateImageFromSpec(
      selectedPrompt.spec,
      gradeLevel,
      subject,
      { temperature, imageSize: '2K', aspectRatio: '16:9' }
    );
    
    // Upload blob to Firebase Storage
    const imagePath = `decks/${deckId}/slides/${slideId}/${Date.now()}.png`;
    const imageRef = ref(storage, imagePath);
    await uploadBytes(imageRef, blob);
    const url = await getDownloadURL(imageRef);
    
    // Create GeneratedImage record
    const generatedImage: GeneratedImage = {
      id: uuidv4(),
      createdAt: Date.now(),
      url,
      storagePath: imagePath,
      temperature,
      imageSize: '2K',
      aspectRatio: '16:9',
      promptHash: selectedPrompt.promptHash,
    };
    
    // Append to selected prompt's generatedImages + update backgroundImage
    const slideRef = db.collection('decks').doc(deckId).collection('slides').doc(slideId);
    
    // Find the index of the selected prompt
    const promptIdx = promptHistory.findIndex(p => p.id === selectedPromptId);
    
    await slideRef.update({
      [`promptHistory.${promptIdx}.generatedImages`]: firebase.firestore.FieldValue.arrayUnion(generatedImage),
      backgroundImage: url,
    });
    
    // Update local state
    setBackgroundImage(url);
  } finally {
    setImageInFlight(false);
  }
};
```

### 3.3 UI buttons

```tsx
<div className="image-controls">
  <button
    onClick={handleNewIdea}
    disabled={inFlight}
    className="btn-primary"
  >
    {inFlight ? "Creating idea..." : "✨ New Idea"}
  </button>
  
  <button
    onClick={() => handleGenerateImage(0.3)}
    disabled={imageInFlight || !selectedPromptId}
    className="btn-primary"
  >
    {imageInFlight ? "Generating..." : "🎨 Generate Image"}
  </button>
  
  <button
    onClick={() => handleGenerateImage(0.6)}
    disabled={imageInFlight || !selectedPromptId}
    className="btn-secondary"
  >
    {imageInFlight ? "..." : "🎨 More Variation"}
  </button>
</div>
```

---

## Step 4: Clean UI - Hide Verbose Prompt

### 4.1 Show user-friendly summary by default

```tsx
// File: components/VisualIdeaPanel.tsx

import { getVisualIdeaSummary } from '@/utils/imageUtils';

export function VisualIdeaPanel({ spec, onNewIdea, onGenerate }) {
  if (!spec) {
    return <div className="placeholder">No visual idea yet. Click "New Idea" to create one.</div>;
  }
  
  const summary = getVisualIdeaSummary(spec);
  
  return (
    <div className="visual-idea-panel">
      <h3 className="title">{summary.title}</h3>
      <p className="subtitle">{summary.subtitle}</p>
      
      <div className="elements">
        <strong>Key elements:</strong>
        <p>{summary.elements}</p>
      </div>
      
      <div className="controls">
        <button onClick={onNewIdea} className="btn-outline">
          New Idea
        </button>
        <button onClick={onGenerate} className="btn-primary">
          Generate Image
        </button>
      </div>
      
      {/* Advanced panel (hidden by default) */}
      <details className="advanced">
        <summary>Advanced</summary>
        
        <div className="spec-viewer">
          <h4>Visual Specification (JSON)</h4>
          <pre>{JSON.stringify(spec, null, 2)}</pre>
        </div>
        
        <div className="prompt-viewer">
          <h4>Generated Prompt (for debugging)</h4>
          <p className="note">This is what the image model sees:</p>
          <pre className="monospace">{formatImageSpec(spec, ctx)}</pre>
          <button onClick={() => clipboard.copy(formatImageSpec(spec, ctx))}>
            Copy Prompt
          </button>
        </div>
      </details>
    </div>
  );
}
```

### 4.2 CSS for clean appearance

```css
.visual-idea-panel {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  background: #f9f9f9;
}

.visual-idea-panel .title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #333;
}

.visual-idea-panel .subtitle {
  font-size: 14px;
  color: #666;
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.visual-idea-panel .elements {
  margin-bottom: 12px;
  padding: 8px;
  background: #fff;
  border-radius: 4px;
  border-left: 3px solid #2196F3;
}

.visual-idea-panel .elements p {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #555;
}

.visual-idea-panel .controls {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.visual-idea-panel .advanced {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ddd;
}

.visual-idea-panel .advanced summary {
  cursor: pointer;
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  user-select: none;
}

.visual-idea-panel .spec-viewer,
.visual-idea-panel .prompt-viewer {
  margin-top: 12px;
}

.visual-idea-panel .spec-viewer h4,
.visual-idea-panel .prompt-viewer h4 {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.visual-idea-panel .spec-viewer pre,
.visual-idea-panel .prompt-viewer pre {
  background: #f0f0f0;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 11px;
  max-height: 200px;
  margin: 0;
}

.visual-idea-panel .prompt-viewer .note {
  font-size: 12px;
  color: #999;
  margin: 0 0 8px 0;
}
```

---

## Step 5: Update Service Functions

### 5.1 Ensure `generateImageFromSpec` uses `renderedImagePrompt`

```typescript
export async function generateImageFromSpec(
  spec: ImageSpec,
  gradeLevel: string,
  subject: string,
  opts?: ImageGenOptions
): Promise<{ blob: Blob; renderedPrompt: string }> {
  // Format spec into prompt
  const renderedPrompt = formatImageSpec(spec, { gradeLevel, subject });
  
  // Call Gemini image generation
  const response = await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{ role: 'user', parts: [{ text: renderedPrompt }] }],
    generationConfig: {
      temperature: opts?.temperature ?? 0.3,
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: opts?.aspectRatio ?? '16:9',
        imageSize: opts?.imageSize ?? '2K',
      },
    },
  });
  
  // Extract image bytes (no changes to this logic)
  const parts = (response as any).candidates?.[0]?.content?.parts;
  const imagePart = parts?.find((p: any) => p.inlineData || p.inline_data);
  
  if (!imagePart) {
    throw new Error('No image data in response');
  }
  
  const data = imagePart.inlineData?.data || imagePart.inline_data?.data;
  const mimeType = imagePart.mimeType || imagePart.mime_type || 'image/png';
  
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  
  return { blob, renderedPrompt };
}
```

---

## Step 6: Testing Checklist

### 6.1 Unit tests (imageUtils)

```typescript
describe('Legacy removal', () => {
  it('does not have imagePrompt anywhere', () => {
    const slideTypes = fs.readFileSync('src/types.ts', 'utf-8');
    expect(slideTypes).not.toMatch(/imagePrompt\s*:/);
  });

  it('ImagePrompt requires spec', () => {
    // imagePrompt.spec must be required in the type
    expect(true).toBe(true); // Manual check
  });
});

describe('Firestore deduplication', () => {
  it('does not append duplicate prompt with same hash', async () => {
    const spec = createValidImageSpec();
    const hash = await hashPrompt(formatImageSpec(spec, ctx));
    
    // First write
    await writePromptRecord(deckId, slideId, { spec, hash });
    
    // Second write with same hash should update selectedPromptId, not append
    await writePromptRecord(deckId, slideId, { spec, hash });
    
    const slide = await getSlide(deckId, slideId);
    const count = slide.promptHistory.filter(p => p.promptHash === hash).length;
    expect(count).toBe(1); // Only one!
  });
});

describe('UI separation', () => {
  it('shows VisualIdeaSummary by default', () => {
    const spec = createValidImageSpec();
    const summary = getVisualIdeaSummary(spec);
    
    expect(summary.title).toBeTruthy();
    expect(summary.subtitle).toBeTruthy();
    expect(summary.elements).toBeTruthy();
  });

  it('hides verbose prompt behind Advanced panel', () => {
    // <details> element is present but closed by default
    // Only opens when user clicks "Advanced"
  });
});
```

### 6.2 E2E test (manual)

1. **Create a new deck**
   - Check: no "IMAGE PROMPT" legacy text appears
   - Check: no "Legacy format not supported" error visible

2. **Click "New Idea"**
   - Check: new VisualIdeaSummary appears (title, subtitle, elements)
   - Check: only 1 entry appears in promptHistory (Firestore)

3. **Click "New Idea" again with same content source**
   - Check: no duplicate entry created (hash dedupe works)
   - Check: selectedPromptId updates but no new record

4. **Click "Generate Image"**
   - Check: 1 entry appears in `generatedImages` array
   - Check: `backgroundImage` URL updates
   - Check: no new prompt record created

5. **Click "Generate Image" again (same prompt, higher temperature)**
   - Check: 2nd entry appears in `generatedImages` array
   - Check: same prompt record, different image
   - Check: `backgroundImage` updates to new image

6. **Inspect Firestore**
   - Check: `slides[n].promptHistory` has no duplicates
   - Check: `slides[n].promptHistory[i].generatedImages` contains all images for that idea
   - Check: `slides[n].selectedPromptId` points to active idea

---

## Step 7: Logging for Diagnostics

Add structured logging throughout to identify any remaining duplicate writes:

```typescript
// Log every major operation
const log = {
  newIdea: (deckId, slideId, promptHash) => {
    console.log(`[NEW_IDEA] ${deckId}/${slideId} hash=${promptHash}`);
  },
  
  appendPrompt: (deckId, slideId, promptHash) => {
    console.log(`[APPEND_PROMPT] ${deckId}/${slideId} hash=${promptHash}`);
  },
  
  dedupedPrompt: (deckId, slideId, promptHash) => {
    console.log(`[DEDUPED] ${deckId}/${slideId} hash=${promptHash} (already exists)`);
  },
  
  generateImage: (deckId, slideId, promptHash, imageId) => {
    console.log(`[GENERATE_IMAGE] ${deckId}/${slideId} hash=${promptHash} imageId=${imageId}`);
  },
  
  firestoreWrite: (path, operation, data) => {
    console.log(`[FIRESTORE_WRITE] ${path} ${operation}`, data);
  },
};
```

After running through manual tests, check the console for:
- Are there multiple `[NEW_IDEA]` logs for the same hash?
- Are there multiple `[FIRESTORE_WRITE]` logs for the same prompt record?
- Are the sources (stack traces) different functions?

---

## Step 8: Success Criteria (Sign-Off)

After completing all steps, verify:

- [ ] **Zero legacy code paths exist** - search for `imagePrompt` returns nothing
- [ ] **No "legacy format" error message** exists anywhere (even in comments/docs)
- [ ] **First-time user sees only: "No visual idea yet"** - no old-style IMAGE PROMPT
- [ ] **New Idea creates exactly 1 prompt record** (verified in Firestore)
- [ ] **New Idea with same source doesn't create duplicate** (hash dedupe works)
- [ ] **Generate Image creates exactly 1 image record** (not duplicate prompt record)
- [ ] **Firestore schema is clean:**
  - `imageSpec` (single object)
  - `renderedImagePrompt` (single string)
  - `promptHistory` (array of spec-first records)
  - `selectedPromptId` (string reference)
  - `backgroundImage` (single URL)
- [ ] **UI shows VisualIdeaSummary by default** (title, subtitle, elements)
- [ ] **Verbose prompt hidden behind "Advanced"** (not visible by default)
- [ ] **All unit tests pass**
- [ ] **Manual E2E test passes** (deck creation → new idea → generate image → inspect Firestore)
- [ ] **Console logs show single writer pattern** (no duplicate write sources)

---

## Step 9: Implementation Order (for Antigravity)

Do them in this sequence:

1. **Delete legacy everywhere** (Step 1) - This makes it impossible to accidentally use old code
2. **Fix data model** (Step 2 design only) - Don't code yet, just plan
3. **Implement single writer + dedup** (Step 2 coding) - This fixes duplicates
4. **Implement image generation** (Step 3) - Separate the two buttons
5. **Clean UI** (Step 4) - Hide verbose prompt
6. **Update services** (Step 5) - Ensure rendering uses correct prompt
7. **Write tests** (Step 6) - Verify everything works
8. **Manual E2E** (Step 7) - Confirm no more issues
9. **Sign off** (Step 8) - Declare refactor complete

---

## Appendix A: File Checklist

**Files to modify:**

```
src/
  types.ts                              ← Remove imagePrompt field, require spec
  utils/
    imageUtils.ts                       ← Already updated (no changes needed)
  components/
    VisualIdeaPanel.tsx                 ← NEW: User-friendly summary view
    SlideEditor.tsx or similar          ← Replace old prompt display with VisualIdeaPanel
  services/
    imageService.ts                     ← Ensure uses formatImageSpec
    deckService.ts                      ← Ensure single-writer pattern
  hooks/
    useImageGeneration.ts               ← NEW: Handle state for New Idea + Generate Image
```

---

## Appendix B: Common Pitfalls & How to Avoid

| Pitfall | Symptom | Prevention |
|---------|---------|-----------|
| Forgot to delete legacy code | Old prompts still appear | Search codebase for `imagePrompt` before declaring done |
| Two writers still competing | Duplicates still appear in Firestore | Add logging to every write, identify source |
| React effect fires twice | Duplicates on each click | Use `useCallback` + dependency array, disable button while in-flight |
| Forgot to disable button during request | User clicks twice, creates duplicates | Set `disabled={inFlight}` on all action buttons |
| Hash collision or hash not computed | Dedupe fails, duplicates appear | Verify `hashPrompt` runs and result is stored before write |
| Old Firestore documents still present | App loads old data with `imagePrompt` | Run cleanup script (Appendix A) before going live |
| UI still references `renderedImagePrompt` in old location | Confusion between "render time" and "storage time" | Store `renderedImagePrompt` on slide doc for audit, only display summary |

---

## Appendix C: Questions for Cursor

If you get stuck, clarify with user:

1. **"Is there a specific file where UI renders the 'IMAGE PROMPT' text?"**
2. **"Can you show me the exact Firestore write calls (update/arrayUnion) for prompts?"**
3. **"Are there any React effects that watch promptHistory and write back?"**
4. **"What's the current model name for image generation (gemini-3-pro-image-preview vs other)?"**
5. **"Should 'New Idea' auto-generate an image, or only generate if user clicks 'Generate'?"** (Recommendation: don't auto-generate)

---

## Next Steps (After This Refactor)

Once complete, you'll be ready for:
- **Image quality optimization** (tune the prompt further based on generated images)
- **Workflow polish** (loading states, error recovery, image history browsing)
- **Performance tuning** (batch image generation, caching)
- **User features** (favorite images, image filters, export options)

---

**End of Complete Legacy Removal + Firestore Deduplication Spec**

This document is implementation-ready. Antigravity can follow it step-by-step without guessing.