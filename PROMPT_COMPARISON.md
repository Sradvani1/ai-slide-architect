# Prompt Structure Comparison: Versions 1-4 vs Current

This document compares the early prompt versions (1-4, before ImageSpec) with the current simplified implementation.

---

## Overview

| Aspect | Versions 1-4 | Current Version |
|--------|--------------|-----------------|
| **Generation Approach** | Simple string prompt | Simple string prompt |
| **Style Handling** | Separate IMAGE_STYLE_GUIDE appended | Static STYLE_GUIDELINES appended |
| **Structure** | Varied instructions | Subject → Action → Setting (structured flow) |
| **Text/Labels** | Version 1: Encouraged → Versions 2-4: Explicitly forbidden | Not mentioned (implicitly avoided via style guidelines) |
| **Grade Level Adaptation** | Explicit in generation prompt | Not in generation prompt (removed) |

---

## 1. MAIN PROMPT FOR SLIDE GENERATION

### Similarities ✅

1. **Simple String Output**
   - Both generate a simple `imagePrompt` string field
   - No complex JSON schema structures
   - Direct narrative description

2. **Educational Focus**
   - Both emphasize educational illustrations
   - Both require the image to explain/teach concepts
   - Both focus on clarity and pedagogical value

3. **Content-Aligned**
   - Both require prompts to align with slide content
   - Both emphasize visual representation of concepts
   - Both aim to help teachers explain topics

4. **No Style Instructions in Generation Prompt**
   - Versions 2-4 and Current: Explicitly forbid style instructions in generation prompt
   - Style is handled separately (appended at API call)

### Differences ❌

#### A. **Structure & Organization**

**Versions 1-4:**
- Varied structure across versions
- Version 1: Long, detailed with examples (good/bad prompts)
- Versions 2-4: List of rules/guidelines
- Less structured narrative flow

**Current:**
```
Construct the narrative flow in this order:
1. Start by describing the main Subject (the central visual element)
2. Next, describe the Action (the active process, movement, or behavior)
3. Finally, describe the Setting (the specific environment or context)
```
- **Highly structured 3-part narrative**: Subject → Action → Setting
- Clear, sequential flow
- More prescriptive about structure

#### B. **Grade Level Handling**

**Versions 1-4:**
```
**Style Requirements:**
- The style must be appropriate for the **Grade Level** and **Subject**.
- For younger students (e.g., K-5), use styles like "colorful illustration", "simple diagram", or "cartoon style".
- For older students (e.g., 6-12, University), use styles like "detailed diagram", "realistic illustration", "infographic", or "educational chart".
```
- **Explicitly mentioned in generation prompt**
- Provided specific style guidance based on grade level
- AI needed to adapt style in the prompt itself

**Current:**
```
The narrative must be vivid and factual, ensuring the image serves as a clear visual aid for the topic being presented.
```
- **Grade level NOT mentioned in generation prompt**
- No grade-based style adaptation in generation
- Style is uniform (handled by static STYLE_GUIDELINES)

#### C. **Examples & Guidance**

**Versions 1-4:**
- Version 1 included extensive examples:
  ```
  **Examples of Good Prompts:**
  - (For 1st Grade Science): "A colorful, simple illustration..."
  - (For University Biology): "A detailed, scientifically accurate..."
  
  **Examples of Bad Prompts:**
  - "Abstract representation of concepts" (too abstract)
  ```
- Provided concrete examples of what to do/avoid
- Helped LLM understand expectations

**Current:**
- **No examples provided**
- Relies on the 3-part structure instruction
- More minimalist approach

#### D. **Specificity Level**

**Versions 1-4:**
```
- **Visual Description ONLY:** Focus strictly on visible objects, actions, and settings.
- **NO Diagrams:** Do not request diagrams that require text labels.
- **NO Style Instructions:** Do not include words like "vector", "style", "photorealistic".
- **Content Alignment:** The image must directly illustrate the "Content" provided above.
```
- Multiple specific constraints
- Explicit "DO NOT" statements
- Detailed rules about what to avoid

**Current:**
```
Generate a detailed visual narrative for an educational image that illustrates the key information on this slide.
Construct the narrative flow in this order: [Subject → Action → Setting]
The narrative must be vivid and factual, ensuring the image serves as a clear visual aid.
```
- **Fewer explicit constraints**
- Focus on structure rather than restrictions
- More positive instructions (what TO do) vs negative (what NOT to do)

#### E. **Text/Labels Policy**

**Versions 1-4:**
- Version 1: **Encouraged text/labels** ("INCLUDE TEXT AND LABELS")
- Versions 2-4: **Explicitly forbidden** ("NO Diagrams", "Do not request diagrams that require text labels")
- Clear policy stated in generation prompt

**Current:**
- **Not mentioned in generation prompt**
- Policy implicit via style guidelines (pure white background, no text overlay areas)
- Less explicit about text handling

---

## 2. PROMPT SENT TO IMAGE GENERATION API

### Similarities ✅

1. **Two-Part Structure**
   - Both append style guidelines to user-generated prompt
   - Both separate content from style

2. **Static Style Guidelines**
   - Both use predefined, consistent style rules
   - Both ensure uniform visual appearance

3. **Simple Concatenation**
   - Both use simple string concatenation
   - `${userPrompt}\n\n${styleGuidelines}` pattern

### Differences ❌

#### A. **Style Guidelines Content**

**Versions 2-4 (IMAGE_STYLE_GUIDE):**
```javascript
const IMAGE_STYLE_GUIDE = `
**Visual Style Guidelines:**
- **Art Style:** Flat vector-style educational illustration. Professional, clean lines.
- **Background:** Clean, solid, or white background. No scenic backgrounds or visual clutter.
- **Color & Contrast:** High contrast, distinct colors optimized for classroom projection.
- **Typography:** Use LARGE, BOLD, Sans-Serif fonts for all text. Ensure maximum readability from a distance.
- **Labeling:** Connect labels with clear, straight lines. No floating text.
`;
```
- **More detailed and structured**
- Separate sections (Art Style, Background, Color, Typography, Labeling)
- Includes typography/labeling instructions (contradictory with "NO Diagrams" rule)
- More verbose (~6 lines)

**Current (STYLE_GUIDELINES):**
```javascript
const STYLE_GUIDELINES = "Front view, sharp focus throughout. Neutral, uniform technical lighting with no shadows. Clean, flat vector illustration style on a pure-white invisible background. Minimalist palette of 3–5 solid, high-contrast colors without gradients.";
```
- **Single sentence, concise**
- All constraints in one flowing sentence
- No typography/labeling mention (consistent with no-text policy)
- More compact (~1 line)

#### B. **Prompt Structure at API Call**

**Versions 2-4:**
```javascript
const enhancedPrompt = `
**Image Subject:**
${prompt}

**Target Audience:**
${gradeLevel} Grade Students

${IMAGE_STYLE_GUIDE}`;
```
- **Structured with headers** ("Image Subject:", "Target Audience:")
- Explicitly includes grade level
- More verbose formatting

**Current:**
```javascript
const finalPrompt = `${imagePrompt}\n\n${STYLE_GUIDELINES}`;
```
- **Direct concatenation** (no headers or structure)
- Grade level NOT included in API call
- Minimal formatting

#### C. **Grade Level in API Call**

**Versions 2-4:**
- Grade level explicitly included: `**Target Audience:** ${gradeLevel} Grade Students`
- API received grade level information
- Could potentially adapt output based on grade (though style guide was static)

**Current:**
- **Grade level NOT passed to API**
- Style is completely uniform regardless of grade
- Simpler, more consistent output

#### D. **Contradictions**

**Versions 2-4:**
- Generation prompt said "NO Diagrams" / "Do not request diagrams that require text labels"
- But IMAGE_STYLE_GUIDE said "Use LARGE, BOLD, Sans-Serif fonts" and "Labeling: Connect labels..."
- **Internal contradiction**: Forbidding text in generation but instructing text formatting in style guide

**Current:**
- **No contradictions**: Generation prompt doesn't mention text, style guidelines don't mention text
- Consistent no-text policy throughout
- Cleaner, more coherent

---

## 3. KEY ARCHITECTURAL DIFFERENCES

### Prompt Building Approach

**Versions 1-4:**
- Inline prompt building within `generateSlidesFromDocument`
- String concatenation in one large function
- Less modular

**Current:**
- **Modular functions**: `buildImagePromptInstructionsSection()` 
- Extracted into separate, testable functions
- Part of larger modular prompt building system
- More maintainable

### Style Guide Location

**Versions 2-4:**
- Style guide as a constant in the same file (`IMAGE_STYLE_GUIDE`)
- Shared between generation and API call

**Current:**
- Style guide in image generation service (`STYLE_GUIDELINES`)
- **Separated by concern**: Generation logic vs API call logic
- Better separation of concerns

---

## 4. SUMMARY TABLE

| Feature | Versions 1-4 | Current | Change |
|---------|--------------|---------|--------|
| **Narrative Structure** | Varied/unstructured | Subject → Action → Setting | ✅ More structured |
| **Grade Level in Gen Prompt** | ✅ Yes (with examples) | ❌ No | Removed |
| **Grade Level in API Call** | ✅ Yes | ❌ No | Removed |
| **Examples in Prompt** | ✅ Yes (Version 1) | ❌ No | Removed |
| **Text/Labels Policy** | Explicit (varied) | Implicit (via style) | More implicit |
| **Style Guide Length** | ~6 lines (detailed) | 1 sentence (concise) | More concise |
| **Style Guide Content** | Includes typography | No typography | Cleaner |
| **Contradictions** | Yes (text policy) | No | Fixed |
| **Modularity** | Low | High | Improved |
| **Prompt Format at API** | Structured headers | Direct concat | Simpler |

---

## 5. PHILOSOPHICAL SHIFTS

### Version 1-4 Philosophy:
- **"Tell the AI what to do and what not to do, with examples"**
- Provide extensive guidance and constraints
- Adapt style based on grade level
- Explicit rules and examples

### Current Philosophy:
- **"Give simple structure, let style guide handle appearance"**
- Minimal instructions, clear structure
- Uniform style regardless of grade
- Implicit constraints via style guidelines

### Key Insight:
The current version represents a **simplification and separation of concerns**:
- **Generation prompt**: Focus on WHAT to describe (Subject → Action → Setting)
- **Style guidelines**: Handle HOW it should look (uniform, technical, educational)

Versions 1-4 tried to do both in the generation prompt, leading to contradictions and complexity.

---

## 6. WHAT WAS LOST

1. **Grade-Level Adaptation**: Current version doesn't adapt style based on grade (e.g., simple for K-5, detailed for 6-12)
2. **Example Guidance**: No concrete examples of good/bad prompts
3. **Explicit Constraints**: Fewer "DO NOT" statements

## 7. WHAT WAS GAINED

1. **Consistency**: Uniform style across all grades
2. **Simplicity**: Cleaner, easier to understand prompts
3. **Structure**: Clear Subject → Action → Setting flow
4. **No Contradictions**: Eliminated text policy conflicts
5. **Maintainability**: Modular, testable prompt building
6. **Separation of Concerns**: Generation vs Style handling

---

## CONCLUSION

The current version represents an evolution toward **simplicity and consistency**. It trades grade-level adaptability and explicit guidance for a cleaner, more structured approach with uniform style handling. The Subject → Action → Setting structure provides clear guidance while the static style guidelines ensure consistent output quality.

**Trade-offs:**
- ✅ Simpler, more maintainable
- ✅ No contradictions
- ✅ Consistent style
- ❌ Less adaptive to grade level
- ❌ Fewer examples/guidance for LLM
