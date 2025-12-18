
function buildSystemRoleSection(): string {
  return `
    You are an expert educational content creator and curriculum designer.
    Your goal is to generate a professional, engaging slide deck that is tailored to the specified grade level.
  `;
}

function buildInputContextSection(
  topic: string,
  subject: string,
  gradeLevel: string,
  totalSlides: number,
  numSlides: number,
  additionalInstructions?: string
): string {
  return `
  PRESENTATION CONTEXT
  Topic: "${topic}"
  Subject: ${subject}
  Target Audience: ${gradeLevel}
  Length: ${totalSlides} slides (1 Title + ${numSlides} Content)
  ${additionalInstructions ? `- Additional Instructions: "${additionalInstructions}"` : ''}
  `;
}

function buildSourceMaterialSection(sourceMaterial: string, useWebSearch: boolean): string {
  if (sourceMaterial) {
    return `
    SOURCE MATERIAL (GROUND TRUTH)
      You must derive your content ENTIRELY from the following text. Do not contradict it.
    
    SOURCE BEGIN:
    ${sourceMaterial}
    SOURCE END
  `;
  } else if (useWebSearch) {
    return `
    RESEARCH PHASE (REQUIRED)
      Since no source material is provided, you MUST use Google Search to act as the primary content researcher.
    
    INSTRUCTIONS
    1. Find Content: Search for high-quality, age-appropriate information to build the core content of these slides.
    2. Curate Sources: Select the best, most reliable references (URLs) that a teacher would value.
    3. Synthesize: Use these search results as the SOLE source of truth for the presentation.
    `;
  }
  return '';
}

function buildContentStandardsSection(): string {
  return `
  CONTENT STANDARDS
    1. Educational Value: Content must be accurate, age-appropriate, and pedagogically sound.
    2. Clarity: Use clear, concise language.
    3. Engagement: Speaker notes should be engaging and conversational (script format).
  `;
}

function buildStructureRequirementsSection(totalSlides: number, subject: string, gradeLevel: string): string {
  return `
  STRUCTURE REQUIREMENTS
    - Slide 1: Title Slide (Title, Content, ImageSpec, Speaker Notes). "content" array: ["<tagline>", "${subject}", "${gradeLevel} Grade"].
    - Slides 2-${totalSlides}: Content Slides (Title, Content, ImageSpec, Speaker Notes).
  `;
}

function buildFormattingConstraintsSection(bulletsPerSlide: number): string {
  return `
  FORMATTING CONSTRAINTS(CRITICAL)
    - Bullets: Exactly ${bulletsPerSlide} bullet points per content slide.
    - No Markdown: Bullet points must be plain strings. NO bold (**), italics (*), or bullet characters (-) in the string itself.
  `;
}

function buildImageSpecInstructionsSection(): string {
  return `
  IMAGE VISUAL SPECIFICATION (imageSpec)
  You must output an \`imageSpec\` object for each slide. This object will be converted into a rich narrative AI image generation prompt.

  TEACHING GOAL:
  - The image must teach a specific concept, not just decorate the slide.
  - Define a \`conceptualPurpose\`: What should the student understand from this image?

  INSTRUCTIONS: Use descriptive adjectives and verbs (narrative style) rather than single keywords.
  EXAMPLE: Instead of "robot", use "a translucent glass robot barista with LED eyes".
  EXAMPLE: Instead of "evaporating", use "water molecules evaporating from the surface, rising as visible steam".

  CRITICAL: When specifying \`visualizationDynamics\`, always use the gerund (verb+ing) form:
  - "evaporating" (not "evaporate")
  - "colliding" (not "collide")
  - "flowing" (not "flow")
  - "dividing" (not "divide")
  - "reacting" (not "react")
  This ensures the narrative flows naturally.

  5 CORE COMPONENTS (Required):
  1. SUBJECT: \`primaryFocal\` and \`subjects\`. The main visual elements.
  2. ACTION/DYNAMICS: \`visualizationDynamics\`. Describe processes (e.g., "evaporating", "colliding", "flowing"). Static images do not teach processes; describe the action!
  3. ENVIRONMENT: \`environment\` (setting) and \`contextualDetails\`. Where is this happening?
  4. LIGHTING: \`lighting\` object. Set the mood, quality (e.g. "soft", "dramatic"), and direction.
  5. COMPOSITION: \`composition\` object. Layout and viewpoint.

  imageSpec rules details:
  - \`conceptualPurpose\`: REQUIRED. explicit pedagogical goal.
  - \`visualizationDynamics\`: Array of strings describing movement/change. MUST be gerunds (ending in -ing).
  - \`environment\`: The specific setting.
  - \`contextualDetails\`: Additional environmental details that enhance the scene.
  - \`mustInclude\`: 2–6 critical details to include.
  - \`avoid\`: List distracting elements to exclude.
  - Composition:
    - \`layout\`: "single-focal-subject-centered", "balanced-pair", "comparison-split-screen", "diagram-with-flow", "simple-sequence-2-panel".
    - \`viewpoint\`: Use professional camera terminology:
      - "isometric-3d-cutaway" for structures (buildings, molecules, organs)
      - "side-profile" for layers/geology (rock layers, atmospheric layers)
      - "macro-close-up" for details (cells, textures) - specify "shallow depth of field"
      - "overhead" or "bird's-eye-view" for maps, diagrams, top-down views
      - "dutch-angle" for tension, dynamics, or dramatic effect
      - "child-eye-level" for relatable perspectives in elementary content
    - \`depthOfField\`: "shallow" (focus on subject) or "deep" (context).
    - \`framingRationale\`: Briefly explain why this viewpoint helps the educational goal.
  - Text policy:
    - Default: "NO_LABELS". Choose this unless text labels improve learning.
    - "LIMITED_LABELS_1_TO_3": For simple diagrams. Requires \`allowedLabels\`.
    - "DIAGRAM_LABELS_WITH_LEGEND": For complex charts. Requires \`allowedLabels\`.
    - When labels are used, specify \`labelPlacement\` (e.g., "next to arrows", "below each element") and \`labelFont\` (e.g., "bold sans-serif", "Arial").
  - Grounding:
    - \`requiresGrounding\`: Set to true ONLY for images that represent specific factual data requiring verification:
      * Maps that must show current/accurate geography
      * Charts with specific data (election results, weather forecasts, stock prices)
      * Timeline visualizations with factual dates
      * Scientific diagrams with current research accuracy
    - Examples:
      * "Visualize the 2025 solar cycle" → requiresGrounding: true
      * "A fantasy dragon in a medieval castle" → requiresGrounding: false
      * "Current population density map of Africa" → requiresGrounding: true
      * "Abstract representation of photosynthesis" → requiresGrounding: false
  - Colors: 3–5 high-contrast colors.
  - negativePrompt: list failure modes (e.g., "blur", "text", "complex background").

  Output a valid JSON object.
  `;
}

function buildOutputFormatSection(): string {
  return `
  OUTPUT FORMAT
  Return a valid JSON array of objects. Do not include markdown code fences (like \`\`\`json).
  JSON Structure:
  [
    {
      "title": "string",
      "content": ["string", "string", ...], 
      "layout": "Title Slide" | "Content",
      "imageSpec": {
        "primaryFocal": "string",
        "conceptualPurpose": "string",
        "subjects": ["string"],
        "visualizationDynamics": ["string"],
        "environment": "string",
        "contextualDetails": ["string"],
        "mustInclude": ["string"],
        "avoid": ["string"],
        "composition": {
          "layout": "string",
          "viewpoint": "string",
          "whitespace": "string",
          "depthOfField": "shallow" | "deep",
          "framingRationale": "string"
        },
        "lighting": {
          "quality": "string",
          "direction": "string",
          "colorTemperature": "string",
          "mood": "string"
        },
        "textPolicy": "string",
        "allowedLabels": ["string"],
        "labelPlacement": "string",
        "labelFont": "string",
        "requiresGrounding": boolean,
        "colors": ["string"],
        "negativePrompt": ["string"]
      }, 
      "speakerNotes": "string (Script only)",
      "sources": ["url1", "url2"]
    }
  ]
  `;
}

export {
  buildSystemRoleSection,
  buildInputContextSection,
  buildSourceMaterialSection,
  buildContentStandardsSection,
  buildStructureRequirementsSection,
  buildFormattingConstraintsSection,
  buildImageSpecInstructionsSection,
  buildOutputFormatSection
};

/**
 * Builds the complete prompt for slide generation
 */
export function buildSlideGenerationPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  totalSlides: number,
  numSlides: number,
  sourceMaterial: string,
  useWebSearch: boolean,
  bulletsPerSlide: number,
  additionalInstructions?: string,
  includeOutputFormat?: boolean
): string {
  const sections = [
    buildSystemRoleSection(),
    buildInputContextSection(topic, subject, gradeLevel, totalSlides, numSlides, additionalInstructions),
    buildSourceMaterialSection(sourceMaterial, useWebSearch),
    buildContentStandardsSection(),
    buildStructureRequirementsSection(totalSlides, subject, gradeLevel),
    buildFormattingConstraintsSection(bulletsPerSlide),
    buildImageSpecInstructionsSection(),
  ];

  if (includeOutputFormat) {
    sections.push(buildOutputFormatSection());
  }

  return sections.filter(section => section.trim().length > 0).join('\n');
}

/**
 * Builds the prompt for regenerating an ImageSpec based on user feedback
 */
export function buildSpecRegenerationPrompt(
  currentSpec: any,
  changeRequest: string,
  slideContext: { title: string; content: string[] }
): string {
  return `
    You are an expert Visual Director.
    Task: Update the following Image Specification based on a user's request.

    CONTEXT:
    Slide Title: "${slideContext.title}"
    Slide Content: ${slideContext.content.slice(0, 3).join('; ')}...

    CURRENT SPEC (JSON):
    ${JSON.stringify(currentSpec, null, 2)}

    USER REQUEST:
    "${changeRequest}"

    INSTRUCTIONS:
    1. Modify the JSON to satisfy the user request.
    2. Maintain strict alignment with the slide concept.
    3. Use descriptive adjectives and verbs (narrative style) rather than single keywords.
    4. Ensure all 5 Core Components are considered: Subject, Action/Dynamics, Environment, Lighting, Composition.
    5. Ensure the JSON schema is valid (same fields as input).
    6. Return ONLY the JSON object.
    `;
}
