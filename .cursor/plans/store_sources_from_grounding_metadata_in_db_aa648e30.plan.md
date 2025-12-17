---
name: Store sources from grounding metadata in DB
overview: The AI may populate Slide.sources, but it's unreliable. We extract sources from grounding metadata (reliable) but don't store them in slides. We should programmatically populate Slide.sources from grounding metadata and uploaded file names, then use that stored field in DOCX generation instead of extracting from speaker notes.
todos:
  - id: add-extract-helper
    content: Add extractFileNamesFromSourceMaterial() helper function in slideGeneration.ts
    status: pending
  - id: populate-sources-in-slides
    content: Modify slide normalization to populate Slide.sources from grounding metadata and file names
    status: pending
  - id: update-generate-signature
    content: Update generateSlides() function signature to accept uploadedFileNames parameter
    status: pending
  - id: update-api-endpoint
    content: Update /generate-slides API endpoint to accept and pass uploadedFileNames
    status: pending
  - id: update-client-service
    content: Update generateSlidesFromDocument() in geminiService.ts to accept and pass uploadedFileNames
    status: pending
  - id: update-editor-component
    content: Update Editor.tsx to extract file names and pass them, and remove UI display code
    status: pending
  - id: update-docx-generation
    content: Modify generateDocx() in SlideDeck.tsx to read sources from Slide.sources field instead of extracting from speaker notes
    status: pending
  - id: verify-storage
    content: Verify sources are stored in Slide.sources field in Firestore after generation
    status: pending
  - id: test-docx-export
    content: Test DOCX export with both web search and file upload sources
    status: pending
---

# Store Sources from Grounding Metadata in Database

## Current State Analysis

**What's Currently Happening:**

1. **AI may populate sources:** The prompt asks AI to include `sources: ["url1", "url2"]` in JSON (line 127 in [`functions/src/shared/promptBuilders.ts`](functions/src/shared/promptBuilders.ts))
2. **Schema allows sources:** The schema includes `sources` as optional field (line 109-112 in [`functions/src/shared/schemas.ts`](functions/src/shared/schemas.ts))
3. **Grounding metadata extracted:** Sources are extracted from `groundingMetadata.groundingChunks` (lines 77-93 in [`functions/src/services/slideGeneration.ts`](functions/src/services/slideGeneration.ts))
4. **Sources NOT stored in slides:** The extracted grounding metadata sources are returned separately (line 128) but NOT assigned to `Slide.sources` field
5. **File names not tracked:** Uploaded file names are embedded in `sourceMaterial` but not extracted and stored

**The Problem:**

- Sources from grounding metadata (reliable) are extracted but not stored in slides
- We rely on AI to populate sources (unreliable)
- File names are not tracked separately
- DOCX tries to extract sources from speaker notes (may not exist)

## Solution

**Store sources deterministically from reliable sources:**

1. Extract sources from grounding metadata (web search) - this is reliable
2. Extract file names from uploaded files - track separately
3. Programmatically populate `Slide.sources` field with both
4. Update DOCX generation to read from `Slide.sources` field (not from speaker notes)
5. Remove UI display code that shows sources on page

## Implementation Steps

### 1. Populate Slide.sources from Grounding Metadata

**File:** [`functions/src/services/slideGeneration.ts`](functions/src/services/slideGeneration.ts)

After extracting sources from grounding metadata (line 93), populate them in slides:

```typescript
// Extract Grounding Metadata if available
const groundingMetadata = candidates?.[0]?.groundingMetadata;
let searchEntryPoint = undefined;
let webSearchQueries = undefined;
const sources: Array<{ uri: string; title?: string }> = [];

if (groundingMetadata) {
    searchEntryPoint = groundingMetadata.searchEntryPoint?.renderedContent;
    webSearchQueries = groundingMetadata.webSearchQueries;

    if (groundingMetadata.groundingChunks) {
        groundingMetadata.groundingChunks.forEach((chunk: any) => {
            if (chunk.web?.uri) {
                sources.push({
                    uri: chunk.web.uri,
                    title: chunk.web.title
                });
            }
        });
    }
}

// ... extract and validate slides ...

// Normalize slides (add IDs, etc)
const normalizedSlides: Slide[] = slides.map((s, i) => {
    // Build sources array: combine AI-provided sources (if any) with grounding metadata sources
    const slideSources: string[] = [];
    
    // Add sources from grounding metadata (reliable)
    sources.forEach(source => {
        if (source.uri) {
            slideSources.push(source.uri);
        }
    });
    
    // Add file sources if provided
    const fileNames = uploadedFileNames || extractFileNamesFromSourceMaterial(sourceMaterial);
    fileNames.forEach(filename => {
        slideSources.push(`File: ${filename}`);
    });
    
    // If AI also provided sources, merge them (avoid duplicates)
    if (s.sources && Array.isArray(s.sources)) {
        s.sources.forEach((source: string) => {
            if (!slideSources.includes(source)) {
                slideSources.push(source);
            }
        });
    }
    
    return {
        ...s,
        id: `slide-${Date.now()}-${i}`,
        sortOrder: i,
        content: Array.isArray(s.content) ? s.content : [String(s.content)],
        // NEW: Store sources from reliable sources (grounding metadata + files)
        sources: slideSources.length > 0 ? slideSources : undefined
    };
});
```

### 2. Add Helper Function to Extract File Names

**File:** [`functions/src/services/slideGeneration.ts`](functions/src/services/slideGeneration.ts)

```typescript
/**
 * Extracts file names from sourceMaterial string
 * Format: "File: filename\n---\ncontent\n---"
 */
function extractFileNamesFromSourceMaterial(sourceMaterial: string): string[] {
    if (!sourceMaterial) return [];
    
    const filePattern = /^File:\s*(.+?)$/gm;
    const matches = sourceMaterial.matchAll(filePattern);
    const fileNames: string[] = [];
    
    for (const match of matches) {
        if (match[1]) {
            fileNames.push(match[1].trim());
        }
    }
    
    return fileNames;
}
```

### 3. Update generateSlides Function Signature

**File:** [`functions/src/services/slideGeneration.ts`](functions/src/services/slideGeneration.ts)

Add `uploadedFileNames` parameter:

```typescript
export async function generateSlides(
    topic: string,
    gradeLevel: string,
    subject: string,
    sourceMaterial: string,
    numSlides: number,
    useWebSearch: boolean,
    additionalInstructions?: string,
    temperature?: number,
    bulletsPerSlide?: number,
    uploadedFileNames?: string[]  // NEW: Track file names for citations
): Promise<{...}>
```

### 4. Update API Endpoint

**File:** [`functions/src/index.ts`](functions/src/index.ts)

Modify `/generate-slides` endpoint:

```typescript
app.post('/generate-slides', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const {
            topic,
            gradeLevel,
            subject,
            sourceMaterial,
            numSlides,
            useWebSearch,
            additionalInstructions,
            temperature,
            bulletsPerSlide,
            uploadedFileNames  // NEW
        } = req.body;

        // ... validation ...

        const result = await generateSlides(
            topic,
            gradeLevel,
            subject,
            sourceMaterial || "",
            numSlides || 5,
            useWebSearch || false,
            additionalInstructions,
            temperature,
            bulletsPerSlide,
            uploadedFileNames  // NEW
        );

        res.json(result);
    } catch (error: any) {
        // ... error handling ...
    }
});
```

### 5. Update Client Service

**File:** [`src/services/geminiService.ts`](src/services/geminiService.ts)

```typescript
export const generateSlidesFromDocument = async (
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string,
  numSlides: number,
  useWebSearch: boolean = false,
  temperature: number = 0.7,
  bulletsPerSlide: number = 4,
  additionalInstructions: string = '',
  uploadedFileNames?: string[]  // NEW
): Promise<{...}> => {

  const result = await authenticatedRequest<any>('/generate-slides', {
    topic,
    gradeLevel,
    subject,
    sourceMaterial,
    numSlides,
    useWebSearch,
    additionalInstructions,
    temperature,
    bulletsPerSlide,
    uploadedFileNames  // NEW
  });

  // ... return result ...
};
```

### 6. Update Editor Component

**File:** [`src/components/Editor.tsx`](src/components/Editor.tsx)

Extract file names and pass them:

```typescript
const sourceMaterial = uploadedFiles.map(f => `File: ${f.name}\n---\n${f.content}\n---`).join('\n\n');
const uploadedFileNames = uploadedFiles.map(f => f.name);  // NEW

const { slides: generatedSlides, ... } = await generateSlidesFromDocument(
    topic, 
    gradeLevel, 
    subject, 
    sourceMaterial, 
    numSlides, 
    useWebSearch, 
    creativityLevel, 
    bulletsPerSlide, 
    additionalInstructions,
    uploadedFileNames  // NEW
);
```

Also remove UI display code:

- Remove lines 336-374: "Grounding & Citations UI" section
- Remove lines 72-73: `searchEntryPoint` and `sources` state variables
- Remove lines 166-177: State setting logic
- Remove lines 15-46: `ShadowSafeHTML` component

### 7. Update DOCX Generation to Use Stored Sources

**File:** [`src/components/SlideDeck.tsx`](src/components/SlideDeck.tsx)

Modify `generateDocx` to read from `Slide.sources` field:

```typescript
const generateDocx = async (slides: Slide[]) => {
    const doc = new Document({
        sections: [{
            properties: {},
            children: slides.flatMap((slide, index) => {
                const children = [
                    new Paragraph({
                        text: `Slide ${index + 1}: ${slide.title}`,
                        heading: HeadingLevel.HEADING_1,
                        spacing: {
                            before: 200,
                            after: 100,
                        },
                    }),
                ];

                // Read speaker notes (clean, no sources)
                const notes = slide.speakerNotes || "No speaker notes available.";
                children.push(new Paragraph({
                    text: notes,
                    spacing: {
                        after: 200,
                    },
                }));

                // NEW: Read sources from Slide.sources field (stored in DB)
                if (slide.sources && slide.sources.length > 0) {
                    // Add spacing before sources
                    children.push(new Paragraph({ text: "" }));

                    // Add Sources Header
                    children.push(new Paragraph({
                        text: "Sources",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { after: 100 }
                    }));

                    // Add spacing after header
                    children.push(new Paragraph({ text: "" }));

                    // Format each source
                    slide.sources.forEach((source, idx) => {
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const parts = source.split(urlRegex);
                        const paragraphChildren = [];

                        parts.forEach(part => {
                            if (part.match(urlRegex)) {
                                // It's a URL - make it a hyperlink
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
                                // It's text (like "File: filename")
                                paragraphChildren.push(new TextRun(part));
                            }
                        });

                        children.push(new Paragraph({
                            children: paragraphChildren,
                            spacing: { after: 100 }
                        }));
                    });
                }

                children.push(new Paragraph({ text: "" })); // Spacing between slides
                return children;
            }),
        }],
    });

    return await Packer.toBlob(doc);
};
```

## Verification Strategy

1. **Check existing slides in Firestore:**

            - Query a few slides to see if `sources` field exists
            - If it does, check if it's from AI or empty

2. **Test new slide generation:**

            - Generate with web search → verify `Slide.sources` contains URLs
            - Generate with file uploads → verify `Slide.sources` contains "File: filename"
            - Check Firestore to confirm sources are stored

3. **Test DOCX export:**

            - Export DOCX and verify sources appear
            - Verify URLs are hyperlinks
            - Verify file names appear correctly

## Benefits

1. **Reliable:** Uses grounding metadata (reliable) instead of relying on AI
2. **Complete:** Captures both web sources and file sources
3. **Single Source of Truth:** Sources stored once in `Slide.sources` field
4. **No Duplication:** Speaker notes remain clean, sources added only at export
5. **Backward Compatible:** Works with existing slides (sources field is optional)

## Files to Modify

1. [`functions/src/services/slideGeneration.ts`](functions/src/services/slideGeneration.ts) - Populate sources from grounding metadata
2. [`functions/src/index.ts`](functions/src/index.ts) - API endpoint
3. [`src/services/geminiService.ts`](src/services/geminiService.ts) - Client service
4. [`src/components/Editor.tsx`](src/components/Editor.tsx) - Extract file names, remove UI
5. [`src/components/SlideDeck.tsx`](src/components/SlideDeck.tsx) - Read sources from DB for DOCX