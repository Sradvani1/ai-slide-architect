
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
  return `<role>
You are an expert educational content creator and curriculum designer.
Your goal is to generate a professional, engaging slide deck and speaker notes on the topic <topic> tailored to <grade_level> <subject>.
</role>

<task>
- Slide 1: Title Slide. Must include: a title, a tagline (3-5 words), the subject <subject>, and the grade level <grade_level>.
- Slides 2-<total_slides>: Content Slides. Each must include: a title, exactly <bullets_per_slide> bullet points, and speaker notes.
- Total Slides: The deck must contain exactly <total_slides> slides (1 title slide + <content_slides_count> content slides).
</task>

<constraints>
1. Educational Value: Content must be accurate, age-appropriate, and pedagogically sound for the target grade level.
2. Clarity: Use clear, concise language appropriate for the target grade level students.
3. Engagement: Speaker notes should be engaging and conversational, written in a script format.
4. Bullets: Use the exact number of bullet points requested per content slide.
5. No Markdown: Content strings must be plain text. Do NOT use markdown bold (**), italics (*), or manual bullet characters (-).
</constraints>

<output_format>
Return a valid JSON array of objects. Do not include markdown code fences.
[
  {
    "title": "string",
    "content": ["string", "string", ...],
    "speakerNotes": "string"
  }
]
</output_format>`.trim();
}

export function buildSlideDeckUserPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  numContentSlides: number,
  bulletsPerSlide: number,
  sourceMaterial?: string,
  useWebSearch?: boolean,
  additionalInstructions?: string
): string {
  const gradeString = gradeLevel.toLowerCase().includes('grade')
    ? gradeLevel
    : `${gradeLevel} Grade`;

  const totalSlides = numContentSlides + 1;

  const context = `<context>
  <topic>${topic}</topic>
  <subject>${subject}</subject>
  <grade_level>${gradeString}</grade_level>
  <total_slides>${totalSlides}</total_slides>
  <content_slides_count>${numContentSlides}</content_slides_count>
  <bullets_per_slide>${bulletsPerSlide}</bullets_per_slide>
  ${additionalInstructions ? `<additional_instructions>${additionalInstructions}</additional_instructions>` : ''}
</context>`.trim();

  const sections = [context];

  if (sourceMaterial) {
    const instruction = useWebSearch
      ? 'Use the following text as your primary source of truth. Supplement with web search for additional context.'
      : 'You must derive your content ENTIRELY from the following text.';

    sections.push(`<source_material>
${instruction}

SOURCE BEGIN:
${sourceMaterial}
SOURCE END
</source_material>`.trim());
  }

  if (useWebSearch) {
    const instruction = sourceMaterial
      ? 'Use web search to supplement the source material with additional details, context, and examples.'
      : 'Since no source material is provided, you MUST use Google Search to research this topic.';

    sections.push(`<research_instructions>
${instruction}

1. Find high-quality, age-appropriate information.
2. Synthesize results as the core content for the presentation.
</research_instructions>`.trim());
  }

  return sections.join('\n\n').trim();
}

