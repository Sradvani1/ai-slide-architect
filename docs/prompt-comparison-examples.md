# Prompt Comparison: Before vs After

## Example Scenario
- **Topic:** "Photosynthesis"
- **Subject:** "Biology"
- **Grade Level:** "8th Grade"
- **Slide Title:** "The Light-Dependent Reactions"
- **Slide Content:** 
  - "Chlorophyll absorbs light energy"
  - "Water molecules are split (photolysis)"
  - "Oxygen is released as a byproduct"
  - "ATP and NADPH are produced"
- **Additional Instructions:** "Focus on visual clarity for students with learning differences"
- **Source Material:** (Long document about photosynthesis - 2000+ words)

---

## CURRENT STATE

### Original (During Slide Deck Creation)

**Purpose:** Generate the ENTIRE slide deck (all slides with titles, content, image prompts, speaker notes)

```
You are an expert educational content creator and curriculum designer.
Your goal is to generate a professional, engaging slide deck that is tailored to the specified grade level.

PRESENTATION CONTEXT
Topic: "Photosynthesis"
Subject: Biology
Target Audience: 8th Grade
Length: 6 slides (1 Title + 5 Content)
- Additional Instructions: "Focus on visual clarity for students with learning differences"

SOURCE MATERIAL (GROUND TRUTH)
You must derive your content ENTIRELY from the following text. Do not contradict it.

SOURCE BEGIN:
[Full 2000+ word document about photosynthesis...]
SOURCE END

CONTENT STANDARDS
1. Educational Value: Content must be accurate, age-appropriate, and pedagogically sound.
2. Clarity: Use clear, concise language.
3. Engagement: Speaker notes should be engaging and conversational (script format).

STRUCTURE REQUIREMENTS
- Slide 1: Title Slide (Title, Content, imagePrompt, Speaker Notes)...
- Slides 2-6: Content Slides (Title, Content, imagePrompt, Speaker Notes).

FORMATTING CONSTRAINTS(CRITICAL)
- Bullets: Exactly 4 bullet points per content slide.
- No Markdown: Bullet points must be plain strings...

IMAGE PROMPT GENERATION

PURPOSE & CONTEXT:
These images will be used by a teacher in classroom presentations...

[Full image prompt instructions section...]

OUTPUT FORMAT
Return a valid JSON array of objects...
```

**Result:** AI generates:
- ✅ **ENTIRE slide deck** (all slides with titles, content, image prompts, speaker notes)
- Full context from source material
- Content standards awareness
- Additional instructions considered
- Understanding of entire deck structure

---

### Regenerate (Current - AFTER)

**Purpose:** Generate ONLY the image prompt text for ONE existing slide (NOT the entire deck, NOT the slide content)

```
You are an expert educational content creator and curriculum designer.
Your goal is to generate a professional, engaging slide deck that is tailored to the specified grade level.
⚠️ NOTE: This system role is misleading - we're only asking for an image prompt, not a slide deck!

PRESENTATION CONTEXT
Topic: "Photosynthesis"
Subject: Biology
Target Audience: 8th Grade

CURRENT SLIDE
Title: "The Light-Dependent Reactions"
Content:
- Chlorophyll absorbs light energy
- Water molecules are split (photolysis)
- Oxygen is released as a byproduct
- ATP and NADPH are produced

IMAGE PROMPT GENERATION

PURPOSE & CONTEXT:
These images will be used by a teacher in classroom presentations...

[Full image prompt instructions section...]

TEXT AND LABELS:
- Return ONLY the image prompt text.
- Do not include any JSON formatting or labels like "imagePrompt:".
- Do not include markdown code fences.
```

**Result:** AI generates:
- ✅ **ONLY the image prompt text** (plain string, no JSON, no formatting)
- Only slide title and bullets as context
- No source material context
- No content standards
- No additional instructions
- Less context = potentially different style/quality

**Example Output:**
```
A detailed illustration showing chlorophyll molecules in a plant leaf absorbing sunlight. 
Water molecules are being split apart in a process called photolysis, with oxygen 
bubbles being released. ATP and NADPH molecules are being produced and shown as 
energy-carrying particles. The scene is set in a cross-section of a leaf, with 
clear labels indicating each process.
```

---

## AFTER IMPLEMENTATION (Moderate Approach)

### Regenerate (After - WITH Moderate Context & Gemini Framework)

**Purpose:** Generate ONLY the image prompt text for ONE existing slide (NOT the entire deck, NOT the slide content)

```
<system_instructions>
  You are an expert educational content creator and curriculum designer.
</system_instructions>

<task>
  Generate a detailed description of an educational illustration that clearly depicts the key concepts from this slide.
  
  The illustration will be used by a teacher in classroom presentations as a standalone educational resource that visually explains the concept to students.
  
  Construct the description in this order:
  1. Start by describing the main Subject (the central visual element)
  2. Next, describe the Action (the active process, movement, or behavior)
  3. Finally, describe the Setting (the specific environment or context)
</task>

<constraints>
  1. Educational Value: The description must be accurate, age-appropriate, and pedagogically sound for 8th Grade students.
  2. Visual Clarity: Focus on visual elements that directly explain or demonstrate the key concepts being taught.
  3. Concrete Details: Describe concrete, visible objects and processes that students can observe and understand.
  4. Text and Labels: Include explanatory text, labels, and annotations where they enhance understanding. Specify which elements should be labeled and what the labels should say.
  5. Complexity: Ensure the visual complexity is appropriate for 8th Grade students.
  6. Exclusions: Strictly exclude descriptions of Composition, Lighting, Style, and Background.
</constraints>

<output_format>
  Return ONLY the image prompt text as a plain string.
  - Do not include any JSON formatting or labels like "imagePrompt:".
  - Do not include markdown code fences.
  - Do not include any prefixes or metadata.
  - Output only the description text itself.
</output_format>

<context>
  PRESENTATION CONTEXT
  Topic: "Photosynthesis"
  Subject: Biology
  Target Audience: 8th Grade
  Additional Instructions: "Focus on visual clarity for students with learning differences"
  
  CONTENT STANDARDS
  - Educational Value: Content must be accurate, age-appropriate, and pedagogically sound.
  - Clarity: Use clear, concise language.
  - Engagement: The illustration should help a teacher convey information clearly and effectively.
</context>

<input>
  CURRENT SLIDE
  Title: "The Light-Dependent Reactions"
  Content:
  - Chlorophyll absorbs light energy
  - Water molecules are split (photolysis)
  - Oxygen is released as a byproduct
  - ATP and NADPH are produced
</input>
```

**Result:** AI generates:
- ✅ **ONLY the image prompt text** (plain string, no JSON, no formatting)
- **Gemini Framework Structure:** Clear, organized sections following best practices
- **Content standards** (NEW - ensures educational quality)
- **Additional instructions** (NEW - respects user preferences like "focus on visual clarity")
- **Better organization:** Constraints, task, and output format are clearly separated
- **More consistent** with original generation

**Example Output:**
```
A detailed illustration showing chlorophyll molecules in a plant leaf absorbing sunlight, 
designed with high visual clarity for students with learning differences. Water molecules 
are being split apart in a process called photolysis, with large, clearly visible oxygen 
bubbles being released. ATP and NADPH molecules are prominently displayed as energy-carrying 
particles with distinct shapes and colors. The scene is set in a cross-section of a leaf 
with simplified, easy-to-distinguish elements and clear labels indicating each process.
```

**Key Improvements:**
- ✅ Follows Gemini framework structure (system_instructions → task → constraints → output_format → context → input)
- ✅ Clear separation of concerns (each section has a specific purpose)
- ✅ Constraints are explicitly listed and numbered
- ✅ Output format is unambiguous
- ✅ Context includes all necessary background (standards, additional instructions)
- ✅ Input is clearly separated from instructions

---

## Key Differences

| Aspect | Original (Creation) | Regenerate (Current) | Regenerate (After) |
|--------|---------------------|----------------------|-------------------|
| **What It Generates** | Entire slide deck (all slides) | **Only image prompt text** | **Only image prompt text** |
| **Framework Structure** | Unstructured | Unstructured | ✅ **Gemini Framework** (system_instructions → task → constraints → output_format → context → input) |
| Source Material | ✅ Full document | ❌ None | ❌ None (moderate approach) |
| Content Standards | ✅ Yes | ❌ No | ✅ Yes |
| Additional Instructions | ✅ Yes | ❌ No | ✅ Yes |
| Structure Requirements | ✅ Yes | ❌ No | ❌ No (not needed) |
| Formatting Constraints | ✅ Yes | ❌ No | ❌ No (not needed) |
| Image Instructions | ✅ Yes | ✅ Yes | ✅ Yes |
| Temperature | From user input | Fixed 0.7 | From project settings |
| Output Format | JSON array of slide objects | Plain text string | Plain text string |
| **Organization** | Mixed sections | Mixed sections | ✅ **Clear section separation** |

---

## Why Moderate Approach + Gemini Framework?

**Include:**
- ✅ **Content Standards** - Ensures educational quality and age-appropriateness
- ✅ **Additional Instructions** - Respects user's specific requirements (e.g., "focus on visual clarity")
- ✅ **Gemini Framework Structure** - Follows best practices for prompt organization and clarity

**Exclude:**
- ❌ **Source Material** - Slide content already distills the key points. Full source would add 2000+ tokens for minimal benefit
- ❌ **Structure Requirements** - Not relevant for single slide regeneration
- ❌ **Formatting Constraints** - Not relevant for image prompt generation

**Result:** Better consistency without unnecessary token cost, plus improved prompt structure that's easier for the AI to parse and follow.

## Framework Structure Benefits

The Gemini framework structure provides:
1. **Clear Role Definition** (`<system_instructions>`) - Sets the AI's identity
2. **Explicit Task** (`<task>`) - States exactly what needs to be done
3. **Organized Constraints** (`<constraints>`) - Lists all requirements in numbered format
4. **Unambiguous Output** (`<output_format>`) - Specifies exactly what format to return
5. **Rich Context** (`<context>`) - Provides background, standards, and user preferences
6. **Clear Input** (`<input>`) - Separates the data to process from instructions

This structure makes the prompt easier for the AI to understand and follow, leading to more consistent results.

