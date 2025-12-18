import type { ImageSpec } from '../types';

interface FormatContext {
    gradeLevel: string;
    subject: string;
}

// --- Narrative Building Helpers ---

function buildSubjectNarrative(spec: ImageSpec): string {
    if (spec.subjects && spec.subjects.length > 0) {
        return `A ${spec.primaryFocal} with ${spec.subjects.join(', ')}`;
    }
    return `A ${spec.primaryFocal}`;
}

function buildActionNarrative(spec: ImageSpec): string {
    if (!spec.visualizationDynamics || spec.visualizationDynamics.length === 0) return '';
    return spec.visualizationDynamics.join(' and ');
}

function buildLocationNarrative(spec: ImageSpec): string {
    const parts = [];
    if (spec.environment) parts.push(spec.environment);
    if (spec.contextualDetails && spec.contextualDetails.length > 0) {
        parts.push(`featuring ${spec.contextualDetails.join(', ')}`);
    }
    return parts.length > 0 ? parts.join(', ') : '';
}

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

function buildFullNarrativeScene(spec: ImageSpec, ctx: FormatContext): string {
    const subjectPart = buildSubjectNarrative(spec);
    const actionPart = buildActionNarrative(spec);
    const locationPart = buildLocationNarrative(spec);

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

    return narrative;
}

// --- Technical Section Formatters ---

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

function formatIllustrationStyleSection(spec: ImageSpec): string {
    if (!spec.illustrationStyle) {
        return `STYLE:
Flat vector educational illustration. Solid flat colors. No shading, gradients, or 3D effects.
Similar to: Google Material Design, Apple system icons, educational infographics.`;
    }

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

    return styleGuides[spec.illustrationStyle] || styleGuides['flat-vector'];
}

function formatBackgroundSection(spec: ImageSpec): string {
    // Default to pure white/flat if not specified
    const bg = spec.background || { style: 'pure-white', texture: 'flat' };

    const styleName = bg.style === 'pure-white' ? 'Pure White' : 'Light Gray';
    const hexCode = bg.style === 'pure-white' ? '#FFFFFF' : '#F5F5F5';
    const textureNote = bg.texture === 'subtle-texture'
        ? '- Minimal, very subtle texture for depth. NO heavy patterns.'
        : '- Absolutely flat and uniform. NO texture or pattern.';

    return `BACKGROUND:
${styleName} background (${hexCode}).
${textureNote}
- NO gradient (vertical, horizontal, or diagonal)
- NO shadow cast on background
- NO fog, mist, or atmospheric haze
- NO particles, dust, or floating elements
- NO color shift or tint
- Completely clean and professional - does not compete with subject matter

This is CRITICAL. The background should be simple and educational.`;
}

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

    // Enforce sharp focus and strict composition
    description += `, everything in sharp focus`;
    description += `. Composition is SIMPLE and DIRECT.`;
    description += ` No exaggeration of perspective.`;
    description += ` No distortion for emphasis.`;
    description += ` No unusual angles or artistic framing.`;

    let section = `COMPOSITION & FRAMING:
${description}`;

    // Add pedagogical framing if present
    if (c.framingRationale) {
        section += `\n\nWhy this viewpoint teaches better:
${c.framingRationale}`;
    }

    return section;
}

function formatTextPolicySection(spec: ImageSpec): string {
    const policy = spec.textPolicy;
    const labels = spec.allowedLabels ? spec.allowedLabels.join(', ') : 'None';
    const placement = spec.labelPlacement || 'clearly visible positions';
    const font = spec.labelFont || 'bold sans-serif';

    let section = `TEXT POLICY:`;

    if (policy === 'NO_LABELS') {
        return `${section}
Strictly NO TEXT: No letters, numbers, labels, legends, or watermarks anywhere.
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

// --- Negative Prompt Helpers ---

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

        // Artistic Interpretation (NEW)
        'stylized', 'interpretation', 'creative interpretation',
        'artistic rendering',

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

        // Text/typography (if NO_LABELS checked separately)
        'watermark', 'signature'
    ];
}

function buildNegativePromptList(
    spec: ImageSpec,
    customNegativePrompt: string[] = [],
    avoid: string[] = []
): string[] {
    let finalList: string[] = [];

    // ALWAYS add cinematography suppressors for educational diagrams
    // (We default `isEducationalDiagram` to true if undefined, so basically always)
    if (spec.isEducationalDiagram !== false) {
        const cinematicSuppressors = buildCinematographySuppressors();
        finalList.push(...cinematicSuppressors);
    }

    // Add text suppression if NO_LABELS
    if (spec.textPolicy === 'NO_LABELS') {
        const textSuppressionTerms = [
            'text', 'labels', 'words', 'lettering', 'typography',
            'annotations', 'caption', 'numbers',
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

// --- Main Formatter ---

export function formatImageSpec(spec: ImageSpec, ctx: FormatContext): string {
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
Clarity and accuracy matter more than beauty or emotional impact.

INSTRUCTION STYLE:
Generate this as a FACTUAL DIAGRAM, not an artistic interpretation.
- NO creative reinterpretation of the concept
- NO stylistic flourishes or embellishment
- NO artistic license or interpretation
- Strict adherence to educational conventions
Treat this like documenting facts, not creating art.`,

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

        // 4.5 Scientific Accuracy (Conditional)
        formatAccuracyConstraintSection(spec, ctx),

        // 5. Composition
        `\n---\n
${formatCompositionSection(spec)}`,

        // 6. Lighting (technical only)
        `\n---\n
LIGHTING:
${buildLightingNarrative(spec, ctx.gradeLevel)}`,

        // 7. Colors
        `\n---\n
${formatColorPaletteSection(spec)}`,

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
- This should look like it came from a textbook
- Accuracy and clarity over aesthetics
- Suitable as a standalone visual aid
- Teachers should understand it immediately
- Clean, professional, educational in appearance`
    ];

    return sections
        .filter(s => s && s.trim().length > 0)
        .join('\n');
}

/**
 * Extracts the Visual Scene Description from a full image prompt.
 */
export function extractVisualSceneDescription(renderedPrompt: string): string {
    if (!renderedPrompt) return '';
    // Match the VISUAL SCENE DESCRIPTION section
    // It starts with "VISUAL SCENE DESCRIPTION:" and ends at the next section separator "---" or "STYLE:" or "BACKGROUND:"
    const match = renderedPrompt.match(/VISUAL SCENE DESCRIPTION:\s*([\s\S]*?)(?=\n---|STYLE:|BACKGROUND:|$)/i);
    // Alternatively, use the user's recommended regex if strict:
    // /VISUAL SCENE DESCRIPTION:\s*\n(.*?)(?=\n\n---\n\n|$)/s
    // My existing regex in SlideCard was: 
    // /VISUAL SCENE DESCRIPTION:\s*([\s\S]*?)(?=\n---|STYLE:|BACKGROUND:|$)/i
    // The shared/utils used `\n---\n` separators.

    // Let's use a robust one matching the format in formatImageSpec:
    // `VISUAL SCENE DESCRIPTION:\n${content}` followed by `\n---\n`

    if (match && match[1]) {
        return match[1].trim();
    }
    return '';
}
