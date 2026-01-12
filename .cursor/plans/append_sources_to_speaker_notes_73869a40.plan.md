---
name: Append Sources to Speaker Notes
overview: Fix source attribution by appending project-level sources (web URLs and file names) to the last slide's speaker notes during slide generation, ensuring they are stored in Firestore and visible in both the UI and DOCX exports.
todos:
  - id: append-sources-to-notes
    content: Modify slide normalization in generateSlides() to append uniqueSources to the last slide's speaker notes after cleaning
    status: pending
  - id: verify-web-sources
    content: Test that web search URLs appear in speaker notes when useWebSearch is enabled
    status: pending
    dependencies:
      - append-sources-to-notes
  - id: verify-file-sources
    content: Test that file names appear in speaker notes when files are uploaded
    status: pending
    dependencies:
      - append-sources-to-notes
  - id: verify-mixed-sources
    content: Test that both web URLs and file names appear together in the sources section
    status: pending
    dependencies:
      - append-sources-to-notes
---

# Fix Source Attribution in Speaker Notes

## Problem

Currently, sources (web URLs and file names) are extracted correctly but never appended to speaker notes during generation. This causes:

- Web search URLs never appear in speaker notes (only in DOCX export)
- File sources only appear if the AI model happens to include them (unreliable)
- Sources are stored at project level but not embedded in the notes themselves

## Solution

Append project-level sources to the last slide's speaker notes during slide normalization in `generateSlides()`. This ensures sources are:

1. Stored in Firestore as part of the speaker notes
2. Visible when viewing notes in the UI
3. Included in DOCX exports (which already work, but this makes it consistent)

## Implementation

### Modify Slide Normalization

**File:** [`functions/src/services/slideGeneration.ts`](functions/src/services/slideGeneration.ts)

**Location:** Lines 124-138 (slide normalization loop)

**Change:** Modify the `normalizedSlides.map()` callback to append sources to the last slide's speaker notes after cleaning.

**Current Code:**

```typescript
// Line 122: Sources already computed
const uniqueSources = getUniqueSources(sources, uploadedFileNames, sourceMaterial);

// Lines 125-138: Normalize slides
const normalizedSlides: Slide[] = slides.map((s, i) => {
    const slideId = `slide-${Date.now()}-${i}`;

    return {
        ...s,
        id: slideId,
        sortOrder: i,
        content: Array.isArray(s.content) ? s.content : [String(s.content)],
        speakerNotes: cleanSpeakerNotes(s.speakerNotes || ''),
        imagePrompts: [],
        currentPromptId: null
    };
});
```

**New Code:**

```typescript
// Line 122: Sources already computed
const uniqueSources = getUniqueSources(sources, uploadedFileNames, sourceMaterial);

// Lines 125-138: Normalize slides
const normalizedSlides: Slide[] = slides.map((s, i) => {
    const slideId = `slide-${Date.now()}-${i}`;
    
    // Clean speaker notes first
    let speakerNotes = cleanSpeakerNotes(s.speakerNotes || '');
    
    // Append sources to the last slide only
    const isLastSlide = i === slides.length - 1;
    if (isLastSlide && uniqueSources && uniqueSources.length > 0) {
        speakerNotes += '\n\nSources:\n' + uniqueSources.join('\n');
    }

    return {
        ...s,
        id: slideId,
        sortOrder: i,
        content: Array.isArray(s.content) ? s.content : [String(s.content)],
        speakerNotes: speakerNotes,
        imagePrompts: [],
        currentPromptId: null
    };
});
```

## Data Flow

```
AI generates slides with speakerNotes
    ↓
cleanSpeakerNotes() removes any AI-generated sources
    ↓
getUniqueSources() extracts web URLs + file names
    ↓
During normalization:
 - All slides: notes cleaned
 - Last slide ONLY: sources appended as "Sources:\n[list]"
    ↓
Slides stored in Firestore with sources in last slide's notes
    ↓
Sources visible in:
 - UI (when viewing speaker notes)
 - DOCX export (already working, now consistent)
```

## Verification

1. **Web Search Sources:**

            - Generate a deck with "Use Web Search" enabled
            - Verify URLs appear at the end of the last slide's speaker notes in the UI
            - Verify URLs appear in DOCX export

2. **File Sources:**

            - Generate a deck with uploaded files
            - Verify "File: [filename]" entries appear at the end of the last slide's speaker notes
            - Verify file sources appear in DOCX export

3. **Mixed Sources:**

            - Generate a deck with both web search and file uploads
            - Verify both types appear in the sources section
            - Verify proper formatting (one source per line)

4. **No Sources:**

            - Generate a deck without web search or files
            - Verify no "Sources:" section is appended
            - Verify no errors occur

## Notes

- Sources are appended to the last slide only (not every slide)
- Format: "Sources:" header followed by one source per line
- Sources include both web URLs (from grounding metadata) and file names (formatted as "File: [name]")
- The `uniqueSources` array is already deduplicated and validated
- This change makes sources persistent in Firestore, not just in DOCX generation