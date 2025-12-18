# Prompt Improvement Recommendations: Learning from Versions 1-4

## Key Questions Answered

### 1. Where do text instructions belong?

**Answer: It depends on your policy, but here's the framework:**

- **CONTENT Generation Prompt**: If you want text/labels, specify WHAT text to include and WHERE
  - Example: "Include labels for key parts: nucleus, mitochondria, chloroplasts"
  - This is about semantic content (what information the image communicates)
  
- **STYLE Guidelines**: If you don't want text, enforce it via visual constraints
  - Example: "Pure white background with no text overlay areas"
  - This is about visual appearance (how it looks)

**Current Approach (No Text):**
- ✅ **STYLE Guidelines** is correct - enforce no text via visual constraints
- ❌ But should also be explicit in CONTENT generation: "Do not describe any text, labels, or annotations in your prompt"

**Recommendation**: Add explicit "NO TEXT" constraint in content generation, then enforce via style.

---

### 2. Where does purpose/context belong?

**Answer: CONTENT Generation Prompt** - This is critical for quality!

The purpose statement tells the LLM **WHY** it's creating the image, which shapes **WHAT** it includes:

**Version 1 had this (in API call, but should be in generation):**
```
PURPOSE: This illustration will be used by a teacher in a presentation slide. 
It should be a standalone educational resource that visually explains the concept to students.
```

**Why this matters:**
- Helps LLM understand the audience (teacher needs clear, explanatory visuals)
- Shapes content decisions (what details are important for teaching)
- Influences complexity level (standalone = self-contained, no context needed)

**Recommendation**: Add purpose/context to CONTENT generation prompt.

---

## High-Quality Elements from Versions 1-4

### ✅ What Made Versions 1-4 High Quality:

1. **Purpose Statement** - "This illustration will be used by a teacher..."
2. **Examples** - Concrete good/bad prompt examples
3. **Grade Level Context** - Helped adapt complexity/detail level
4. **Explicit Educational Focus** - "visually explains the concept to students"

### ❌ What Caused Inconsistency:

1. **Style varied by grade** - Different styles for K-5 vs 6-12
2. **Style instructions in generation prompt** - LLM tried to adapt style itself
3. **Text policy contradictions** - Mixed messages about labels

---

## Proposed Improved Prompts

### Option A: Enhanced Content + Uniform Style (Recommended)

This keeps your current consistency while adding quality boosters from v1-4.

#### CONTENT Generation Prompt (Enhanced):

```typescript
function buildImagePromptInstructionsSection(): string {
  return `
  IMAGE PROMPT GENERATION
  
  PURPOSE & CONTEXT:
  These images will be used by teachers in classroom presentations. Each image must be a 
  standalone educational resource that visually explains the concept to students. The image 
  should help teachers convey information clearly and effectively.
  
  For each slide, generate a detailed visual narrative for an educational image that 
  illustrates the key information on this slide.
  
  Construct the narrative flow in this order:
  1. Start by describing the main Subject (the central visual element)
  2. Next, describe the Action (the active process, movement, or behavior)
  3. Finally, describe the Setting (the specific environment or context)
  
  CONTENT REQUIREMENTS:
  - The narrative must be vivid and factual, ensuring the image serves as a clear visual aid.
  - Focus on visual elements that directly explain or demonstrate the concept being taught.
  - Describe concrete, visible objects and processes that students can observe and understand.
  - DO NOT include any text, labels, words, or annotations in your description.
  - Ensure the visual complexity is appropriate for ${gradeLevel} students (but do not mention style - that is handled separately).
  
  OUTPUT FORMAT:
  Output the image prompt as a simple string in the \`imagePrompt\` field.
  `;
}
```

**Key additions:**
- ✅ Purpose/context statement (teacher presentation, standalone resource)
- ✅ Explicit "NO TEXT" constraint in content generation
- ✅ Grade level mentioned for complexity (but NOT for style)
- ✅ Educational focus emphasized

#### STYLE Guidelines (Enhanced with Purpose):

```typescript
const STYLE_GUIDELINES = `
PURPOSE: This image will be displayed in a teacher's presentation slide for classroom use.

VISUAL STYLE:
Front view, sharp focus throughout. Neutral, uniform technical lighting with no shadows. 
Clean, flat vector illustration style on a pure-white invisible background. 
Minimalist palette of 3–5 solid, high-contrast colors without gradients.

TEXT POLICY:
No text, labels, words, or annotations anywhere in the image. The pure white background 
provides no space for text overlay.

OPTIMIZATION:
Optimized for classroom projection - high contrast, clear visibility from a distance, 
suitable for students viewing on a screen or whiteboard.
`;
```

**Key additions:**
- ✅ Purpose statement reinforces context
- ✅ Explicit "NO TEXT" policy in style (redundant but clear)
- ✅ Classroom optimization mentioned

---

### Option B: Grade-Adaptive Complexity (If you want quality boost)

This maintains uniform STYLE but adapts CONTENT complexity based on grade:

```typescript
function buildImagePromptInstructionsSection(gradeLevel: string): string {
  const complexityGuidance = parseGradeLevel(gradeLevel) <= 5 
    ? "Focus on simple, clear visual elements that are easy to recognize and understand. Use basic concepts and avoid technical complexity."
    : "Include detailed, specific visual elements that accurately represent the concept. Technical accuracy is important.";
    
  return `
  IMAGE PROMPT GENERATION
  
  PURPOSE & CONTEXT:
  These images will be used by teachers in classroom presentations. Each image must be a 
  standalone educational resource that visually explains the concept to students.
  
  For each slide, generate a detailed visual narrative for an educational image that 
  illustrates the key information on this slide.
  
  Construct the narrative flow in this order:
  1. Start by describing the main Subject (the central visual element)
  2. Next, describe the Action (the active process, movement, or behavior)
  3. Finally, describe the Setting (the specific environment or context)
  
  COMPLEXITY GUIDANCE:
  ${complexityGuidance}
  
  CONTENT REQUIREMENTS:
  - The narrative must be vivid and factual, ensuring the image serves as a clear visual aid.
  - Focus on visual elements that directly explain or demonstrate the concept being taught.
  - Describe concrete, visible objects and processes that students can observe and understand.
  - DO NOT include any text, labels, words, or annotations in your description.
  
  OUTPUT FORMAT:
  Output the image prompt as a simple string in the \`imagePrompt\` field.
  `;
}
```

**Trade-off**: Better quality/appropriateness, but slightly more complexity.

---

### Option C: Add Examples (Optional Enhancement)

If you want maximum quality, add examples back (but keep style uniform):

```typescript
function buildImagePromptInstructionsSection(): string {
  return `
  IMAGE PROMPT GENERATION
  
  PURPOSE & CONTEXT:
  These images will be used by teachers in classroom presentations. Each image must be a 
  standalone educational resource that visually explains the concept to students.
  
  [... structure instructions ...]
  
  EXAMPLES OF GOOD PROMPTS:
  - (Science, any grade): "A plant cell with a large central nucleus, green chloroplasts scattered throughout, 
    and a rigid cell wall surrounding the entire structure. The organelles are clearly visible and distinct 
    in shape and color."
  - (History, any grade): "A group of colonial figures in period clothing gathered around a wooden table, 
    with quill pens and parchment documents visible. The setting is a formal meeting room with natural 
    light from windows."
  
  EXAMPLES TO AVOID:
  - "Abstract representation of concepts" (too vague)
  - "Simple icon or minimalist graphic" (not educational enough)
  - "Image showing [concept] with labels" (we don't use labels)
  
  [... rest of instructions ...]
  `;
}
```

---

## Recommended Implementation

### Phase 1: Essential Improvements (Do This)

1. **Add Purpose/Context to Content Generation**
   ```typescript
   PURPOSE & CONTEXT:
   These images will be used by teachers in classroom presentations. Each image must be a 
   standalone educational resource that visually explains the concept to students.
   ```

2. **Add Explicit "NO TEXT" to Content Generation**
   ```typescript
   - DO NOT include any text, labels, words, or annotations in your description.
   ```

3. **Add Purpose to Style Guidelines**
   ```typescript
   PURPOSE: This image will be displayed in a teacher's presentation slide for classroom use.
   ```

### Phase 2: Quality Boosters (Consider This)

4. **Add Grade Level for Complexity** (in content, not style)
   ```typescript
   - Ensure the visual complexity is appropriate for ${gradeLevel} students
   ```

5. **Add Examples** (optional but helps)
   - 2-3 good examples
   - 2-3 examples to avoid

### Phase 3: Advanced (If Needed)

6. **Grade-adaptive complexity** (Option B above)

---

## Where Things Belong - Summary Table

| Element | Where It Belongs | Why |
|---------|------------------|-----|
| **Purpose/Context** | CONTENT Generation | Shapes WHAT to include (educational elements, teacher-focused) |
| **"NO TEXT" policy** | BOTH (redundancy is good) | CONTENT: What not to describe<br>STYLE: Visual enforcement |
| **Grade level** | CONTENT Generation | Influences complexity/detail (WHAT content), not visual style |
| **Subject → Action → Setting** | CONTENT Generation | Structure of WHAT to describe |
| **Visual style (vector, colors, etc.)** | STYLE Guidelines | HOW it looks |
| **Background (white, no text space)** | STYLE Guidelines | Visual appearance |
| **Examples** | CONTENT Generation | Helps understand WHAT to create |
| **Educational focus** | CONTENT Generation | Influences content choices |

---

## Key Principle

**CONTENT Generation = WHAT and WHY**
- What to describe
- Why it's being created (purpose)
- Who it's for (teachers/students)
- What complexity level

**STYLE Guidelines = HOW**
- Visual appearance
- Technical constraints
- Consistency enforcement

---

## Implementation Checklist

- [ ] Add purpose/context statement to `buildImagePromptInstructionsSection()`
- [ ] Add explicit "NO TEXT" constraint to content generation
- [ ] Add purpose statement to `STYLE_GUIDELINES`
- [ ] Add grade level mention (for complexity, not style)
- [ ] (Optional) Add examples section
- [ ] Test quality vs consistency balance
- [ ] Monitor if grade-adaptive complexity is needed

---

## Expected Outcomes

### Quality Improvements:
- ✅ Better understanding of educational purpose
- ✅ More appropriate content for teaching
- ✅ Clearer visual narratives

### Consistency Maintained:
- ✅ Uniform style (handled by STYLE_GUIDELINES)
- ✅ No style variations
- ✅ Clean, professional appearance

### Best of Both Worlds:
- ✅ High quality from versions 1-4
- ✅ Consistency from current approach
- ✅ Clear separation of concerns
