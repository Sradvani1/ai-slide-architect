
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
  You must output an \`imageSpec\` object for each slide (including the Title Slide). This object will be converted into an AI image generation prompt.

  TEACHING GOAL:
  - The image must teach a specific concept, not just decorate the slide.
  - Define a \`conceptualPurpose\`: What should the student understand from this image?

  imageSpec rules:
  - \`conceptualPurpose\`: REQUIRED. explicit pedagogical goal.
  - \`primaryFocal\`: The main visual subject.
  - \`subjects\`: 2–5 concrete objects to draw.
  - \`mustInclude\`: 2–6 critical details to include.
  - \`avoid\`: List distracting elements to exclude.
  - Composition:
    - \`layout\`: Choose best fit: "single-focal-subject-centered" (default), "balanced-pair" (comparisons), "comparison-split-screen" (before/after), "diagram-with-flow" (processes), "simple-sequence-2-panel" (steps).
    - \`viewpoint\`: "front", "side", "overhead", "isometric-3d-cutaway" (for structures), "side-profile" (for layers/processes).
    - \`whitespace\`: "generous" (default) or "moderate".
  - Text policy:
    - Default: "NO_LABELS". Choose this unless text labels improve learning.
    - "LIMITED_LABELS_1_TO_3": Use for diagrams where parts need names.
      - CONTRACT: If you choose this, you MUST provide 1-3 distinct strings in \`allowedLabels\`.
      - If \`allowedLabels\` is empty, the system will FORCE "NO_LABELS".
  - Colors: 3–5 high-contrast colors.
  - negativePrompt: list failure modes (e.g., "blur", "text", "complex background").

  Output a valid JSON object.
  `;
}

function buildOutputFormatSection(): string {
  return `
  OUTPUT FORMAT
  Return a valid JSON array of objects.Do not include markdown code fences(like \`\`\`json).
  JSON Structure:
  [
    {
      "title": "string",
      "content": ["string", "string", ...], 
      "layout": "Title Slide" | "Content",
      "imageSpec": {
        "primaryFocal": "string",
        "subjects": ["string"],
        "mustInclude": ["string"],
        "avoid": ["string"],
        "composition": { "layout": "string", "viewpoint": "string", "whitespace": "string" },
        "textPolicy": "string"
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
    3. Ensure the JSON schema is valid (same fields as input).
    4. Return ONLY the JSON object.
    `;
}
