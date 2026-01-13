# Simplify Source Attribution in DOCX

## Context

The current implementation attempts to append sources to speaker notes during backend slide generation, which adds unnecessary complexity and has proven unreliable. The simpler approach is:

1. **Sources are already stored** at the project level in Firestore (`ProjectData.sources`)
2. **DOCX generation reads sources** from the `sources` prop passed to `SlideDeck` component
3. **DOCX adds sources** as a dedicated section at the end of the document

This eliminates the need to modify speaker notes during generation and makes the feature more maintainable and reliable.

## Spec

### 1. Remove Source Appending from Backend

**File:** `functions/src/services/slideGeneration.ts`

**Location:** Lines 125-148 (slide normalization loop)

**Change:** Remove the logic that appends sources to the last slide's speaker notes.

**Current Code (lines 129-136):**

```typescript
// Clean speaker notes first
let speakerNotes = cleanSpeakerNotes(s.speakerNotes || '');

// Append sources to the last slide only
const isLastSlide = i === slides.length - 1;
if (isLastSlide && uniqueSources && uniqueSources.length > 0) {
    speakerNotes += '\n\nSources:\n' + uniqueSources.join('\n');
}
```

**New Code:**

```typescript
// Clean speaker notes (no source appending)
const speakerNotes = cleanSpeakerNotes(s.speakerNotes || '');
```

**Rationale:** Sources should not be embedded in speaker notes. They will be added separately in DOCX generation.

### 2. Update DOCX Generation Function

**File:** `src/components/SlideDeck.tsx`

**Location:** Lines 106-140 (`generateDocx` function)

**Change:**

1. Add `sources` parameter to function signature
2. Add sources section at the end of the document (after all slides)
3. Format sources with proper hyperlink support for URLs

**Current Function Signature (line 106):**

```typescript
const generateDocx = async (slides: Slide[]) => {
```

**New Function Signature:**

```typescript
const generateDocx = async (slides: Slide[], sources: string[] = []) => {
```

**Current Document Structure (lines 110-135):**

```typescript
children: [
    ...slides.flatMap((slide, index) => {
        // Slide content
    }),
]
```

**New Document Structure:**

```typescript
children: [
    // All slides with their speaker notes
    ...slides.flatMap((slide, index) => {
        const children = [
            new Paragraph({
                text: `Slide ${index + 1}: ${slide.title}`,
                heading: HeadingLevel.HEADING_1,
                spacing: {
                    before: 200,
                    after: 100,
                },
            }),
            new Paragraph({
                text: slide.speakerNotes || "No speaker notes available.",
                spacing: {
                    after: 200,
                },
            }),
            new Paragraph({ text: "" }), // Spacing between slides
        ];
        return children;
    }),
    
    // Sources section at the end (if sources exist)
    ...(sources && sources.length > 0 ? [
        new Paragraph({
            text: "Sources",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
        }),
        ...sources.map(source => {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const parts = source.split(urlRegex);
            const paragraphChildren: (TextRun | ExternalHyperlink)[] = [];

            parts.forEach(part => {
                if (part.match(urlRegex)) {
                    // Format URLs as clickable hyperlinks
                    paragraphChildren.push(new ExternalHyperlink({
                        children: [
                            new TextRun({
                                text: part,
                                style: "Hyperlink",
                            }),
                        ],
                        link: part,
                    }));
                } else if (part) {
                    // Format file names and other text as regular text
                    paragraphChildren.push(new TextRun(part));
                }
            });

            return new Paragraph({
                children: paragraphChildren,
                spacing: { after: 100 },
            });
        }),
    ] : []),
]
```

**Key Implementation Details:**

- Sources section only added if `sources` array exists and has length > 0
- URLs (matching `https?://`) are formatted as clickable hyperlinks
- File names (format: "File: filename.pdf") are displayed as regular text
- Sources section appears at the very end of the document, after all slides
- Proper spacing with `before: 400` to separate from last slide

### 3. Update Function Call

**File:** `src/components/SlideDeck.tsx`

**Location:** Line 297 (`handleDownloadNotes` function)

**Change:** Pass `sources` prop to `generateDocx()` function.

**Current Code:**

```typescript
const docxBlob = await generateDocx(slides);
```

**New Code:**

```typescript
const docxBlob = await generateDocx(slides, sources || []);
```

**Rationale:** The `sources` prop is already available in the component (line 142) and contains the project-level sources array from Firestore.

## Acceptance Criteria

1. **Backend Simplification:**

   - [ ] Source appending logic removed from `slideGeneration.ts`
   - [ ] Speaker notes no longer contain embedded sources
   - [ ] Sources still stored at project level in Firestore (unchanged)

2. **DOCX Generation:**

   - [ ] `generateDocx()` accepts `sources` parameter
   - [ ] Sources section appears at end of DOCX document
   - [ ] Sources section only appears if sources exist
   - [ ] URLs are formatted as clickable hyperlinks
   - [ ] File names are displayed as regular text
   - [ ] Proper spacing between slides and sources section

3. **Function Integration:**

   - [ ] `handleDownloadNotes()` passes `sources` to `generateDocx()`
   - [ ] No TypeScript errors
   - [ ] No runtime errors

4. **Manual Verification:**

   - [ ] Generate deck with web search enabled → URLs appear in DOCX
   - [ ] Generate deck with file uploads → File names appear in DOCX
   - [ ] Generate deck with both → Both appear in DOCX
   - [ ] Generate deck with no sources → No sources section in DOCX
   - [ ] Open DOCX → Sources section at end, URLs are clickable

## Edge Cases

1. **Empty Sources Array:**

   - **Scenario:** `sources` is `[]` or `undefined`
   - **Handling:** Sources section not added (conditional rendering with `sources && sources.length > 0`)
   - **Expected:** DOCX contains only slides, no sources section

2. **Null/Undefined Sources:**

   - **Scenario:** `sources` prop is `null` or `undefined`
   - **Handling:** Default parameter `sources: string[] = []` handles this
   - **Expected:** No sources section added, no errors

3. **Mixed Source Types:**

   - **Scenario:** Sources array contains both URLs and file names
   - **Handling:** Regex matching identifies URLs, everything else treated as text
   - **Expected:** URLs are hyperlinks, file names are text

4. **Malformed URLs:**

   - **Scenario:** Source string contains text that looks like URL but isn't valid
   - **Handling:** Regex `/(https?:\/\/[^\s]+)/g `matches any `http://` or `https://` pattern
   - **Expected:** Matched patterns become hyperlinks (even if invalid URLs)

5. **Sources with Special Characters:**

   - **Scenario:** File names or URLs contain special characters
   - **Handling:** `docx` library handles encoding automatically
   - **Expected:** Special characters display correctly in DOCX

6. **Legacy Projects:**

   - **Scenario:** Old projects may have sources embedded in speaker notes
   - **Handling:** `cleanSpeakerNotes()` already removes sources sections
   - **Expected:** Old projects work correctly, no duplicate sources

## Tests

### Manual Testing Checklist

1. **Web Search Sources:**

   - Create new project with web search enabled
   - Generate slides
   - Download DOCX
   - Verify: Sources section at end with clickable URLs

2. **File Upload Sources:**

   - Create new project with file uploads
   - Generate slides
   - Download DOCX
   - Verify: Sources section at end with file names (e.g., "File: document.pdf")

3. **Mixed Sources:**

   - Create new project with both web search and file uploads
   - Generate slides
   - Download DOCX
   - Verify: Sources section contains both URLs (clickable) and file names

4. **No Sources:**

   - Create new project without web search or files
   - Generate slides
   - Download DOCX
   - Verify: No sources section, document ends after last slide

5. **Speaker Notes Integrity:**

   - Generate slides with sources
   - View speaker notes in UI
   - Verify: Speaker notes do NOT contain sources section (clean notes only)

6. **Backward Compatibility:**

   - Load existing project (may have sources in notes from old implementation)
   - Download DOCX
   - Verify: Sources appear in DOCX (from project.sources), no duplicates

### Automated Testing (Future)

If unit tests exist for DOCX generation:

- Add test case for `generateDocx()` with empty sources array
- Add test case for `generateDocx()` with URLs only
- Add test case for `generateDocx()` with file names only
- Add test case for `generateDocx()` with mixed sources
- Verify hyperlink formatting for URLs

## Implementation Notes

1. **No Database Changes Required:**

   - Sources are already stored at project level
   - No migration needed
   - Existing data structure is sufficient

2. **Backward Compatibility:**

   - Old projects will work correctly
   - `cleanSpeakerNotes()` already removes any embedded sources
   - Project-level sources array is the source of truth

3. **Performance:**

   - No performance impact
   - Sources are already in memory (component prop)
   - DOCX generation is on-demand (user-triggered)

4. **Code Complexity Reduction:**

   - Removes ~6 lines of conditional logic from backend
   - Simplifies data flow: sources stored → DOCX reads → DOCX displays
   - Single responsibility: DOCX generation handles source formatting

## Rollback Plan

If issues arise, rollback is simple:

1. Revert changes to `slideGeneration.ts` (restore source appending)
2. Revert changes to `SlideDeck.tsx` (remove sources parameter)
3. No database changes needed, so no data migration required