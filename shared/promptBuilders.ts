
export function buildSingleSlideImagePromptSystemInstructions(): string {
  return `<role>
You are an expert Visual Learning Specialist.
</role>

<task>
Compose a visual description of an educational illustration that depicts the 
specific concepts from <key_points> within the scope of <title>.
Construct the description as a cohesive narrative  in this order:
1. [Subject]: The central physical element.
2. [Action]: The active process, movement, or visual state.
3. [Setting]: The immediate environment.
4. [Labels]: Any necessary visible text.
</task>

<constraints>
1. Audience: Ensure the complexity is age-appropriate for the <grade_level> grade.
2. Visual Clarity: Describe only visible objects and processes, do not use abstract metaphors.
3. Text and Labels: Include text labels for key elements when they enhance understanding of the concepts from <key_points>.
4. Exclusions: Strictly exclude descriptions of artistic style, perspective, lighting effects, camera angles, or shading.
</constraints>

<output_format>
Return strictly the description text. No markdown, no field labels.
</output_format>`.trim();
}

export function buildSingleSlideImagePromptUserPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  slideTitle: string,
  slideContent: string[]
): string {
  return `<context>
<topic>${topic}</topic>
<subject>${subject}</subject>
<grade_level>${gradeLevel}</grade_level>
</context>

<slide_content>
<title>${slideTitle}</title>
<key_points>
${slideContent.map(bullet => `- ${bullet}`).join('\n')}
  </key_points>
</slide_content>`.trim();
}

export function buildSlideDeckSystemPrompt(): string {
  return `
<role>
You are an expert educational content creator and curriculum designer.
Your goal is to generate a professional, engaging slide deck tailored to a specific grade level.
</role>

<content_standards>
1. Educational Value: Content must be accurate, age-appropriate, and pedagogically sound for the target grade level.
2. Clarity: Use clear, concise language appropriate for students.
3. Engagement: Speaker notes should be engaging and conversational, written in a script format for the teacher to read.
</content_standards>

<structure_requirements>
- Slide 1: Title Slide. Must include: title, a short tagline, the subject name, and the grade level.
- Slides 2-N: Content Slides. Each must include a title, body content, and speaker notes.
- Total Slides: The deck must match the requested slide count exactly.
</structure_requirements>

<formatting_constraints>
- Bullets: Use the exact number of bullet points requested per content slide.
- No Markdown: Content strings must be plain text. Do NOT use markdown bold (**), italics (*), or manual bullet characters (-).
- Speaker Notes: Provide a complete, ready-to-use script for the teacher. Do NOT include source citations or references in the notes.
</formatting_constraints>

<output_format>
Return a valid JSON array of objects. Do not include markdown code fences.
[
  {
    "title": "string",
    "content": ["string", "string", ...],
    "layout": "Title Slide" | "Content",
    "speakerNotes": "string"
  }
]
</output_format>
`.trim();
}

export function buildSlideDeckUserPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  totalSlides: number,
  numContentSlides: number,
  bulletsPerSlide: number,
  sourceMaterial?: string,
  useWebSearch?: boolean,
  additionalInstructions?: string
): string {
  const context = `
<presentation_context>
- Topic: "${topic}"
- Subject: "${subject}"
- Grade Level: "${gradeLevel}"
- Total Slides: ${totalSlides} (1 Title + ${numContentSlides} Content)
- Bullets Per Slide: ${bulletsPerSlide}
${additionalInstructions ? `- Additional Instructions: "${additionalInstructions}"` : ''}
</presentation_context>
`.trim();

  let dataSection = '';
  if (sourceMaterial) {
    const instruction = useWebSearch
      ? 'Use the following text as your primary source of truth.'
      : 'You must derive your content ENTIRELY from the following text.';

    dataSection += `
<source_material>
${instruction}
SOURCE BEGIN:
${sourceMaterial}
SOURCE END
</source_material>
`.trim();
  }

  if (useWebSearch) {
    const instruction = sourceMaterial
      ? 'Use Google Search to supplement the source material with additional details, context, and examples.'
      : 'Since no source material is provided, you MUST use Google Search to research this topic.';

    dataSection += `\n\n<research_instructions>
${instruction}
1. Find high-quality, age-appropriate information.
2. Synthesize results as the core content for the presentation.
</research_instructions>
`.trim();
  }

  return `${context}\n\n${dataSection.trim()}`.trim();
}

