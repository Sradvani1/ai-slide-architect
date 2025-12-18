---
name: Optimize Educational Diagram Prompt Generation
overview: "Implement 6 key optimizations to strengthen educational diagram prompt generation: add \"no artistic interpretation\" constraint, strengthen color constraints, add specific visual rules to style references, add composition strictness, add conditional scientific accuracy section, and simplify lighting narratives."
todos: []
---

# Educational Diagram Prompt Generation Optimization Plan

## Overview

This plan implements 6 critical optimizations identified in the review to strengthen prompt generation for educational diagrams. The changes focus on preventing artistic interpretation, enforcing strict color constraints, adding detailed style rules, and improving clarity across all prompt sections.

## Files to Modify

### Primary File: `shared/utils/imageUtils.ts`

All formatting logic changes will be made in this file.

---

## Phase 1: Critical Improvements (Must Implement)

### Change 1: Add "No Artistic Interpretation" Constraint

**Location:** `shared/utils/imageUtils.ts` - `formatImageSpec()` function, after CRITICAL CONSTRAINT section

**Action:** Add new "INSTRUCTION STYLE" section immediately after CRITICAL CONSTRAINT

**Code Change:**

```typescript
// Current section (lines 284-294):
CRITICAL CONSTRAINT:
This image is a pedagogical visual aid for textbooks or classroom use.
It should look like educational material, NOT artwork or cinema.
Clarity and accuracy matter more than beauty or emotional impact.`,

// ADD NEW SECTION:
INSTRUCTION STYLE:
Generate this as a FACTUAL DIAGRAM, not an artistic interpretation.
- NO creative reinterpretation of the concept
- NO stylistic flourishes or embellishment
- NO artistic license or interpretation
- Strict adherence to educational conventions
Treat this like documenting facts, not creating art.`,
```

**Also update:** `buildCinematographySuppressors()` function (around line 192)

Add to the emotional/artistic effects section:

```typescript
// Add these terms:
'stylized', 'interpretation', 'creative interpretation',
'artistic rendering'
```

---

### Change 2: Strengthen Color Constraints

**Location:** `shared/utils/imageUtils.ts` - `formatImageSpec()` function, Colors section (lines 319-325)

**Action:** Replace the current color formatting with a dedicated helper function that enforces strict constraints

**New Helper Function:** Add before `formatImageSpec()`:

```typescript
function formatColorPaletteSection(spec: ImageSpec): string {
    if (!spec.colors || spec.colors.length === 0) {
        return `COLORS (Restricted Palette):
Use primary educational colors only: Primary Blue, Education Green, Alert Orange, Neutral Gray, Pure White.
Constraint: Solid flat colors ONLY. NO gradients. NO color transitions. NO blending.
Each color is used as a distinct, unmixed block.`;
    }

    return `COLORS (Restricted Palette - STRICT):
Use ONLY these colors, EXACTLY as specified:
${spec.colors.map(c => `• ${c}`).join('\n')}

CRITICAL CONSTRAINT:
- Solid flat colors only. NO gradients between these colors.
- NO blending or color transitions.
- NO subtle tints or shades within each color.
- Each color appears as a distinct, uniform block.
- High contrast for classroom projection and accessibility.
- Semantic use: Each color has a specific teaching purpose.`;
}
```

**Update formatImageSpec():** Replace lines 319-325:

```typescript
// OLD:
spec.colors && spec.colors.length > 0
    ? `\n---\n
COLORS (Restricted Palette):
Use ONLY these colors, no gradients, no blending:
${spec.colors.map(c => `• ${c}`).join('\n')}
High contrast for classroom projection. Each color has semantic purpose.`
    : '',

// NEW:
`\n---\n
${formatColorPaletteSection(spec)}`,
```

---

### Change 3: Add Specific Visual Rules to Style References

**Location:** `shared/utils/imageUtils.ts` - `formatIllustrationStyleSection()` function (lines 71-105)

**Action:** Enhance each style guide entry with specific "Visual rules" and "Do NOT" sections

**Code Change:** Replace the `styleGuides` object (lines 78-102) with:

```typescript
const styleGuides: Record<string, string> = {
    'flat-vector': `STYLE: Flat Vector Illustration
Reference style: Google Material Design, Apple iOS icons, Material.io designs
Visual rules:
- Solid flat colors, NO shading or gradients
- Geometric, angular shapes (no soft, organic curves unless essential)
- Consistent line weight or no lines at all
- Simple silhouettes when possible
- Minimize details; maximum clarity
Do NOT: Add shadows, gradients, textures, or dimensional effects.`,

    'clean-line-diagram': `STYLE: Technical Line Diagram
Reference style: Biology textbook diagrams, medical illustrations, engineering drawings
Visual rules:
- Crisp black or very dark gray lines on pure white background
- Minimal fill; mostly line-based
- Lines have consistent weight or vary strategically
- Labels adjacent to lines pointing to structures
- Anatomically or technically accurate proportions
Do NOT: Add soft shading, gradients, or photorealistic details.`,

    'infographic': `STYLE: Educational Infographic
Reference style: WHO health posters, CDC infographics, educational data visualizations
Visual rules:
- Clear visual hierarchy (size, color, position indicate importance)
- Limited color palette (3-5 colors maximum)
- Icons/simplified shapes combined with text
- Flow direction clear (top-to-bottom, left-to-right)
- Flat design throughout
Do NOT: Add shadows, 3D effects, or decorative background.`,

    'technical-diagram': `STYLE: Scientific Technical Diagram
Reference style: Anatomy charts, physics diagrams, chemistry molecule illustrations
Visual rules:
- Accuracy over aesthetics
- Simplified structures showing key features only
- Minimal but clear labeling
- Monochromatic or 3-4 colors maximum
- Functional design; every element teaches
Do NOT: Add artistic embellishment, atmospheric effects, or stylistic flourishes.`
};
```

---

## Phase 2: Important Improvements (Should Implement)

### Change 4: Add Composition Strictness

**Location:** `shared/utils/imageUtils.ts` - `formatCompositionSection()` function (lines 126-153)

**Action:** Add explicit constraints about perspective and distortion after the sharp focus statement

**Code Change:** Update lines 140-144:

```typescript
// OLD:
// Enforce sharp focus
description += ', with everything in sharp focus';

let section = `COMPOSITION & FRAMING:
${description}.`;

// NEW:
// Enforce sharp focus
description += `, everything in sharp focus`;
description += `. Composition is SIMPLE and DIRECT.`;
description += ` No exaggeration of perspective.`;
description += ` No distortion for emphasis.`;
description += ` No unusual angles or artistic framing.`;

let section = `COMPOSITION & FRAMING:
${description}`;

// Also update framingRationale formatting (line 148):
if (c.framingRationale) {
    section += `\n\nWhy this viewpoint works: ${c.framingRationale}`;
}
```

---

### Change 5: Add Conditional Scientific Accuracy Section

**Location:** `shared/utils/imageUtils.ts` - Add new helper function and integrate into `formatImageSpec()`

**Action:** Create new helper function and add to sections array conditionally

**New Helper Function:** Add before `formatImageSpec()`:

```typescript
function formatAccuracyConstraintSection(spec: ImageSpec, ctx: FormatContext): string {
    const subject = ctx.subject.toLowerCase();
    
    // Only add if subject is science/technical
    const scienceSubjects = ['science', 'biology', 'chemistry', 'physics', 'anatomy', 
                           'geography', 'earth science', 'geology', 'astronomy', 
                           'engineering', 'technology'];
    
    const isScienceSubject = scienceSubjects.some(s => subject.includes(s));
    
    if (isScienceSubject) {
        return `\n---\n
SCIENTIFIC ACCURACY:
This image must be scientifically accurate for ${ctx.subject}.
- NO anatomical errors
- NO geographic inaccuracies
- NO physical/chemical impossibilities
- NO outdated or debunked information
If uncertain, err toward simplified accuracy rather than decorative inaccuracy.`;
    }
    
    return '';
}
```

**Update formatImageSpec():** Add to sections array after Background section (after line 307):

```typescript
// 4. Background
`\n---\n
${formatBackgroundSection(spec)}`,

// 4.5. Scientific Accuracy (conditional)
formatAccuracyConstraintSection(spec, ctx),

// 5. Composition
`\n---\n
${formatCompositionSection(spec)}`,
```

---

### Change 6: Simplify Lighting Narrative

**Location:** `shared/utils/imageUtils.ts` - `buildLightingNarrative()` function (lines 31-44)

**Action:** Simplify to single sentence per approach with explicit NO list format

**Code Change:** Replace entire function:

```typescript
function buildLightingNarrative(spec: ImageSpec, gradeLevel: string): string {
    if (!spec.lighting || !spec.lighting.approach) {
        return `Lighting: Neutral, uniform, technical. Equal illumination of all elements. NO shadows, gradients, depth effects, or mood-based color.`;
    }

    const approaches: Record<string, string> = {
        'technical-neutral': `Lighting: Neutral and uniform. All elements equally illuminated. NO shadows, gradients, or atmospheric effects.`,
        'even-flat': `Lighting: Completely uniform and flat. NO shadows or directional cues.`,
        'diagram-clarity': `Lighting: Neutral technical light with minimal directional detail. Show form only, no drama. NO shadows or mood-based color.`
    };

    return approaches[spec.lighting.approach] || approaches['technical-neutral'];
}
```

---

## Summary of Changes

### Modified Functions in `shared/utils/imageUtils.ts`:

1. `formatImageSpec()` - Add INSTRUCTION STYLE section, update color formatting, add scientific accuracy section
2. `buildLightingNarrative()` - Simplify to single sentence format with explicit NO lists
3. `formatIllustrationStyleSection()` - Add detailed visual rules and "Do NOT" constraints
4. `formatCompositionSection()` - Add strictness constraints about perspective and distortion
5. `buildCinematographySuppressors()` - Add artistic interpretation suppressors
6. `formatColorPaletteSection()` - NEW helper function with strict constraints
7. `formatAccuracyConstraintSection()` - NEW helper function for scientific subjects

### Expected Impact:

- **Stronger constraints** prevent artistic interpretation
- **Clearer color rules** prevent gradient/subtle color transitions
- **Specific style rules** guide precise style replication
- **Composition strictness** prevents perspective distortion
- **Scientific accuracy** improves technical content quality
- **Simplified lighting** improves clarity and parsing

### Testing:

After implementation, verify:

1. Prompt contains "INSTRUCTION STYLE" section with "FACTUAL DIAGRAM" language
2. Color section includes explicit "NO gradients/blending/transitions" constraints
3. Style sections include "Visual rules" and "Do NOT" lists
4. Composition includes "No exaggeration of perspective" constraints
5. Science subjects include "SCIENTIFIC ACCURACY" section
6. Lighting narratives are single sentences with NO lists
7. Negative prompt includes artistic interpretation suppressors