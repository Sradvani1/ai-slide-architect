# SlidesEdu Image Generation Refactoring Guide
## Tuning for Clean Educational Diagrams & Illustrations

**Date:** December 18, 2025  
**Objective:** Transform image generation from "dramatic visual storytelling" to "clean textbook-style educational diagrams"  
**Scope:** Update ImageSpec types, prompt builders, and formatter functions

---

## Overview: The Core Problem

Your current image generation produces **cinematic, dramatic visuals** because:
- Lighting section emphasizes "mood" and "atmosphere" 
- Negative prompts lack cinematography suppressors
- Style guidance is vague ("educational illustration")
- No explicit "flat design" or "vector style" constraints
- Background not explicitly constrained to white

**Solution:** Add 6 critical variable shifts:
1. Remove atmospheric lighting language
2. Add comprehensive cinematography suppressors
3. Enforce flat vector/clean line style
4. Explicitly constrain background to pure white
5. Remove depth-of-field effects (bokeh)
6. Add educational mode configuration

---

## Phase 1: Update ImageSpec Type Definition

### Location
`shared/types.ts` (or wherever ImageSpec is defined)

### Changes

Replace the `lighting` object definition with educational-safe values:

```typescript
// OLD - Removed
lighting?: {
  quality?: 'soft' | 'dramatic' | 'neutral-flat';
  direction?: 'overhead' | 'side-lit' | 'backlit' | 'three-point-professional';
  colorTemperature?: 'warm' | 'cool' | 'neutral';
  mood?: 'calm' | 'energetic' | 'scientific' | 'dramatic' | 'peaceful';
};

// NEW - Educational mode only
lighting?: {
  approach?: 'technical-neutral' | 'even-flat' | 'diagram-clarity';
  // Remove: colorTemperature, mood, dramatic descriptors
};
```

Add new fields to ImageSpec:

```typescript
interface ImageSpec {
  // ... existing fields ...
  
  // NEW: Illustration style control
  illustrationStyle?: 'flat-vector' | 'clean-line-diagram' | 'infographic' | 'technical-diagram';
  
  // NEW: Background control
  background?: {
    style: 'pure-white' | 'light-gray';
    texture: 'flat' | 'subtle-texture';
  };
  
  // NEW: Educational mode flag
  isEducationalDiagram?: boolean;
  
  // EXISTING: Update depthOfField to remove dramatic effects
  composition: {
    layout: 'single-focal-subject-centered' | 'balanced-pair' | 'comparison-split-screen' | 'diagram-with-flow' | 'simple-sequence-2-panel';
    viewpoint: 'front-on' | 'side-profile' | 'overhead' | 'bird-eye-view' | 'isometric-3d' | 'cross-section-side' | 'flow-diagram';
    // REMOVED: 'macro-close-up' | 'Dutch-angle' (too cinematic)
    whitespace: 'generous' | 'moderate';
    depthOfField?: 'sharp-throughout'; // CHANGED: removed 'shallow' option
    framingRationale?: string;
  };
}
```

### Type Definitions to Add

```typescript
type IllustrationStyle = 'flat-vector' | 'clean-line-diagram' | 'infographic' | 'technical-diagram';

type LightingApproach = 'technical-neutral' | 'even-flat' | 'diagram-clarity';

type EducationalViewpoint = 
  | 'front-on'           // Direct, clear
  | 'side-profile'       // Shows structure
  | 'overhead'           // Shows layout/relationships
  | 'bird-eye-view'      // Map-like, instructional
  | 'isometric-3d'       // Shows 3D structure clearly
  | 'cross-section-side' // Anatomical clarity
  | 'flow-diagram';      // Process visualization
```

---

## Phase 2: Refactor `buildImageSpecInstructionsSection()`

### Location
`shared/promptBuilders.ts` - `buildImageSpecInstructionsSection()` function

### Changes

**STEP 1:** Replace the LIGHTING section entirely

```typescript
// OLD LIGHTING SECTION (DELETE)
LIGHTING & ATMOSPHERE (The "Mood")
- \`lighting.quality\`: "soft", "dramatic", "neutral-flat"
- \`lighting.direction\`: "overhead", "side-lit", "backlit"
- \`lighting.colorTemperature\`: "warm", "cool", "neutral"
- \`lighting.mood\`: "calm", "energetic", "scientific", "dramatic", "peaceful"

// NEW LIGHTING SECTION (REPLACE WITH)
LIGHTING FOR EDUCATIONAL DIAGRAMS (CRITICAL):
For textbook-style illustrations, use TECHNICAL NEUTRAL LIGHTING:
- NO atmospheric or cinematic lighting effects
- NO mood-based color temperature ("warm", "cool" for emotion)
- Use neutral, even, technical lighting suitable for diagrams
- All elements should be equally visible
- Avoid: shadows, gradients, volumetric lighting, rim lighting
- Goal: Clarity and information hierarchy, NOT emotion or atmosphere

\`lighting.approach\`: Choose ONE:
- "technical-neutral": Neutral, flat, clinical lighting (diagrams, anatomy charts)
- "even-flat": Completely uniform lighting (technical illustrations)
- "diagram-clarity": Slight directional light only to show form, no drama

Example: For a cell biology diagram, use "technical-neutral" - NO warm or cool tones.
```

**STEP 2:** Update COMPOSITION section - remove dramatic viewpoints

```typescript
// OLD
\`composition.viewpoint\`: 
  * "front-on"
  * "side-profile"
  * "overhead"
  * "bird's-eye-view"
  * "isometric-3d-cutaway"
  * "macro-close-up"              // REMOVE: Implies shallow DOF/bokeh
  * "Dutch-angle"                 // REMOVE: Implies dramatic framing

// NEW
\`composition.viewpoint\`: Choose from educational options only:
  * "front-on" - Direct view, shows the subject clearly (best for portraits, frontal anatomy)
  * "side-profile" - Shows structure, layers, internal components
  * "overhead" - Top-down view, shows spatial relationships and layout
  * "bird-eye-view" - Map-like perspective for geography, diagrams
  * "isometric-3d" - 3D structure shown clearly, not dramatically (buildings, molecules, organs)
  * "cross-section-side" - Side view showing internal parts (geology, anatomy)
  * "flow-diagram" - Process visualization with clear directional flow

NOTE: These viewpoints are EDUCATIONAL, not cinematographic.
```

**STEP 3:** Update COMPOSITION.depthOfField - remove bokeh/blur

```typescript
// OLD
\`composition.depthOfField\`: "shallow" (blurred background) or "deep" (everything sharp)

// NEW
\`composition.depthOfField\`: 
- ALWAYS "sharp-throughout" for educational diagrams
- This means: Everything in focus, no blurred backgrounds, no bokeh effects
- Ensures students see the full context and all important details
```

**STEP 4:** Add new ILLUSTRATION STYLE section

```typescript
ILLUSTRATION STYLE (CRITICAL FOR EDUCATIONAL MODE):
Choose the style that best matches your teaching goal:

\`illustrationStyle\`: Select ONE:
- "flat-vector": Solid flat colors, geometric precision, NO shading or gradients
  * Use for: Concept diagrams, icons, simple processes
  * Reference style: Google Material Design, Apple system icons, IKEA instruction manuals
  * Colors: Solid blocks only, no blending

- "clean-line-diagram": Technical lines with minimal shading, high contrast
  * Use for: Textbook diagrams, anatomical charts, technical blueprints
  * Reference style: Biology textbook illustrations, engineering drawings
  * Lines: Crisp black or dark gray on white background

- "infographic": Minimal decoration, clear information hierarchy, flat design
  * Use for: Data visualization, process flows, educational infographics
  * Reference style: WHO health infographics, educational posters
  * Colors: Limited palette (3-5 colors), no gradients

- "technical-diagram": Scientific diagram style, pure clarity
  * Use for: Physics, chemistry, detailed technical concepts
  * Reference style: Anatomy charts, molecule diagrams, circuit diagrams
  * Approach: Accuracy over aesthetics
```

**STEP 5:** Add new BACKGROUND section

```typescript
BACKGROUND (MANDATORY):
\`background.style\`: 
- "pure-white": Pure white (#FFFFFF) - absolutely flat, no variation
  * Use for: Most educational diagrams
  * Constraint: NO gradient, NO texture, NO shadow

\`background.texture\`:
- "flat": Completely uniform white background (recommended for all educational content)
- "subtle-texture": Allowed only if specified in design requirements (rarely)

CRITICAL: The background should be INVISIBLE - it should never compete with content.
All attention should focus entirely on the subject matter.

Example constraint in prompt: "Background must be PURE WHITE (#FFFFFF). Absolutely NO gradient, NO shadow, NO fog, NO particles, NO atmospheric effects. Completely flat and uniform."
```

**STEP 6:** Add AVOID section with cinematography suppressors

```typescript
AVOID (COMPREHENSIVE - For Educational Diagrams):

CINEMATOGRAPHIC TECHNIQUES TO SUPPRESS:
- Dramatic lighting, cinematic lighting, theatrical lighting
- Rim lighting, backlighting, volumetric lighting, three-point studio lighting
- Atmospheric effects: fog, mist, particles, light rays, god rays, glowing
- Depth effects: shadows, deep shadows, bokeh, blur, shallow depth of field
- Color effects: gradient backgrounds, blurred backgrounds, color grading
- Photography language: photorealistic, hyper-realistic, 8k, 4k, ultra HD
- Artistic language: masterpiece, trending on artstation, fine art, gallery quality
- Emotional framing: dreamy, magical, surreal, ethereal, mystical, emotional
- Style mixing: painting style, brush strokes, watercolor, oil painting, comic book
- Texture detail: film grain, texture detail, rough edges, hand-drawn appearance

EXAMPLE: Do NOT say "soft dramatic lighting" or "warm atmospheric mood"
These trigger cinematic output even if you want clean diagrams.

Instead say: "Technical neutral lighting. All elements equally visible. No shadows or gradients."
```

**STEP 7:** Add COLOR PALETTE section with educational constraints

```typescript
COLORS (EDUCATIONAL PALETTE):
Use MUTED or PRIMARY educational colors only. NO vibrant, saturated, or neon colors.

Restricted palettes:
- Educational Primary: Primary Blue (#0052CC), Education Green (#22C55E), Alert Orange (#F97316), Neutral Gray (#6B7280), Pure White (#FFFFFF)
- Science Textbook: Dark Blue (#003D7A), Forest Green (#2D5016), Deep Orange (#D84315), Charcoal (#333333), Pure White (#FFFFFF)
- Pastel Friendly: Soft Blue (#A8D5E2), Soft Green (#B8E6D5), Soft Peach (#FFDAB9), Soft Lavender (#E6B8E6), Pure White (#FFFFFF)

CONSTRAINTS:
- Maximum 5 colors total
- NO gradients between colors
- NO blending or color transitions
- Each color serves a semantic purpose (e.g., blue=water, green=living)
- NO vibrant, saturated, neon, or fluorescent colors
- NO "warm" or "cool" tones for emotional effect
```

---

## Phase 3: Update `formatImageSpec()` Function

### Location
`shared/utils/imageUtils.ts` - `formatImageSpec()` function

### Key Changes

**STEP 1:** Replace the lighting narrative builder

```typescript
// OLD: buildLightingNarrative() - DELETE THIS FUNCTION

// NEW: Create technical-only lighting formatter
function buildLightingNarrative(spec: ImageSpec, gradeLevel: string): string {
    if (!spec.lighting || !spec.lighting.approach) {
        // Default to technical neutral for educational diagrams
        return `Illuminated by neutral, even, technical lighting suitable for educational diagrams. All elements equally visible.`;
    }

    const approaches: Record<string, string> = {
        'technical-neutral': `Illuminated by neutral, even, technical lighting. No shadows, gradients, or atmospheric effects. Suitable for clear, unambiguous representation of educational concepts.`,
        'even-flat': `Illuminated by completely uniform, flat lighting. All elements receive equal light. No depth cues from lighting.`,
        'diagram-clarity': `Illuminated by neutral technical lighting with minimal directional cues to show form only. No dramatic shadows or mood-based color.`
    };

    return approaches[spec.lighting.approach] || approaches['technical-neutral'];
}
```

**STEP 2:** Replace narrative scene builder to remove cinematography language

```typescript
// Update buildFullNarrativeScene() to strip emotional language
function buildFullNarrativeScene(spec: ImageSpec, ctx: FormatContext): string {
    const subjectPart = buildSubjectNarrative(spec);
    const actionPart = buildActionNarrative(spec);
    const locationPart = buildLocationNarrative(spec);
    
    // REMOVE: lightingPart (no mood/emotion in narrative)
    
    // Build FACTUAL, NON-CINEMATIC narrative
    let narrative = subjectPart;

    if (actionPart) {
        narrative += ` ${actionPart}`;
    }

    if (locationPart) {
        narrative += ` in ${locationPart}`;
    }

    if (!narrative.endsWith('.')) {
        narrative += '.';
    }

    // REMOVE: Lighting narrative with mood/atmosphere
    // REMOVE: Emotional or artistic descriptors
    
    return narrative;
}

// EXAMPLE OUTPUT:
// OLD: "A vibrant green plant leaf in bright sunlight, with water droplets glistening, bathed in warm light creating an energetic atmosphere."
// NEW: "A plant leaf with water droplets showing the photosynthesis process, with chloroplasts and vascular tissue visible, in a cross-section diagram."
```

**STEP 3:** Update illustration style formatter

```typescript
function formatIllustrationStyleSection(spec: ImageSpec): string {
    if (!spec.illustrationStyle) {
        return `STYLE:
Flat vector educational illustration. Solid flat colors. No shading, gradients, or 3D effects.
Similar to: Google Material Design, Apple system icons, educational infographics.`;
    }

    const styleGuides: Record<string, string> = {
        'flat-vector': `STYLE:
Flat vector illustration. Solid flat colors only. Geometric precision.
No shading, gradients, shadows, or 3D depth effects.
Reference: Google Material Design, Apple icons, IKEA instruction manuals.
Line quality: Clean, consistent line weight throughout.`,

        'clean-line-diagram': `STYLE:
Technical line diagram with crisp black or dark gray lines on white background.
Minimal shading (only if necessary for clarity).
Reference: Biology textbook diagrams, engineering blueprints, anatomy charts.
Line weight: Varies slightly to show hierarchy and importance.`,

        'infographic': `STYLE:
Flat design infographic. Limited color palette (3-5 colors maximum).
No gradients, no atmospheric effects, no decorative elements.
Every visual element serves a teaching purpose.
Reference: WHO health infographics, educational posters, data visualizations.`,

        'technical-diagram': `STYLE:
Technical scientific diagram. Pure clarity and accuracy over aesthetics.
Functional, minimalist approach. Only essential elements visible.
Reference: Anatomy charts, molecule diagrams, circuit diagrams, physics illustrations.
Color use: Semantic only (red=error, green=correct, blue=information).`
    };

    return styleGuides[spec.illustrationStyle] || styleGuides['flat-vector'];
}
```

**STEP 4:** Add background enforcement formatter

```typescript
function formatBackgroundSection(spec: ImageSpec): string {
    const bg = spec.background || { style: 'pure-white', texture: 'flat' };

    const backgroundRules = `BACKGROUND:
Pure white background (#FFFFFF). Absolutely flat and uniform.
- NO gradient (vertical, horizontal, or diagonal)
- NO texture or pattern
- NO shadow cast on background
- NO fog, mist, or atmospheric haze
- NO particles, dust, or floating elements
- NO color shift or tint
- Completely invisible - does not compete with subject matter

This is CRITICAL. The background should disappear. All focus is on educational content.`;

    return backgroundRules;
}
```

**STEP 5:** Create cinematography suppressor list

```typescript
function buildCinematographySuppressors(): string[] {
    return [
        // Lighting effects
        'cinematic', 'dramatic lighting', 'moody', 'atmospheric', 'volumetric lighting',
        'rim lighting', 'backlighting', 'chiaroscuro', 'film noir', 'low-key lighting',
        'three-point lighting', 'studio lighting effect', 'professional lighting',
        
        // Emotional/artistic effects
        'dreamy', 'surreal', 'magical', 'ethereal', 'mystical', 'fantasy',
        'emotional', 'poetic', 'artistic expression', 'fine art', 'gallery quality',
        'masterpiece', 'trending on artstation', 'ArtStation', 'award winning',
        
        // Depth & dimension effects
        'shadows', 'deep shadows', 'shadow detail', 'volumetric', 'depth of field',
        'bokeh', 'blur', 'blurred background', 'misty', 'foggy', 'hazy',
        'particles floating', 'light rays', 'god rays', 'lens flare', 'glow',
        
        // Photography/realism effects
        'photorealistic', 'hyperrealistic', 'photorealistic rendering', '8k', '4k',
        'ultra HD', 'high resolution', 'ultra detailed', 'ultra high detail',
        'texture detail', 'grain', 'film grain', 'shallow depth of field',
        '85mm lens', '50mm lens', 'cinematic composition',
        
        // Color & saturation issues
        'vibrant colors', 'vibrant', 'saturated', 'intense colors', 'neon',
        'glowing', 'bright colors', 'warm atmospheric', 'cool atmospheric',
        'color grading', 'color correction', 'warm tones', 'cool tones',
        
        // Style issues
        'painting style', 'brush strokes', 'watercolor', 'oil painting', 'digital art',
        'illustration with shading', 'comic book style', 'anime', 'cartoon',
        'doodle', 'sketch', 'hand-drawn', 'rough edges', 'artistic style',
        
        // Text/typography (if NO_LABELS)
        'text', 'labels', 'captions', 'watermark', 'signature', 'letters', 'words'
    ];
}
```

**STEP 6:** Update negative prompt builder

```typescript
function buildNegativePromptList(
    spec: ImageSpec,
    customNegativePrompt: string[] = [],
    avoid: string[] = []
): string[] {
    let finalList: string[] = [];

    // ALWAYS add cinematography suppressors for educational diagrams
    if (spec.isEducationalDiagram) {
        const cinematicSuppressors = buildCinematographySuppressors();
        finalList.push(...cinematicSuppressors);
    }

    // Add text suppression if NO_LABELS
    if (spec.textPolicy === 'NO_LABELS') {
        const textSuppressionTerms = [
            'text', 'labels', 'words', 'lettering', 'typography',
            'annotations', 'watermark', 'signature', 'caption', 'numbers', 
            'legends', 'letters', 'writing', 'text overlay'
        ];
        finalList.push(...textSuppressionTerms);
    }

    // Add custom negative prompts
    finalList.push(...customNegativePrompt);

    // Add avoid list
    finalList.push(...avoid);

    // Always add educational safety terms
    const educationalSafetyTerms = [
        'blurry', 'low-resolution', 'pixelated', 'distorted', 'overexposed',
        'completely dark', 'confusing', 'cluttered', 'incomprehensible'
    ];
    finalList.push(...educationalSafetyTerms);

    // Deduplicate
    return [...new Set(finalList)];
}
```

**STEP 7:** Rebuild main formatImageSpec() function

```typescript
export function formatImageSpec(spec: ImageSpec, ctx: FormatContext): string {
    // Set educational mode if not explicitly set
    const isEducational = spec.isEducationalDiagram !== false;

    // Build negative prompt with cinematography suppressors
    const negativePrompt = buildNegativePromptList(
        spec,
        spec.negativePrompt || [],
        spec.avoid || []
    );

    // Build all sections in logical order
    const sections = [
        // 1. Context
        `EDUCATIONAL VISUAL AID PROMPT
========================================
CONTEXT:
- Grade Level: ${ctx.gradeLevel}
- Subject: ${ctx.subject}
- Teaching Purpose: ${spec.conceptualPurpose}

CRITICAL CONSTRAINT:
This image is a pedagogical visual aid for textbooks or classroom use.
It should look like educational material, NOT artwork or cinema.
Clarity and accuracy matter more than beauty or emotional impact.`,

        // 2. Visual scene (factual, no emotion)
        `\n---\n
VISUAL SCENE DESCRIPTION:
${buildFullNarrativeScene(spec, ctx)}`,

        // 3. Illustration style
        `\n---\n
${formatIllustrationStyleSection(spec)}`,

        // 4. Background
        `\n---\n
${formatBackgroundSection(spec)}`,

        // 5. Composition
        `\n---\n
${formatCompositionSection(spec)}`,

        // 6. Lighting (technical only)
        `\n---\n
LIGHTING:
${buildLightingNarrative(spec, ctx.gradeLevel)}`,

        // 7. Colors
        spec.colors && spec.colors.length > 0
            ? `\n---\n
COLORS (Restricted Palette):
Use ONLY these colors, no gradients, no blending:
${spec.colors.map(c => `• ${c}`).join('\n')}
High contrast for classroom projection. Each color has semantic purpose.`
            : '',

        // 8. Text policy
        `\n---\n
${formatTextPolicySection(spec)}`,

        // 9. Must include
        spec.mustInclude && spec.mustInclude.length > 0
            ? `\n---\n
MUST INCLUDE:
${spec.mustInclude.map((item, i) => `${i + 1}. ${item}`).join('\n')}`
            : '',

        // 10. Must avoid
        spec.avoid && spec.avoid.length > 0
            ? `\n---\n
MUST AVOID:
${spec.avoid.map((item, i) => `${i + 1}. ${item}`).join('\n')}`
            : '',

        // 11. Negative prompt
        `\n---\n
NEGATIVE PROMPT (Prevent Failures):
${negativePrompt.join(', ')}`,

        // 12. Final constraints
        `\n---\n
FINAL REQUIREMENTS:
- This should look like it came from a textbook, not a gallery
- Accuracy and clarity over aesthetics
- Suitable as a standalone visual aid
- Teachers should understand it immediately
- Clean, professional, educational in appearance`
    ];

    return sections
        .filter(s => s && s.trim().length > 0)
        .join('\n');
}
```

---

## Phase 4: Update Helper Functions

### Location
Various helper functions in `shared/utils/imageUtils.ts`

### Update: formatCompositionSection()

```typescript
function formatCompositionSection(spec: ImageSpec): string {
    const c = spec.composition;
    
    // Build description without cinematic language
    let description = `${c.viewpoint.replace(/-/g, ' ')} view`;

    if (c.layout !== 'single-focal-subject-centered') {
        description += `, with ${c.layout.replace(/-/g, ' ')} layout`;
    }

    if (c.whitespace === 'generous') {
        description += ', generous white space for clarity and text';
    }

    // UPDATED: Remove bokeh language
    description += ', with everything in sharp focus';

    let section = `COMPOSITION & FRAMING:
${description}.`;

    // Add pedagogical framing if present
    if (c.framingRationale) {
        section += `\n\nWhy this viewpoint teaches better:
${c.framingRationale}`;
    }

    return section;
}
```

### Update: formatTextPolicySection()

```typescript
function formatTextPolicySection(spec: ImageSpec): string {
    const policy = spec.textPolicy;
    const labels = spec.allowedLabels ? spec.allowedLabels.join(', ') : 'None';
    const placement = spec.labelPlacement || 'clearly visible positions';
    const font = spec.labelFont || 'bold sans-serif';

    let section = `TEXT POLICY:`;

    if (policy === 'NO_LABELS') {
        return `${section}
Absolutely NO text, labels, numbers, watermarks, or annotations anywhere.
The concept must be communicated visually through composition and color.`;
    }

    if (policy === 'LIMITED_LABELS_1_TO_3') {
        return `${section}
Include ONLY these labels: ${labels}
- Font: ${font}
- Placement: ${placement}
- Size: Large and legible for classroom projection
- Background: Use contrasting background for readability if needed`;
    }

    if (policy === 'DIAGRAM_LABELS_WITH_LEGEND') {
        return `${section}
Complex diagram with legend. Labels: ${labels}
- Font: ${font}
- Placement: ${placement}
- Legend: Clear legend showing label meanings
- Format: Suitable for technical/scientific diagrams`;
    }

    return section;
}
```

---

## Phase 5: Update ImageSpec Initialization

### Location
Where you initialize default ImageSpec objects

### Changes

```typescript
// When creating a new ImageSpec for educational mode:
const educationalImageSpec: ImageSpec = {
    conceptualPurpose: 'Teaching goal here',
    primaryFocal: 'Main subject',
    subjects: ['supporting', 'elements'],
    
    // NEW: Set educational mode
    isEducationalDiagram: true,
    illustrationStyle: 'flat-vector', // or 'clean-line-diagram', etc.
    
    // NEW: Set background
    background: {
        style: 'pure-white',
        texture: 'flat'
    },
    
    // UPDATE: Lighting for educational only
    lighting: {
        approach: 'technical-neutral' // No mood, no emotion
    },
    
    // UPDATE: Composition with educational viewpoint
    composition: {
        layout: 'diagram-with-flow',
        viewpoint: 'cross-section-side', // Educational viewpoint
        whitespace: 'generous',
        depthOfField: 'sharp-throughout', // No bokeh
        framingRationale: 'This angle best shows the educational concept'
    },
    
    // UPDATED: No cinematic styling
    textPolicy: 'LIMITED_LABELS_1_TO_3',
    allowedLabels: ['Label 1', 'Label 2', 'Label 3'],
    colors: ['Primary Blue (#0052CC)', 'Education Green (#22C55E)', 'Pure White (#FFFFFF)'],
    
    // Will be auto-populated with cinematography suppressors
    negativePrompt: []
};
```

---

## Phase 6: Testing & Validation Checklist

### Test Cases

| Test Name | Grade | Subject | Input Style | Expected Output |
|-----------|-------|---------|-------------|-----------------|
| **Water Cycle Clean** | 3-5 | Science | flat-vector | Clean lines, solid colors, white bg, no shadows |
| **Cell Structure** | 6-8 | Biology | clean-line-diagram | Technical diagram style, labeled, high contrast |
| **Photosynthesis** | 9-12 | Biology | technical-diagram | Scientific accuracy, diagram clarity, no drama |
| **Timeline** | 8-10 | History | infographic | Process flow, flat design, 4-5 colors |
| **Math Graph** | 6-8 | Math | clean-line-diagram | Grid, axes, no artistic effects |

### Pass Criteria for Each Test

- ✅ **Pure white background** - No gradient, texture, or shadow
- ✅ **No cinematography** - No dramatic lighting, shadows, or effects
- ✅ **Flat colors** - No gradients or color blending
- ✅ **Sharp focus** - Everything in focus, no bokeh or blur
- ✅ **Clean lines** - Crisp edges, consistent line weight
- ✅ **Educational style** - Looks like textbook content
- ✅ **Appropriate colors** - Primary, pastel, or muted (not vibrant)
- ✅ **Clear labels** - If used, legible and positioned well
- ✅ **Suitable standalone** - Understanding doesn't require slide context
- ✅ **Accurate** - Factual and scientifically correct (for science content)

### Manual Review Questions

1. Would an educator understand this without context?
2. Could this appear in a textbook without looking out of place?
3. Does it enhance the learning without adding unnecessary decoration?
4. Are all essential elements clearly visible?
5. Is the color use semantic or functional?
6. Does it avoid emotional or dramatic framing?

---

## Phase 7: Configuration Constants

### Create Educational Mode Configuration Object

**Location:** `shared/config.ts` or similar

```typescript
export const EDUCATIONAL_DIAGRAM_CONFIG = {
  // Illustration styles
  styles: {
    'flat-vector': {
      description: 'Solid flat colors, no shading',
      reference: 'Google Material Design',
      maxColors: 5
    },
    'clean-line-diagram': {
      description: 'Technical lines with minimal shading',
      reference: 'Textbook diagrams',
      maxColors: 3
    },
    'infographic': {
      description: 'Limited palette, flat design',
      reference: 'Educational infographics',
      maxColors: 5
    },
    'technical-diagram': {
      description: 'Pure clarity and accuracy',
      reference: 'Scientific diagrams',
      maxColors: 4
    }
  },

  // Color palettes
  colorPalettes: {
    'educational-primary': [
      'Primary Blue (#0052CC)',
      'Education Green (#22C55E)',
      'Alert Orange (#F97316)',
      'Neutral Gray (#6B7280)',
      'Pure White (#FFFFFF)'
    ],
    'science-textbook': [
      'Dark Blue (#003D7A)',
      'Forest Green (#2D5016)',
      'Deep Orange (#D84315)',
      'Charcoal (#333333)',
      'Pure White (#FFFFFF)'
    ],
    'pastel-friendly': [
      'Soft Blue (#A8D5E2)',
      'Soft Green (#B8E6D5)',
      'Soft Peach (#FFDAB9)',
      'Soft Lavender (#E6B8E6)',
      'Pure White (#FFFFFF)'
    ]
  },

  // Cinematography suppressors
  cinematicSuppressors: [
    'cinematic', 'dramatic', 'moody', 'atmospheric', 'volumetric',
    'rim lighting', 'shadows', 'bokeh', 'gradient', 'trending on artstation',
    'masterpiece', 'photorealistic', '8k', 'ethereal', 'magical',
    'painting style', 'warm atmospheric', 'cool atmospheric'
    // ... (full list from Phase 3)
  ],

  // Educational safety terms
  safetyTerms: [
    'blurry', 'low-resolution', 'pixelated', 'distorted',
    'overexposed', 'completely dark', 'confusing', 'cluttered'
  ]
};
```

---

## Phase 8: Migration Path

### For Existing Slides

**Step 1:** Add educational mode flag to all imageSpec objects
```typescript
// For each existing slide:
imageSpec.isEducationalDiagram = true;
```

**Step 2:** Update illustration styles
```typescript
// Review each slide's style and assign:
if (hasComplexShading) {
  imageSpec.illustrationStyle = 'clean-line-diagram';
} else {
  imageSpec.illustrationStyle = 'flat-vector'; // default
}
```

**Step 3:** Ensure backgrounds are pure white
```typescript
imageSpec.background = {
  style: 'pure-white',
  texture: 'flat'
};
```

**Step 4:** Update lighting to technical-neutral
```typescript
imageSpec.lighting = {
  approach: 'technical-neutral'
};
// Remove: quality, direction, colorTemperature, mood
```

**Step 5:** Test and regenerate
- Run through test cases above
- Regenerate all images
- Validate against checklist

---

## Phase 9: Rollout Strategy

### Week 1: Update Type System & Config
- [ ] Update ImageSpec types
- [ ] Create EDUCATIONAL_DIAGRAM_CONFIG
- [ ] Update type definitions

### Week 2: Update Prompt Builders
- [ ] Refactor buildImageSpecInstructionsSection()
- [ ] Update all helper functions
- [ ] Add cinematography suppressor list

### Week 3: Update Formatters
- [ ] Rebuild formatImageSpec()
- [ ] Update all section formatters
- [ ] Test with sample prompts

### Week 4: Testing & Validation
- [ ] Run all test cases
- [ ] Regenerate sample images
- [ ] Validate against criteria
- [ ] Get stakeholder feedback

### Week 5: Migration & Deployment
- [ ] Update existing slides
- [ ] Regenerate all images
- [ ] Deploy to production
- [ ] Monitor output quality

---

## Quick Reference: Before & After

### Before (Cinematic)
```typescript
{
  lighting: {
    quality: 'soft',
    direction: 'overhead',
    colorTemperature: 'warm',
    mood: 'energetic'
  }
}
// Output: "Soft overhead lighting, warm color temperature, creating an energetic atmosphere"
// Result: Dramatic, artistic, moody images
```

### After (Educational)
```typescript
{
  isEducationalDiagram: true,
  illustrationStyle: 'flat-vector',
  background: { style: 'pure-white', texture: 'flat' },
  lighting: { approach: 'technical-neutral' }
}
// Output: "Technical neutral lighting. All elements equally visible. No shadows or gradients."
// Result: Clean, textbook-style educational diagrams
```

---

## Common Mistakes to Avoid

1. ❌ **Don't mix styles** - Pick ONE illustrationStyle per image
2. ❌ **Don't use emotional lighting terms** - "warm" and "cool" trigger cinematography
3. ❌ **Don't add gradients** - Educational = flat colors only
4. ❌ **Don't blur the background** - Set depthOfField to 'sharp-throughout'
5. ❌ **Don't include cinematic viewpoints** - Stick to educational viewpoints list
6. ❌ **Don't use vibrant colors** - Use primary or pastel palettes only
7. ❌ **Don't remove negative prompt suppressors** - They're essential
8. ❌ **Don't skip the background specification** - Pure white is mandatory
9. ❌ **Don't use more than 5 colors** - Keep palette restricted
10. ❌ **Don't add shadows or shading** - Flat design for clarity

---

## Success Metrics

After refactoring, your images should:

| Metric | Before | After |
|--------|--------|-------|
| **Looks like textbook** | 20% | 90%+ |
| **Pure white background** | 10% | 95%+ |
| **Flat vector/diagram style** | 15% | 85%+ |
| **No dramatic lighting** | 25% | 80%+ |
| **Educators understand standalone** | 30% | 85%+ |
| **Consistent across deck** | 40% | 80%+ |
| **Suitable for print** | 35% | 90%+ |

---

## Support & Debugging

### If Images Still Look Cinematic

**Check:**
1. Is `isEducationalDiagram` set to `true`?
2. Is `illustrationStyle` specified?
3. Are negative prompt suppressors included?
4. Is background set to `pure-white`?
5. Is lighting set to `technical-neutral`?

**Debug:**
- Print the final prompt before sending to Gemini
- Verify cinematography suppressors are in negative prompt
- Check that emotional language is removed from description

### If Background Has Gradient/Texture

**Verify:**
```typescript
background: {
  style: 'pure-white', // NOT 'light-gray'
  texture: 'flat'      // NOT 'subtle-texture'
}
```

### If Colors Are Too Vibrant

**Use restricted palette:**
```typescript
colors: ['Primary Blue (#0052CC)', 'Education Green (#22C55E)', 'Pure White (#FFFFFF)']
// NOT: ['bright blue', 'vibrant green', 'neon yellow']
```

---

**End of Refactoring Guide**

For questions or clarifications, refer to the research document on textbook-style educational illustration standards.
