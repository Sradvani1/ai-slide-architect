
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
    - Slide 1: Title Slide (Title, Content, imagePrompt, Speaker Notes). "content" array: ["<tagline>", "${subject}", "${gradeLevel} Grade"].
    - Slides 2-${totalSlides}: Content Slides (Title, Content, imagePrompt, Speaker Notes).
  `;
}

function buildFormattingConstraintsSection(bulletsPerSlide: number): string {
  return `
  FORMATTING CONSTRAINTS(CRITICAL)
    - Bullets: Exactly ${bulletsPerSlide} bullet points per content slide.
    - No Markdown: Bullet points must be plain strings. NO bold (**), italics (*), or bullet characters (-) in the string itself.
  `;
}

function buildImagePromptInstructionsSection(gradeLevel: string): string {
  return `
  IMAGE PROMPT GENERATION
  
  PURPOSE & CONTEXT:
  These images will be used by a teacher in classroom presentations. Each image must be a 
  standalone educational resource that visually explains the concept to students. The image 
  should help a teacher convey information clearly and effectively.
  
  For each slide, generate a detailed description of an educational illustration that clearly 
  depicts the key concepts from this slide.
  
  Construct the description in this order:
  1. Start by describing the main Subject (the central visual element)
  2. Next, describe the Action (the active process, movement, or behavior)
  3. Finally, describe the Setting (the specific environment or context)
  
  CONTENT REQUIREMENTS:
  - The description must be vivid and factual, ensuring the educational illustration serves as a 
    clear visual aid for the key concepts.
  - Focus on visual elements that directly explain or demonstrate the key concepts being taught.
  - Describe concrete, visible objects and processes that students can observe and understand.
  - Ensure the visual complexity is appropriate for ${gradeLevel} students (but do not mention 
    style or artistic rendering - that is handled separately).
  
  TEXT AND LABELS:
  - Include explanatory text, labels, and annotations where they enhance understanding.
  - Specify which elements should be labeled and what the labels should say (e.g., "Label the 
    nucleus, mitochondria, and chloroplasts in the cell").
  - Include descriptive text that helps explain the concept (e.g., "Add arrows with labels 
    showing 'Water Cycle: Ocean → Evaporation → Clouds → Rain'").
  - Text should be clear, concise, and directly support the educational purpose.
  - Only include labels/text when they add educational value - avoid decorative or unnecessary text.
  
  OUTPUT FORMAT:
  Output the image prompt as a simple string in the \`imagePrompt\` field.
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
      "imagePrompt": "string",
      "speakerNotes": "string (Script only)"
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
  buildImagePromptInstructionsSection,
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
    buildImagePromptInstructionsSection(gradeLevel),
  ];

  if (includeOutputFormat) {
    sections.push(buildOutputFormatSection());
  }

  return sections.filter(section => section.trim().length > 0).join('\n');
}

