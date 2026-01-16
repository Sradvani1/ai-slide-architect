
export function buildSingleSlideImagePromptSystemInstructions(): string {
  return `<role>
You are an educational content creator and curriculum designer.
</role>

<task>
Compose a detailed description of an educational illustration that depicts 
the concepts from <key_points> within the scope of <title>.
Construct the description as a cohesive narrative in this order:
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
You are an educational content creator and curriculum designer.
Your goal is to generate a professional, engaging slide deck and speaker notes on the topic: <topic>, tailored to <grade_level> <subject>.
</role>

<task>
- Slide 1: Title Slide. The JSON object must have: "title" (main presentation title), "content" array with exactly 3 strings in this order (no labels): [tagline (3-5 words), the subject value from <subject>, the grade value from <grade_level>], and "speakerNotes".
- Slides 2-N: Content Slides. Each JSON object must have: "title" (slide title), "content" array with exactly <bullets_per_slide> strings (bullet points), and "speakerNotes".
- Total Slides: The deck must contain exactly <total_slides> slides.
</task>

<constraints>
1. Educational Value: Content must be accurate, age-appropriate, and pedagogically sound for <grade_level>.
2. Clarity: Use clear, concise language appropriate for <grade_level>.
3. Engagement: Speaker notes should be engaging and conversational, written in a script format.
4. Bullets: Use exactly <bullets_per_slide> bullet points for Content Slides.
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
  researchContent?: string,
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
  <bullets_per_slide>${bulletsPerSlide}</bullets_per_slide>
  ${additionalInstructions ? `<additional_instructions>${additionalInstructions}</additional_instructions>` : ''}
</context>`.trim();

  const sections = [context];

  if (researchContent) {
    const instruction = 'You must derive your content ENTIRELY from the following research.';

    sections.push(`<source_material>
${instruction}

SOURCE BEGIN:
${researchContent}
SOURCE END
</source_material>`.trim());
  }


  return sections.join('\n\n').trim();
}

export function buildResearchSystemPrompt(): string {
  return `<role>
You are an educational content researcher and curriculum designer.
</role>

<task>
Create a single, structured research summary that will be used to generate slides.
The summary should be complete, coherent, and organized for easy conversion into a slide deck.
</task>

<constraints>
1. Accuracy: Use factual, verifiable information.
2. Clarity: Use clear, age-appropriate language.
3. Structure: Organize the summary logically for slide creation.
4. No Sources: Do NOT include citations, URLs, or references in the research summary.
</constraints>

<output_format>
Return a single plain-text research summary. No markdown. No JSON. No lists of sources.
</output_format>`.trim();
}

export function buildResearchUserPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  sourceMaterial?: string,
  useWebSearch: boolean = true,
  additionalInstructions?: string
): string {
  const gradeString = gradeLevel.toLowerCase().includes('grade')
    ? gradeLevel
    : `${gradeLevel} Grade`;

  const sections: string[] = [];

  sections.push(`<context>
<topic>${topic}</topic>
<subject>${subject}</subject>
<grade_level>${gradeString}</grade_level>
${additionalInstructions ? `<additional_instructions>${additionalInstructions}</additional_instructions>` : ''}
</context>`.trim());

  if (sourceMaterial) {
    const instruction = useWebSearch
      ? 'Use the following text as your primary source of truth. Supplement with web search for additional context.'
      : 'Use ONLY the following text as your source. Do NOT use web search.';

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
2. Synthesize results into a single, structured research summary.
3. Focus on facts, concepts, and explanations appropriate for ${gradeString} students.
</research_instructions>`.trim());
  } else {
    sections.push(`<research_instructions>
You must derive your research summary ENTIRELY from the provided source material.
Do NOT include sources, citations, URLs, or references.
</research_instructions>`.trim());
  }

  return sections.join('\n\n').trim();
}

