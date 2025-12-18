# Complete Guide to Gemini 3 Pro Image (Nano Banana Pro) Prompting Strategies

## Table of Contents
1. [Core Principles](#core-principles)
2. [Prompt Fundamentals](#prompt-fundamentals)
3. [Text-to-Image Prompting Templates](#text-to-image-prompting-templates)
4. [Image Editing Strategies](#image-editing-strategies)
5. [Advanced Multi-Image Techniques](#advanced-multi-image-techniques)
6. [Professional Prompting Best Practices](#professional-prompting-best-practices)
7. [Model Configuration & Parameters](#model-configuration--parameters)
8. [Common Mistakes & Solutions](#common-mistakes--solutions)
9. [Workflow Recommendations](#workflow-recommendations)

---

## Core Principles

### The Fundamental Rule
**Describe the scene, don't just list keywords.** Use narrative, descriptive paragraphs for coherent, high-quality results. The model's core strength is its deep language understanding, particularly with Gemini 3 Pro's advanced text encoder trained on Markdown, JSON, and complex technical documentation.

### Why This Matters
- Gemini 3 Pro Image uses an autoregressive architecture (generates tokens sequentially)
- It benefits from training on extensive annotated image datasets from Google Images
- The multimodal encoder understands nuanced relationships between visual elements
- It can parse complex structured inputs like JSON and Markdown

### Model Comparison

| Feature | Gemini 2.5 Flash Image | Gemini 3 Pro Image |
|---------|------------------------|-------------------|
| **Speed** | <2 seconds | Slower (uses "thinking") |
| **Text Rendering** | Good for short text | Excellent, even complex text |
| **Reference Images** | Limited (1-3 optimal) | Supports 14 images |
| **Resolution** | 1K (1024×1024) | 1K, 2K, 4K options |
| **Reasoning** | Basic | Advanced "thinking" process |
| **Use Case** | Rapid ideation, drafts | Professional assets, complex tasks |

---

## Prompt Fundamentals

### The Five Core Components

Every effective prompt contains these five elements:

#### 1. **Subject (The "What")**
- Describe the main object, person, animal, or scenery
- Include specific details and characteristics
- Example: "A translucent glass robot barista with LED eyes"

#### 2. **Action (The "What's Happening")**
- What is the subject doing?
- Include verbs that describe movement or state
- Example: "pouring latte art into a ceramic cup"

#### 3. **Location/Context (The "Where")**
- Where does the subject exist?
- Include environmental details
- Example: "inside a cozy, cyberpunk coffee shop with neon pink and teal signage"

#### 4. **Composition/Camera Angle (The "How It's Framed")**
- Shot type and perspective
- Depth of field and focal length
- Example: "Macro close-up shot, shallow depth of field (f/1.8), overhead perspective"

#### 5. **Lighting & Atmosphere (The "Mood")**
- Light quality, direction, and color temperature
- Overall mood or emotional tone
- Example: "illuminated by neon pink and teal signage reflection, cinematic 8k render"

### The Perfect Prompt Formula

```
[Subject + Adjectives] doing [Action] in [Location/Context].
[Composition/Camera Angle]. [Lighting/Atmosphere].
[Style/Media]. [Specific Constraint/Text].
```

### Complete Example

```
A translucent glass robot barista with subtle LED eyes doing pouring latte art 
into a ceramic cup inside a cozy, cyberpunk coffee shop with neon pink and teal 
signage. Macro close-up shot, shallow depth of field (f/1.8). Illuminated by 
neon pink and teal signage reflection, cinematic 8k render, Octane render style. 
The robot's chest display reads "WAKE UP" in bold LCD font.
```

---

## Text-to-Image Prompting Templates

### Template 1: Photorealistic Photography

**Best for:** Product shots, portraits, lifestyle photography, realistic scenes

```
A photorealistic [shot type] of [subject], [action or expression], set in 
[environment]. The scene is illuminated by [lighting description], creating a 
[mood] atmosphere. Captured with a [camera/lens details], emphasizing [key 
textures and details]. The image should be in a [aspect ratio] format.
```

**Example:**
```
A photorealistic close-up portrait of an elderly Japanese ceramicist with deep, 
sun-etched wrinkles and a warm, knowing smile. He is carefully inspecting a 
freshly glazed tea bowl. The setting is his rustic, sun-drenched workshop. 
The scene is illuminated by soft, golden hour light streaming through a window, 
highlighting the fine texture of the clay. Captured with an 85mm portrait lens, 
resulting in a soft, blurred background (bokeh). The overall mood is serene and 
masterful. Vertical portrait orientation.
```

### Template 2: Stylized Illustrations & Stickers

**Best for:** Graphic assets, icons, branded illustrations, stickers

```
A [style] sticker of a [subject], featuring [key characteristics] and a 
[color palette]. The design should have [line style] and [shading style]. 
The background must be white.
```

**Example:**
```
A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. 
It's munching on a green bamboo leaf. The design features bold, clean outlines, 
simple cel-shading, and a vibrant color palette. The background must be white.
```

### Template 3: Text in Images (Logos, Headers, Diagrams)

**Best for:** Logos, posters, title cards, branded content

Use Gemini 3 Pro only—it has superior text rendering capabilities.

```
Create a [image type] for [brand/concept] with the text "[text to render]" 
in a [font style]. The design should be [style description], with a [color scheme].
```

**Example:**
```
Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'. 
The text should be in a clean, bold, sans-serif font. The design should feature 
a simple, stylized icon of a coffee bean seamlessly integrated with the text. 
The color scheme is black and white.
```

### Template 4: Product Photography

**Best for:** E-commerce, advertising, brand photography

```
A high-resolution, studio-lit product photograph of a [product description] 
on a [background surface/description]. The lighting is a [lighting setup] to 
[lighting purpose]. The camera angle is a [angle type] to showcase [specific feature]. 
Ultra-realistic, with sharp focus on [key detail]. [Aspect ratio].
```

**Example:**
```
A high-resolution, studio-lit product photograph of a minimalist ceramic coffee 
mug in matte black, presented on a polished concrete surface. The lighting is a 
three-point softbox setup designed to create soft, diffused highlights and 
eliminate harsh shadows. The camera angle is a slightly elevated 45-degree shot 
to showcase its clean lines. Ultra-realistic, with sharp focus on the steam 
rising from the coffee. Square image.
```

### Template 5: Backgrounds for Text Overlay

**Best for:** Website headers, presentations, marketing materials

```
A minimalist composition featuring a single [subject] positioned in the 
[location in frame]. The background is a vast, empty [color] canvas, 
creating significant negative space. Soft, subtle lighting. [Aspect ratio].
```

**Example:**
```
A minimalist composition featuring a single, delicate red maple leaf positioned 
in the bottom-right of the frame. The background is a vast, empty off-white 
canvas, creating significant negative space for text. Soft, diffused lighting 
from the top left. Square image.
```

### Template 6: Sequential Art & Storyboards

**Best for:** Comic panels, sequential narratives, storyboards

```
A single comic book panel in a [art style] style. In the foreground, 
[character description and action]. In the background, [setting details]. 
The panel has a [dialogue/caption box] with the text "[Text]". The lighting 
creates a [mood] mood. [Aspect ratio].
```

**Example:**
```
A single comic book panel in a gritty, noir art style with high-contrast 
black and white inks. In the foreground, a detective in a trench coat stands 
under a flickering streetlamp, rain soaking his shoulders. In the background, 
the neon sign of a desolate bar reflects in a puddle. A caption box at the top 
reads "The city was a tough place to keep secrets." The lighting is harsh, 
creating a dramatic, somber mood. Landscape orientation.
```

---

## Image Editing Strategies

### Strategy 1: Adding/Removing/Modifying Elements

Provide an image and describe the change you want. The model will analyze the original image's style, lighting, and perspective to make the edit look natural.

```
Using the provided image of [subject], please [add/remove/modify] [element] 
to/from the scene. Ensure the change is [description of how the change 
should integrate].
```

**Example:**
```
Using the provided image of my cat, please add a small, knitted wizard hat 
on its head. Make it look like it's sitting comfortably and matches the soft 
lighting of the photo.
```

### Strategy 2: Semantic Masking (Inpainting Specific Areas)

Edit only one part of an image while leaving the rest completely untouched.

```
Using the provided image, change only the [specific element] to [new 
element/description]. Keep everything else in the image exactly the same, 
preserving the original style, lighting, and composition.
```

**Example:**
```
Using the provided image of a living room, change only the blue sofa to be 
a vintage, brown leather chesterfield sofa. Keep the rest of the room, 
including the pillows on the sofa and the lighting, unchanged.
```

### Strategy 3: Style Transfer

Recreate image content in a specific artistic style while preserving original composition.

```
Transform the provided photograph of [subject] into the artistic style of 
[artist/art movement]. Preserve the original composition but render it with 
[description of stylistic elements].
```

**Example:**
```
Transform the provided photograph of a modern city street at night into the 
artistic style of Vincent van Gogh's 'Starry Night'. Preserve the original 
composition of buildings and cars, but render all elements with swirling, 
impasto brushstrokes and a dramatic palette of deep blues and bright yellows.
```

### Strategy 4: Multi-Image Composition

Combine elements from multiple images to create new composite scenes.

```
Create a new image by combining the elements from the provided images. 
Take the [element from image 1] and place it with/on the [element from image 2]. 
The final image should be a [description of the final scene].
```

**Example:**
```
Create a professional e-commerce fashion photo. Take the blue floral dress 
from the first image and let the woman from the second image wear it. 
Generate a realistic, full-body shot of the woman wearing the dress, with 
the lighting and shadows adjusted to match an outdoor environment.
```

### Strategy 5: Multi-Turn Conversational Editing

Use Gemini's chat capability for iterative refinement.

```
Turn 1: Generate base image
"Create a vibrant infographic that explains photosynthesis as if it were 
a recipe for a plant's favorite food. Show the 'ingredients' (sunlight, 
water, CO2) and the 'finished dish' (sugar/energy). The style should be 
like a page from a colorful kids' cookbook, suitable for a 4th grader."

Turn 2: Request edit
"Update this infographic to be in Spanish. Do not change any other elements 
of the image."

Turn 3: Further refinement
"Make the background a light green and increase the brightness of the colors."
```

---

## Advanced Multi-Image Techniques

### Gemini 3 Pro's 14-Image Reference Support

Gemini 3 Pro Image supports up to 14 reference images:
- **Up to 6 images:** Objects with high fidelity to include in final image
- **Up to 5 images:** Humans to maintain character consistency
- **Up to 3 images:** Style references or layout controls (sketches/wireframes)

### Character Consistency Workflow

**Step 1: Provide Multiple Reference Images**
Upload 3-5 images of the same character from different angles and in different lighting conditions.

**Step 2: Craft Your Prompt**
```
Using the attached reference images of [character/person name], generate 
[new scenario/pose/setting]. Maintain the exact [facial features/body type/
style] from the reference images. [Composition and lighting details].
```

**Example:**
```
Using the attached reference images of Sarah, generate a lifestyle photography 
shot of her sitting on a wet city street at night. Maintain her exact facial 
features and warm skin tone from the references. Cinematic lighting, 4K resolution, 
shot with a 50mm lens.
```

### Group Photo Workflow

```
An office group photo of these people, they are making funny faces. 
All individuals MUST maintain their exact physical proportions and facial 
features consistent with the provided reference images. The setting is a 
modern office with natural window lighting.
```

### Style Transfer with Reference

```
Using the provided reference image of [object/person], recreate it in the 
style of [artistic style] while preserving all specific details from the 
reference image. [Additional composition details].
```

---

## Professional Prompting Best Practices

### 1. Use Hyper-Specificity

**❌ Vague:**
```
Fantasy armor
```

**✅ Specific:**
```
Ornate elven plate armor with silver leaf etchings, falcon-wing pauldrons, 
and intricate rune carvings along the breastplate edges
```

### 2. Always Include Intent/Context

**❌ No context:**
```
Create logo
```

**✅ With context:**
```
Logo for a high-end minimalist skincare brand, target audience: luxury market, 
20-40 year old professionals
```

### 3. Use Structured Formatting for Complex Prompts

Use Markdown or XML-style tags to separate different prompt components:

```
# Subject
A Victorian-era scientist with wild hair and copper goggles

# Action
Examining a glowing crystalline artifact in a laboratory

# Setting
Inside a steampunk laboratory filled with brass machinery and Edison bulbs

# Composition
Over-the-shoulder shot, dramatic perspective, rule of thirds

# Lighting
Warm amber light from Edison bulbs casting long shadows

# Style
Digital oil painting, Rembrandt lighting, high detail

# Constraints
- MUST include visible crystalline artifact
- MUST show detailed facial expression of wonder
- DO NOT include other people in the frame
```

### 4. Deploy ALL CAPS for Critical Constraints

The model responds better to emphasized constraints:

```
The three kittens MUST follow these descriptions EXACTLY:
- Left kitten: black-and-silver fur, blue denim overalls
- Middle kitten: white-and-gold fur, golden monocle
- Right kitten: purple-and-green fur, San Francisco Giants jersey

CRITICAL: All kittens MUST be positioned according to the "rule of thirds" 
both horizontally and vertically.
```

### 5. Layer Complex Prompts with Negative Space Descriptions

Instead of saying "no cars," describe the absence:

**❌ Instruction format:**
```
No cars on the street
```

**✅ Descriptive format:**
```
Empty, deserted street with only pedestrians
```

### 6. Use Camera/Lens Terminology for Precise Control

| Term | Effect |
|------|--------|
| `wide-angle shot` | Captures broad environment, ~10-24mm equivalent |
| `macro shot` | Extreme close-up with shallow depth of field |
| `low-angle perspective` | Camera below subject, looking up |
| `85mm portrait lens` | Flattering focal length for people, bokeh background |
| `Dutch angle` | Tilted composition for tension or drama |
| `rule of thirds` | Compositional positioning along grid lines |

### 7. Incorporate Thought Signatures for Editing Workflows

**Critical for Multi-Turn Editing:**
When the model provides a response with a `thoughtSignature`, always include it in your next request. This preserves the model's reasoning context.

```python
# Turn 1: Generate image
response_1 = model.generate_content(prompt_1)
# Response includes: thought_signature_A

# Turn 2: Edit request
# MUST include: thought_signature_A in the history
response_2 = model.generate_content(
    contents=[...previous_history_with_signatures..., new_edit_prompt]
)
```

### 8. Use Markdown Lists for Rules in Image Editing

When making multiple specific edits, use structured lists:

```
Make ALL of the following edits to the image:

- Put a strawberry in the left eye socket
- Put a blackberry in the right eye socket
- Put a mint garnish on top of the pancake
- Change the plate to a plate-shaped chocolate-chip cookie
- Add happy people to the background
```

### 9. Combine "Buzzwords" Strategically

Quality modifiers work when combined with context:

**Effective buzzwords:**
- `Pulitzer Prize-winning cover photo` (implies professional composition)
- `for The New York Times` (implies news-style photography)
- `Vanity Fair cover profile` (implies luxury, high-production value)
- `4K resolution, HDR` (specific technical specifications)
- `Octane render, Cinema4D` (implies professional 3D rendering quality)

**Note:** Avoid generic 2023-era buzzwords like "trending on ArtStation" or "masterpiece" which can trigger model collapse (generating visually similar AI outputs).

### 10. Iterate Systematically

Start with base image, then make incremental changes:

```
Turn 1: "Generate a forest at dawn"
Turn 2: "Add moss-covered stone altar"
Turn 3: "Place glowing sword on altar"
Turn 4: "Make lighting more mystical with purple hues"
Turn 5: "Increase resolution to 4K, adjust composition"
```

---

## Model Configuration & Parameters

### Python Configuration Example

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[prompt],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        thinking_config=types.ThinkingConfig(
            thinking_level="high"  # "low", "high" (default)
        ),
        image_config=types.ImageConfig(
            aspect_ratio="16:9",  # See aspect ratio table
            image_size="2K"  # "1K", "2K", "4K"
        ),
        tools=[{"google_search": {}}]  # For grounded generation
    )
)
```

### Supported Aspect Ratios

| Ratio | 1K (Gemini 2.5 Flash) | 2K (Gemini 3 Pro) | 4K (Gemini 3 Pro) |
|-------|----------------------|-------------------|-------------------|
| 1:1 (Square) | 1024×1024 | 2048×2048 | 4096×4096 |
| 16:9 (Widescreen) | 1344×768 | 2752×1536 | 5504×3072 |
| 9:16 (Portrait) | 768×1344 | 1536×2752 | 3072×5504 |
| 4:3 (Fullscreen) | 1365×1024 | 2731×2048 | 5462×4096 |
| 3:4 (Portrait FS) | 1024×1365 | 2048×2731 | 4096×5462 |

### Thinking Levels (Gemini 3 Pro Only)

- **`low`:** Minimizes latency and cost. Best for simple instruction following, chat, or high-throughput applications
- **`high` (Default):** Maximizes reasoning depth. Produces more carefully reasoned outputs but takes longer

### Resolution Guidelines

| Media Type | Recommended | Max Tokens | Use Case |
|-----------|------------|-----------|----------|
| Images | `media_resolution_high` | 1120 | Most image generation tasks |
| PDFs | `media_resolution_medium` | 560 | Document understanding |
| Video (General) | `media_resolution_low` | 70/frame | Action recognition |
| Video (Text-heavy) | `media_resolution_high` | 280/frame | OCR and small details |

### Using Google Search Grounding

For real-time data (weather, current events, stock charts):

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="Visualize the current weather forecast for the next 5 days in 
             San Francisco as a clean, modern weather chart. Add a visual on 
             what I should wear each day",
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(aspect_ratio="16:9"),
        tools=[{"google_search": {}}]
    )
)
```

---

## Common Mistakes & Solutions

### Mistake 1: Over-Prompting with Outdated Buzzwords

**❌ Wrong:**
```
4k, trending on artstation, masterpiece, ultra detailed, hyperrealistic, 
award winning, best quality, extremely detailed
```

**✅ Correct:**
```
High-resolution image, for a Vanity Fair cover profile, professional photography, 
detailed textures and accurate lighting
```

**Why:** Gemini 3 Pro understands natural language better. Generic buzzwords trigger model collapse.

### Mistake 2: Vague Text Instructions

**❌ Vague:**
```
Add text to the image
```

**✅ Specific:**
```
Write the text 'HELLO WORLD' in a bold, red, serif font positioned in the 
top-center of the image on a semi-transparent white background
```

### Mistake 3: Contradictory Constraints

**❌ Contradictory:**
```
A photorealistic digital illustration of a person
```

**✅ Consistent:**
```
A photorealistic photograph of a person OR A digital illustration of a person
```

### Mistake 4: Ignoring Thought Signatures in Multi-Turn Editing

**❌ Missing signature:**
```
# Previous response had thought_signature_A
# New request WITHOUT signature:
response = model.generate_content(new_edit_prompt)
```

**✅ Including signature:**
```
# Include full history with all signatures:
response = model.generate_content(
    contents=[
        previous_response_with_signature_A,
        new_edit_prompt
    ]
)
```

### Mistake 5: Excessive Reference Images

**❌ Too many (16 images for character):**
```
Providing 16 images to establish one character
```

**✅ Optimal (3-5 images):**
```
Providing 3-5 images from different angles to establish character consistency
```

### Mistake 6: Forgetting Aspect Ratio Specifications

**❌ No aspect ratio specified:**
```
Generate a landscape photograph of a mountain
```

**✅ Aspect ratio specified:**
```
Generate a landscape photograph of a mountain in 16:9 widescreen format (2K resolution)
```

### Mistake 7: Mixing Photography and Illustration Styles

**❌ Conflicting styles:**
```
A photorealistic oil painting with digital art elements in watercolor style
```

**✅ Clear style choice:**
```
A photorealistic oil painting with thick brushstrokes and classical composition 
technique
```

---

## Workflow Recommendations

### For Rapid Ideation & Drafts: Use Gemini 2.5 Flash

```
1. Start with Gemini 2.5 Flash (gemini-2.5-flash-image)
   - Fast generation (<2 seconds)
   - Lower cost
   - Good for exploring concepts

2. Test different composition ideas
3. Iterate on visual direction
4. Once satisfied, move to Gemini 3 Pro for final asset
```

### For Professional Asset Creation: Use Gemini 3 Pro

```
1. Begin with detailed prompt incorporating all 5 core components
2. Use "thinking" mode for complex compositions
3. Enable Google Search grounding for factual accuracy
4. Specify exact resolution (2K or 4K)
5. Include reference images if character consistency needed
6. Use multi-turn editing to refine
7. Always preserve and return thought signatures
```

### Complete Workflow Example: Creating Branded Product Hero Image

```
# Step 1: Ideation (2-3 minutes)
Model: Gemini 2.5 Flash
Prompt: Simple product description + style
Result: Quick draft to validate concept

# Step 2: Composition Testing (5 minutes)
Model: Gemini 2.5 Flash
Add: Camera angle, lighting variations
Result: 3-4 composition options

# Step 3: Final Asset Creation (10-15 minutes)
Model: Gemini 3 Pro Image
Config: 
  - thinking_level: "high"
  - image_size: "4K"
  - aspect_ratio: "16:9"
Prompt: Complete detailed prompt with all components
Result: Professional 4K asset

# Step 4: Refinement (5-10 minutes)
Model: Gemini 3 Pro Image (same chat/conversation)
Edits:
  - "Adjust background to darker shade"
  - "Increase shadow depth on product"
  - "Make text on packaging more legible"
Result: Polished final asset ready for use
```

### Integrating with SlidesEdu Workflow

For slide deck generation in SlidesEdu:

```
1. GENERATE images for slides:
   - Use Gemini 3 Pro Image for main hero images
   - Specify slide dimensions (16:9 for widescreen)
   - Include text specifications for overlays
   
2. SPEAKER NOTES:
   - Include image generation prompts in speaker notes
   - Document editing iterations for reproducibility
   - Store thought signatures with slide versions

3. CONSISTENCY:
   - Use 3-5 reference images for consistent character/brand
   - Maintain color palette across slides
   - Use consistent lighting/photography style

4. CONTENT TYPES:
   - Educational diagrams: Use Google Search grounding
   - Character illustrations: Upload reference images
   - Product mockups: High-detail product photography template
   - Infographics: Use text rendering capabilities
```

---

## Quick Reference Checklists

### Pre-Prompt Checklist

- [ ] Have I identified the 5 core components (Subject, Action, Location, Composition, Lighting)?
- [ ] Is my prompt descriptive (narrative) rather than just keywords?
- [ ] Have I included specific details rather than generic terms?
- [ ] Are my constraints clear and non-contradictory?
- [ ] Have I specified aspect ratio and resolution?
- [ ] Do I need reference images for consistency?
- [ ] Should I enable Google Search grounding?
- [ ] Is this better suited for Gemini 2.5 Flash or 3 Pro?

### Prompt Quality Checklist

- [ ] Subject is vivid and specific
- [ ] Action clearly shows what's happening
- [ ] Location/context is detailed and atmospheric
- [ ] Composition uses professional photography terminology
- [ ] Lighting description creates mood and visual hierarchy
- [ ] Style/media is consistent (not contradictory)
- [ ] Any text specifications are exact and clear
- [ ] Constraints are formatted with ALL CAPS for emphasis
- [ ] Prompt is structured (Markdown or XML tags for complex prompts)
- [ ] Prompt under 32,768 tokens (Nano Banana's context limit)

### After Generation Checklist

- [ ] Image matches all specified constraints
- [ ] Aspect ratio and resolution are correct
- [ ] Text (if any) is legible and error-free
- [ ] Lighting and composition match description
- [ ] Character consistency maintained (if using references)
- [ ] No obvious AI artifacts or distortions
- [ ] Thought signatures preserved for future edits

---

## Additional Resources

### Official Documentation
- **Gemini 3 Developer Guide:** google.ai.dev/gemini-api/docs/gemini-3
- **Image Generation Guide:** ai.google.dev/gemini-api/docs/image-generation
- **Prompt Design Strategies:** ai.google.dev/gemini-api/docs/prompting-strategies
- **Vertex AI Prompt Guide:** docs.cloud.google.com/vertex-ai/generative-ai/docs/image/img-gen-prompt-guide

### Community Guides
- **MiniMaxir's Advanced Nano Banana Prompting:** minimaxir.com/2025/11/nano-banana-prompts/
- **Atlabs AI Prompting Guide:** atlabs.ai/blog/the-ultimate-nano-banana-pro-prompting-guide
- **Prompt Engineering Guide:** promptingguide.ai/models/gemini

### Key Takeaway

**Treat Gemini 3 Pro Image like a skilled artist:** Give it a complete scene description with lighting, mood, composition, and purpose for professional results. The model's advanced text encoder and reasoning capabilities mean that **clear, descriptive, well-structured prompts outperform keyword spam by orders of magnitude.**

