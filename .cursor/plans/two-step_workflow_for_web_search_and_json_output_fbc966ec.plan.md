---
name: Two-Step Workflow for Web Search and JSON Output
overview: "Split slide generation into two API calls: first call does research with web search (tools enabled, no JSON mode) to extract sources from grounding metadata, second call generates slides in JSON format (no tools, JSON mode) using the research results. Sources are saved to Firestore separately - speaker notes contain ONLY script, never sources."
todos:
  - id: create-research-function
    content: Create conductResearch() function that performs web search and extracts sources from grounding metadata
    status: pending
  - id: create-research-prompt-builder
    content: Add buildResearchPrompt() function in promptBuilders.ts to build research phase prompt
    status: pending
  - id: update-generate-slides-workflow
    content: "Modify generateSlides() to use two-step workflow: research first (if useWebSearch), then generate slides with JSON mode"
    status: pending
    dependencies:
      - create-research-function
      - create-research-prompt-builder
  - id: update-token-tracking
    content: Ensure token counts from both API calls are aggregated correctly
    status: pending
    dependencies:
      - update-generate-slides-workflow
  - id: test-web-search-sources
    content: Test that sources are extracted from research call and appear in Firestore
    status: pending
    dependencies:
      - update-generate-slides-workflow
  - id: test-json-generation
    content: Test that generation call produces valid JSON slides
    status: pending
    dependencies:
      - update-generate-slides-workflow
  - id: test-no-web-search
    content: Test that single call still works when useWebSearch is false
    status: pending
    dependencies:
      - update-generate-slides-workflow
  - id: test-mixed-sources
    content: Test that both web search sources and file sources appear correctly
    status: pending
    dependencies:
      - update-generate-slides-workflow
---

# Two-Step Workflow for Web Search and JSON Output

## Context

The Gemini API has a limitation where `tools: [{ googleSearch: {} }] `and `responseMimeType: "application/json"` cannot be used simultaneously. When both are enabled, web search fails to execute.

**Solution:** Split into two sequential API calls:

1. **Research Call**: Web search enabled (tools), no JSON mode → Extract sources from grounding metadata
2. **Generation Call**: JSON mode enabled (no tools) → Generate slides from research results

## Spec

### 1. Create Unified Research Function

**File:** `functions/src/services/slideGeneration.ts`

**New Function:** `conductResearch()`

**Purpose:** Perform unified research phase that always returns structured `researchContent` and populated `sources` array, regardless of input type (Web Search, File, or Both).

**Contract:** Step 1 is responsible for **What** the information is. Step 2 is responsible for **How** it is formatted into slides. This separation means Step 2 never has to care where the data came from (Web vs. File); it just focuses on making great slides from the `researchContent` provided.

**Function Signature:**

```typescript
async function conductResearch(
    topic: string,
    subject: string,
    gradeLevel: string,
    sourceMaterial?: string,
    additionalInstructions?: string,
    temperature?: number
): Promise<{
    researchContent: string;
    sources: Array<{ uri: string; title?: string }>;
    searchEntryPoint?: any;
    webSearchQueries?: string[];
    inputTokens: number;
    outputTokens: number;
}>
```

**Implementation:**

```typescript
async function conductResearch(
    topic: string,
    subject: string,
    gradeLevel: string,
    sourceMaterial?: string,
    additionalInstructions?: string,
    temperature?: number
): Promise<{
    researchContent: string;
    sources: Array<{ uri: string; title?: string }>;
    searchEntryPoint?: any;
    webSearchQueries?: string[];
    inputTokens: number;
    outputTokens: number;
}> {
    const model = MODEL_SLIDE_GENERATION;
    const config: any = {
        temperature: temperature || DEFAULT_TEMPERATURE,
        tools: [{ googleSearch: {} }],  // Web search enabled, NO JSON mode
    };

    // Build research prompt
    const researchPrompt = buildResearchPrompt(
        topic,
        subject,
        gradeLevel,
        sourceMaterial,
        additionalInstructions
    );

    const result = await getAiClient().models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
        config: config
    });

    const candidates = result.candidates;
    const researchContent = candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!researchContent) {
        throw new GeminiError("Empty response from research API", 'API_ERROR', true);
    }

    const inputTokens = result.usageMetadata?.promptTokenCount || 0;
    const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

    // Extract sources from grounding metadata
    const groundingMetadata = candidates?.[0]?.groundingMetadata;
    const sources: Array<{ uri: string; title?: string }> = [];
    let searchEntryPoint = undefined;
    let webSearchQueries = undefined;

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

    return {
        researchContent,
        sources,
        searchEntryPoint,
        webSearchQueries,
        inputTokens,
        outputTokens
    };
}
```

**Key Points:**

- **Unified Research Phase:** Always returns structured `researchContent` + `sources` array, regardless of input type
- **Web Search Enabled:** When `useWebSearch === true`, uses tools for web search, extracts sources from grounding metadata
- **File-Only Mode:** When `useWebSearch === false` but files provided, structures `sourceMaterial` as `researchContent` and extracts file names as sources
- **NO JSON mode** in research phase (allows web search to work)
- Returns research content as structured text (not JSON)
- Wrapped in `retryWithBackoff()` by caller for retry logic
- **Contract:** Step 1 = What information is. Step 2 = How it's formatted. Step 2 never needs to know source type.

### 2. Create Research Prompt Builder

**File:** `shared/promptBuilders.ts`

**New Function:** `buildResearchPrompt()`

**Purpose:** Build prompt for research phase that instructs AI to research the topic.

**Implementation:**

```typescript
export function buildResearchPrompt(
    topic: string,
    subject: string,
    gradeLevel: string,
    sourceMaterial?: string,
    additionalInstructions?: string
): string {
    const gradeString = gradeLevel.toLowerCase().includes('grade')
        ? gradeLevel
        : `${gradeLevel} Grade`;

    const sections: string[] = [];

    sections.push(`<context>
<topic>${topic}</topic>
<subject>${subject}</subject>
<grade_level>${gradeString}</grade_level>
${additionalInstructions ? `<additional_instructions>${additionalInstructions}</additional_instructions>` : ''}
</context>`.trim());

    if (sourceMaterial) {
        sections.push(`<source_material>
Use the following text as your primary source of truth. Supplement with web search for additional context.

SOURCE BEGIN:
${sourceMaterial}
SOURCE END
</source_material>`.trim());
    }

    sections.push(`<task>
Research the topic "${topic}" for ${gradeString} ${subject}.

1. Find high-quality, age-appropriate information from web search.
2. If source material is provided, use it as the foundation and supplement with web search.
3. Synthesize the information into a comprehensive research summary.
4. Include key facts, concepts, and information suitable for ${gradeString} students.

Provide a detailed research summary that can be used to create an educational slide deck.
</task>`.trim());

    return sections.join('\n\n').trim();
}
```

**Key Points:**

- Instructs AI to research using web search
- Includes source material if provided
- Asks for comprehensive research summary (text, not JSON)

### 3. Update Slide Generation Function

**File:** `functions/src/services/slideGeneration.ts`

**Location:** `generateSlides()` function (lines 13-155)

**Change:** Split into two steps: research first (always for consistency), then generate slides.

**Decision:** 
- Always use two-step flow for consistency, even when `useWebSearch === false`.
- When no web search, research phase still structures content using AI (not just passing sourceMaterial as-is).
- Refactor to split into separate functions: `performUnifiedResearch()` + `performSlideGeneration()` called explicitly from `generateSlidesAndUpdateFirestore()`.

**Current Flow:**

```typescript
// Single call with conditional tools/JSON mode
if (useWebSearch) {
    config.tools = [{ googleSearch: {} }];
} else {
    config.responseMimeType = "application/json";
}
// ... single API call
```

**New Flow:**

```typescript
const generateFn = async () => {
    const model = MODEL_SLIDE_GENERATION;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const sources: Array<{ uri: string; title?: string }> = [];
    let searchEntryPoint = undefined;
    let webSearchQueries = undefined;
    let researchContent = sourceMaterial || "";

    // STEP 1: Unified Research Phase (always, for consistency)
    // - If useWebSearch: Enable tools, extract sources from grounding metadata
    // - If no web search: Structure sourceMaterial as research content, extract file sources
    // - ALWAYS returns structured researchContent + sources array (contract)
    const researchFn = async () => {
        if (useWebSearch) {
            return await conductResearch(
                topic,
                subject,
                gradeLevel,
                sourceMaterial,
                additionalInstructions,
                temperature
            );
        } else {
            // No web search but files provided: Still call AI to structure content
            // AI structures sourceMaterial into unified researchContent format
            const model = MODEL_SLIDE_GENERATION;
            const config: any = {
                temperature: temperature || DEFAULT_TEMPERATURE,
                // NO tools (no web search), NO JSON mode (research output is text)
            };

            const researchPrompt = buildResearchPrompt(
                topic,
                subject,
                gradeLevel,
                sourceMaterial,
                additionalInstructions
            );

            const result = await getAiClient().models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
                config: config
            });

            const candidates = result.candidates;
            const researchContent = candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!researchContent) {
                throw new GeminiError("Empty response from research API", 'API_ERROR', true);
            }

            const inputTokens = result.usageMetadata?.promptTokenCount || 0;
            const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

            // Extract file sources from uploadedFileNames or sourceMaterial
            const fileSources: Array<{ uri: string; title?: string }> = [];
            if (uploadedFileNames && uploadedFileNames.length > 0) {
                uploadedFileNames.forEach(fileName => {
                    fileSources.push({ uri: `File: ${fileName}`, title: fileName });
                });
            } else if (sourceMaterial) {
                // Extract file names from sourceMaterial if available
                const fileRegex = /File:\s*([^\n]+)/gi;
                let match;
                while ((match = fileRegex.exec(sourceMaterial)) !== null) {
                    const fileName = match[1].trim();
                    fileSources.push({ uri: `File: ${fileName}`, title: fileName });
                }
            }
            
            // Return structured research content (contract: always researchContent + sources)
            return {
                researchContent,  // AI-structured content for Step 2
                sources: fileSources,
                searchEntryPoint: undefined,
                webSearchQueries: undefined,
                inputTokens,
                outputTokens
            };
        }
    };

    // Wrap research in retry logic (always, for consistency)
    const researchResult = await retryWithBackoff(researchFn);

    // Accumulate tokens
    totalInputTokens += researchResult.inputTokens;
    totalOutputTokens += researchResult.outputTokens;

    // Extract sources from unified research phase
    sources.push(...researchResult.sources);
    searchEntryPoint = researchResult.searchEntryPoint;
    webSearchQueries = researchResult.webSearchQueries;

    // Pass research content directly to Step 2 in memory (for speed)
    // Contract: Step 2 receives structured researchContent, doesn't care about source type
    researchContent = researchResult.researchContent;

    // STEP 2: Generate slides from research (always JSON mode, no tools)
    const config: any = {
        temperature: temperature || DEFAULT_TEMPERATURE,
        responseMimeType: "application/json",  // Always JSON mode, NO tools
    };

    // STEP 2: Generate slides from structured research content
    // Contract: Step 2 receives researchContent (structured from Step 1), doesn't need to know source type
    const systemPrompt = buildSlideDeckSystemPrompt();
    const userPrompt = buildSlideDeckUserPrompt(
        topic,
        subject,
        gradeLevel,
        numSlides,
        bulletsPerSlide,
        researchContent,  // Structured research content from Step 1 (in memory, fast)
        false,  // useWebSearch = false (research already completed in Step 1)
        additionalInstructions
    );

    const result = await getAiClient().models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
            ...config,
            systemInstruction: { parts: [{ text: systemPrompt }] }
        }
    });

    // Accumulate tokens from generation call
    totalInputTokens += result.usageMetadata?.promptTokenCount || 0;
    totalOutputTokens += result.usageMetadata?.candidatesTokenCount || 0;

    // Extract and validate slides
    const candidates = result.candidates;
    const text = candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new GeminiError("Empty response from AI model", 'API_ERROR', true);
    }

    let slides: any[];
    try {
        slides = extractFirstJsonArray(text);
    } catch (e) {
        throw new GeminiError("Failed to parse JSON from model response", 'INVALID_REQUEST', false, { responseText: text });
    }

    // Validate slides
    const warnings: string[] = [];
    slides.forEach((slide, idx) => {
        const errors = validateSlideStructure(slide, idx);
        if (errors.length > 0) {
            warnings.push(...errors);
        }
    });

    // Combine sources (web sources from research + file sources)
    const uniqueSources = getUniqueSources(sources, uploadedFileNames, sourceMaterial);

    // Normalize slides
    // CRITICAL: speakerNotes should ONLY contain AI-generated script, NEVER sources
    const normalizedSlides: Slide[] = slides.map((s, i) => {
        const slideId = `slide-${Date.now()}-${i}`;
        return {
            ...s,
            id: slideId,
            sortOrder: i,
            content: Array.isArray(s.content) ? s.content : [String(s.content)],
            speakerNotes: s.speakerNotes || '',  // Pure script only, no sources appended
            imagePrompts: [],
            currentPromptId: null
        };
    });

    return {
        slides: normalizedSlides,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        sources: uniqueSources || [],
        searchEntryPoint,
        webSearchQueries,
        researchContent,  // NEW: Return research content for storage
        warnings
    };
};
```

**Key Changes:**

- **Step 1: Unified Research Phase** (always, for consistency) → Always returns structured `researchContent` + `sources` array
  - Web Search mode: API call with tools, extracts sources from grounding metadata
  - File-only mode: Structures `sourceMaterial` as `researchContent`, extracts file names as sources
  - **Contract:** Step 1 = What information is. Step 2 = How it's formatted.
- **Memory Transfer:** Research content passed directly from Step 1 to Step 2 in memory (same execution block) for speed
- **Step 2: Generation Phase** (always) → JSON mode, uses structured `researchContent` from Step 1
  - Step 2 never needs to know source type (Web vs. File)
  - Receives `researchContent` and focuses only on formatting into slides
- **CRITICAL:** Sources are extracted during research phase and saved to Firestore project document's `sources` array
- **CRITICAL:** Speaker notes contain ONLY AI-generated script, NEVER sources (sources handled separately in DOCX)
- Combines tokens from both calls (combined totals only)
- Sources from research call + file sources = combined sources and saved to Firestore
- Research wrapped in `retryWithBackoff()` when web search enabled
- Research content returned for storage in Firestore (saved before Step 2 for resumability)

### 4. Update Prompt Builders

**File:** `shared/promptBuilders.ts`

**Changes:** 
1. Update `buildSlideDeckSystemPrompt()` and `buildSlideDeckUserPrompt()` to explicitly instruct AI to NOT include sources in speaker notes.
2. Ensure prompts do not ask AI to format or include sources.

**Current:** Prompts may allow AI to include sources/references in speaker notes.

**New:** Explicitly instruct AI that speaker notes should be script-only, no sources or references.

**Implementation:**

Update `buildSlideDeckSystemPrompt()` to add explicit instruction:

```typescript
export function buildSlideDeckSystemPrompt(): string {
  return `<role>
You are an educational content creator and curriculum designer.
Your goal is to generate a professional, engaging slide deck and speaker notes on the topic: <topic>, tailored to <grade_level> <subject>.
</role>

<task>
- Slide 1: Title Slide. The JSON object must have: "title" (main presentation title), "content" array with exactly 3 strings in this order (no labels): [tagline (3-5 words), the subject value from <subject>, the grade value from <grade_level>], and "speakerNotes".
- Slides 2-N: Content Slides. Each JSON object must have: "title" (slide title), "content" array with exactly <bullets_per_slide> strings (bullet points), and "speakerNotes".
- Total Slides: The deck must contain exactly <total_slides> slides.
</task>

<constraints>
1. Educational Value: Content must be accurate, age-appropriate, and pedagogically sound for <grade_level>.
2. Clarity: Use clear, concise language appropriate for <grade_level>.
3. Engagement: Speaker notes should be engaging and conversational, written in a script format.
4. Bullets: Use exactly <bullets_per_slide> bullet points for Content Slides.
5. No Markdown: Content strings must be plain text. Do NOT use markdown bold (**), italics (*), or manual bullet characters (-).
6. **NO SOURCES IN SPEAKER NOTES: Speaker notes must contain ONLY the presentation script. Do NOT include source citations, references, URLs, or "Sources:" sections. Sources are handled separately by the system.**
</constraints>

<output_format>
Return a valid JSON array of objects. Do not include markdown code fences.
[
  {
    "title": "string",
    "content": ["string", "string", ...],
    "speakerNotes": "string"  // Script only, no sources
  }
]
</output_format>`.trim();
}
```

**Key Points:**
- Explicit constraint added: "NO SOURCES IN SPEAKER NOTES"
- Speaker notes should be script-only
- Sources handled separately by the system (extracted from research phase, saved to Firestore, added to DOCX export)

### 4. Update Progress Tracking and Research Storage

**File:** `functions/src/services/slideGeneration.ts`

**Location:** `generateSlidesAndUpdateFirestore()` (lines 221-325)

**Change:** Save research to DB before Step 2 starts (for resumability), but pass in memory for speed.

**Memory vs. DB Strategy:**
- **In Memory:** Research content passed directly from Step 1 to Step 2 within same execution block (fast, no DB read latency)
- **In DB:** Research saved to Firestore before Step 2 starts (or in parallel) so generation can be resumed if Step 2 fails

**Current Progress Updates:**

- 0%: Generation started
- 25%: Research phase
- 75%: Generation complete, writing to Firestore
- 100%: Complete

**New Progress Updates:**

- 0%: Generation started
- 25%: Research phase completed, saving research to DB
- 75%: Generation complete, writing to Firestore
- 100%: Complete

**Implementation:**

```typescript
// Update: Generation started
await projectRef.update({
    status: 'generating',
    generationProgress: 0,
    generationStartedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
});

// Generate slides (includes both research and generation steps)
// Research is passed in-memory from Step 1 to Step 2 for speed
const result = await generateSlides(...);

// Update: Generation complete, writing to Firestore (75%)
await projectRef.update({
    generationProgress: 75,
    updatedAt: FieldValue.serverTimestamp()
});

// ... write slides to Firestore ...

// Update: Complete (100%)
await projectRef.update({
    status: 'completed',
    generationProgress: 100,
    sources: result.sources || [],
    researchContent: result.researchContent,  // Store research content
    generationCompletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
});
```

**Implementation: Refactor `generateSlidesAndUpdateFirestore()` to handle research saving:**

**Design Decision:** Split into separate functions: `performUnifiedResearch()` + `performSlideGeneration()` called explicitly from `generateSlidesAndUpdateFirestore()`.

**Implementation:**

```typescript
// Update: Generation started
await projectRef.update({
    status: 'generating',
    generationProgress: 0,
    generationStartedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
});

// Step 1: Unified Research Phase
// Edge case: If no sourceMaterial and useWebSearch is false, force web search
const shouldUseWebSearch = useWebSearch || (!sourceMaterial && !uploadedFileNames?.length);

const researchResult = await performUnifiedResearch(
    topic,
    subject,
    gradeLevel,
    sourceMaterial,
    shouldUseWebSearch,  // Auto-enable web search if no source material
    additionalInstructions,
    temperature,
    uploadedFileNames
);

// Save research to DB BEFORE Step 2 (enables resumability if Step 2 fails)
await projectRef.update({
    generationProgress: 25,
    sources: researchResult.sources || [],
    researchContent: researchResult.researchContent,  // Save for resumability
    updatedAt: FieldValue.serverTimestamp()
});

// Step 2: Generation phase (receives researchContent in memory for speed)
// Automatic retry if Step 2 fails (up to N attempts, using saved research)
const MAX_GENERATION_RETRIES = 3;
let generationResult;
let generationAttempts = 0;
let generationSucceeded = false;

while (generationAttempts < MAX_GENERATION_RETRIES && !generationSucceeded) {
    try {
        generationResult = await performSlideGeneration(
            topic,
            subject,
            gradeLevel,
            numSlides,
            bulletsPerSlide,
            researchResult.researchContent,  // Passed in memory (fast, no DB read)
            additionalInstructions,
            temperature
        );
        generationSucceeded = true;
    } catch (error: any) {
        generationAttempts++;
        if (generationAttempts >= MAX_GENERATION_RETRIES) {
            throw error;  // Re-throw if all retries exhausted
        }
        // Retry using saved research (no need to re-run Step 1)
        console.warn(`Generation attempt ${generationAttempts} failed, retrying...`);
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * generationAttempts));
    }
}

// Accumulate tokens from both steps
const totalInputTokens = researchResult.inputTokens + generationResult.inputTokens;
const totalOutputTokens = researchResult.outputTokens + generationResult.outputTokens;

// Update: Generation complete, writing to Firestore (75%)
await projectRef.update({
    generationProgress: 75,
    updatedAt: FieldValue.serverTimestamp()
});

// ... write slides to Firestore ...

// Charge only on successful completion (if Step 2 fails, no charge)
await calculateAndIncrementProjectCost(
    projectRef,
    MODEL_SLIDE_GENERATION,
    totalInputTokens,
    totalOutputTokens,
    'text'
);

// Update: Complete (100%)
await projectRef.update({
    status: 'completed',
    generationProgress: 100,
    generationCompletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
});
```

**Key Points:**
- Research saved to DB before Step 2 starts (enables auto-retry from saved research)
- Generation retries automatically if Step 2 fails (up to N attempts, using saved research)
- Charging only happens on successful completion (if Step 2 fails after all retries, no charge)
- Edge case: Auto-enable web search if no sourceMaterial provided

**Key Changes:**

- **Function Structure:** Refactor to split into separate functions: `performUnifiedResearch()` + `performSlideGeneration()`
- **Memory vs. DB Strategy:**
  - Research content passed **in memory** from Step 1 to Step 2 (same execution block, fast, no DB read latency)
  - Research content saved to Firestore **before Step 2 starts** (enables auto-retry from saved research)
- **Auto-Retry:** If Step 2 fails, automatically retry generation using saved research (up to N attempts)
- **Token Charging:** Charge only on successful completion (if Step 2 fails after all retries, no charge)
- **File-Only Mode:** Still call AI to structure content (not just pass sourceMaterial as-is)
- **Edge Case:** Auto-enable web search if no sourceMaterial provided
- Progress updated to 25% after research phase (research saved to DB)
- Sources saved even if generation fails (error handling saves research result)

### 5. Update Error Handling

**File:** `functions/src/services/slideGeneration.ts`

**Location:** `generateSlidesAndUpdateFirestore()` (lines 221-325)

**Change:** Save sources even if generation call fails.

**Current:** If generation fails, sources are lost.

**New:** Save sources from research even if generation fails.

**Implementation:**

```typescript
try {
    // ... existing code ...
    
    const result = await generateSlides(...);
    
    // ... save slides ...
    
    await projectRef.update({
        status: 'completed',
        sources: result.sources || [],
        researchContent: result.researchContent,  // If we return it
        // ... other fields ...
    });
} catch (error: any) {
    // Try to save sources even if generation failed
    // (sources are extracted during research step, before generation)
    try {
        // If we have partial results with sources, save them
        // Note: This requires accessing sources from research step
        // May need to refactor to expose sources separately
    } catch (saveError) {
        // Ignore save error, throw original error
    }
    
    await projectRef.update({
        status: 'failed',
        generationError: error.message,
        updatedAt: FieldValue.serverTimestamp()
    });
    
    throw error;
}
```

**Implementation:**

```typescript
let extractedSources: string[] = [];
let extractedResearchContent: string | undefined = undefined;

try {
    // ... existing code ...
    
    // Update: Generation started
    await projectRef.update({
        status: 'generating',
        generationProgress: 0,
        generationStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    });
    
    const result = await generateSlides(...);
    
    // Store sources and research content for potential error handling
    extractedSources = result.sources || [];
    extractedResearchContent = result.researchContent;
    
    // ... save slides ...
    
    await projectRef.update({
        status: 'completed',
        sources: extractedSources,
        researchContent: extractedResearchContent,
        // ... other fields ...
    });
} catch (error: any) {
    // Save sources and research content even if generation failed
    // (if research step succeeded, we have sources)
    if (extractedSources.length > 0 || extractedResearchContent) {
        await projectRef.update({
            sources: extractedSources,
            researchContent: extractedResearchContent,
            status: 'failed',
            generationError: error.message,
            updatedAt: FieldValue.serverTimestamp()
        });
    } else {
        // No sources extracted (research failed or not executed)
        await projectRef.update({
            status: 'failed',
            generationError: error.message,
            updatedAt: FieldValue.serverTimestamp()
        });
    }
    
    throw error;
}
```

**Key Changes:**

- Sources and research content stored in variables before generation
- If generation fails, sources and research content saved to Firestore before error propagation
- Status set to 'failed' but sources preserved for debugging/reuse

### 6. Update Types for Research Content

**File:** `shared/types.ts`

**Location:** `ProjectData` interface (lines 81-109)

**Change:** Add `researchContent` field to store research results.

**Implementation:**

```typescript
export interface ProjectData {
    // ... existing fields ...
    sources?: string[];
    researchContent?: string;  // NEW: Store research content from research phase
    status?: 'generating' | 'completed' | 'failed';
    // ... other fields ...
}
```

### 7. Update DOCX Export Logic

**File:** `src/components/SlideDeck.tsx`

**Location:** `generateDocx()` function (lines 106-177) and `handleDownloadNotes()` (lines 325-350)

**Current:** DOCX generation receives `sources` as a prop from parent component (`Editor.tsx` already fetches from Firestore).

**Verification:** Ensure DOCX export logic:
1. Fetches slide notes from database (already done via props)
2. Fetches sources array from database (already done via props in `Editor.tsx`)
3. Assembles document with slide notes + sources section at end (already implemented)

**Review Current Implementation:**

The `Editor.tsx` component (lines 150-152) already fetches `sources` from Firestore project document:
```typescript
if (projectData.sources) {
    setSources(projectData.sources);
}
```

The `SlideDeck` component receives `sources` as a prop and passes it to `generateDocx()` (line 334):
```typescript
const docxBlob = await generateDocx(slides, sources || []);
```

The `generateDocx()` function already:
- Uses slide notes from `slide.speakerNotes` (line 123)
- Adds sources section at the end if sources exist (lines 136-171)
- Formats URLs as clickable hyperlinks (lines 143-170)

**Conclusion:** No changes needed to DOCX export logic. The current implementation already:
- ✅ Fetches slide notes from database (via Firestore listener)
- ✅ Fetches sources array from database (via Firestore listener in `Editor.tsx`)
- ✅ Assembles document correctly (slide notes + sources section)

**Note:** The backend must ensure `sources` array is populated during research phase (Step 1) and saved to Firestore project document.

### 8. Token Cost Calculation

**File:** `functions/src/services/slideGeneration.ts`

**Location:** `generateSlidesAndUpdateFirestore()` (line 312-318)

**Change:** Token counts already include both calls (accumulated in `generateFn`).

**No changes needed:** The function already uses `result.inputTokens` and `result.outputTokens` which will include both calls (combined totals only, as per design decision).

## Acceptance Criteria

1. **Two-Step Execution:**

   - [ ] Research call executes when `useWebSearch === true`
   - [ ] Research call has tools enabled (web search works)
   - [ ] Generation call always executes with JSON mode
   - [ ] Generation call has NO tools (JSON mode works)

2. **Source Extraction:**

   - [ ] Sources extracted from research call's grounding metadata (Step 1)
   - [ ] Sources stored at project level in Firestore `sources` array
   - [ ] Sources do NOT appear in speaker notes (speaker notes are script-only)
   - [ ] Sources appear in DOCX export as separate section at end

3. **Token Tracking:**

   - [ ] Tokens from both calls combined correctly
   - [ ] Project cost calculated from total tokens

4. **Functionality:**

   - [ ] Slides generated correctly from research content
   - [ ] JSON parsing works (no errors)
   - [ ] Web search sources appear in sources array in Firestore
   - [ ] File sources still work when no web search
   - [ ] Speaker notes contain ONLY script (no sources, references, or URLs)
   - [ ] DOCX export includes slide notes + sources section at end

## Edge Cases

1. **No Web Search (File-Only Mode):**

   - **Scenario:** `useWebSearch === false` but files provided
   - **Handling:** Unified research phase calls AI (without tools) to structure `sourceMaterial` as `researchContent`, extracts file names as sources
   - **Expected:** Two API calls (research AI call + generation), file sources in `sources` array, AI-structured `researchContent` passed to Step 2
   - **Contract:** Step 2 receives structured `researchContent` + `sources`, doesn't need to know they came from files

2. **No Source Material Provided:**

   - **Scenario:** `useWebSearch === false` AND no `sourceMaterial`/files provided
   - **Handling:** Automatically enable web search (force `useWebSearch = true`)
   - **Expected:** Web search enabled, research phase performs web search, sources extracted from grounding metadata

3. **Web Search But No Results:**

   - **Scenario:** Research call executes but no grounding metadata returned
   - **Handling:** `sources` array stays empty, generation continues
   - **Expected:** Slides generated, sources array empty (or only file sources)

4. **Research Call Fails:**

   - **Scenario:** Research call throws error (retry logic exhausted)
   - **Handling:** Error propagated, generation doesn't proceed
   - **Expected:** Generation fails completely, no sources saved
   - **Note:** Retry logic will attempt up to 3 retries before failing

5. **Generation Call Fails (Auto-Retry):**

   - **Scenario:** Generation call throws error (research succeeded and saved to DB)
   - **Handling:** Automatically retry generation using saved research (up to N attempts)
   - **Expected:** 
     - If retry succeeds: Complete normally, charge for full operation
     - If all retries fail: Status set to 'failed', research saved in DB, **no charge** (charge only on successful completion)
   - **Implementation:** Retry loop in `generateSlidesAndUpdateFirestore()`, use saved `researchContent` from DB if needed

6. **No File Sources:**

   - **Scenario:** No uploaded files, only web search
   - **Handling:** Sources array contains only web URLs
   - **Expected:** Only web sources in array

7. **Both Web and File Sources:**

   - **Scenario:** Web search enabled + files uploaded
   - **Handling:** Both types combined in sources array
   - **Expected:** Mixed sources array with URLs and file names

## Implementation Notes

1. **Function Placement:**

   - `conductResearch()` function should be defined before `generateSlides()`
   - Can be in same file (`slideGeneration.ts`) or separate file

2. **Error Handling:**

   - Research call wrapped in `retryWithBackoff()` when web search enabled
   - If research fails after retries, generation fails completely
   - If generation fails after research succeeds, sources are saved before error propagation

3. **Token Aggregation:**

   - Both calls contribute to total tokens
   - **Charge only on successful completion:** If Step 2 fails after all retries, no charge is applied
   - Cost calculation uses combined tokens (research + generation) only on success
   - If generation fails, research is saved but user is not charged

4. **Performance:**

   - Two API calls when web search enabled (necessary to work around Gemini limitation)
   - Single API call when no web search (research step is no-op)
   - Progress updates at existing checkpoints (25%, 75%, 100%)

5. **Backward Compatibility:**

   - When `useWebSearch === false`, single API call (generation only)
   - When `useWebSearch === true`, two-step flow (research + generation)
   - Both paths use same code structure for consistency
   - **Contract:** Step 2 always receives structured `researchContent` regardless of source type

6. **Research Content Storage (Memory vs. DB):**

   - **In Memory:** Research content passed directly from Step 1 to Step 2 within same execution block (fast, no DB read latency)
   - **In DB:** Research saved to Firestore before Step 2 starts (enables resumability if Step 2 fails)
   - Allows debugging, reuse, and audit trail
   - Stored even if generation fails (if research succeeded)
   - User doesn't have to pay for/wait for Research Step again if Step 2 fails (can resume from saved research)

7. **Unified Research Phase Contract:**

   - **Always** returns structured `researchContent` + populated `sources` array
   - **Step 1 Responsibility:** What the information is (unified research output)
   - **Step 2 Responsibility:** How it is formatted into slides
   - **Separation:** Step 2 never has to care where the data came from (Web vs. File)
   - Step 2 just focuses on making great slides from the `researchContent` provided

7. **Source Attribution Separation:**

   - **CRITICAL:** Sources are extracted during research phase (Step 1) from grounding metadata
   - Sources saved to Firestore project document's `sources` array (not in speaker notes)
   - Speaker notes contain ONLY AI-generated script (no sources, references, or URLs)
   - DOCX export fetches both slide notes AND sources array from database
   - Sources formatted and appended as separate section in DOCX (already implemented)
   - AI prompt explicitly instructs to NOT include sources in speaker notes

## Files to Modify

1. `functions/src/services/slideGeneration.ts`

   - **Refactor:** Split `generateSlides()` into two separate functions:
     - `performUnifiedResearch()`: Unified research phase (always returns structured `researchContent` + `sources`)
       - Handles web search mode (with tools) and file-only mode (without tools, but still calls AI to structure)
       - Auto-enables web search if no sourceMaterial provided
     - `performSlideGeneration()`: Generation phase (receives `researchContent` in memory, doesn't care about source type)
   - **Refactor:** Update `generateSlidesAndUpdateFirestore()` to:
     - Call `performUnifiedResearch()` explicitly
     - Save research content to Firestore **before Step 2 starts** (enables auto-retry)
     - Call `performSlideGeneration()` with auto-retry logic (up to N attempts using saved research)
     - Pass research content **in memory** from Step 1 to Step 2 (for speed)
     - Charge only on successful completion (no charge if Step 2 fails after all retries)
     - Save sources even if generation fails
     - Handle progress updates appropriately (25% after research saved)
   - **Keep:** `generateSlides()` as a wrapper function for backward compatibility (if needed) or remove if not used elsewhere

2. `shared/promptBuilders.ts`
   - Add `buildResearchPrompt()` function
   - Update `buildSlideDeckSystemPrompt()` to explicitly instruct AI to NOT include sources in speaker notes

3. `shared/types.ts`
   - Add `researchContent?: string` to `ProjectData` interface

4. No changes needed to:
   - Frontend `Editor.tsx` (already fetches sources from Firestore)
   - Frontend `SlideDeck.tsx` (already receives sources as prop and includes in DOCX)
   - API endpoint (already passes `useWebSearch` flag)
   - DOCX generation logic (already correctly assembles slide notes + sources from database)