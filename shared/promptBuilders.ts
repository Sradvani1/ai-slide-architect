
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
Create an exhaustive, high density research report that will be used to generate presentation slides.
The report should be a complete, coherent, organized knowledge base on the topic: <topic>.
</task>

<constraints>
1. Accuracy: Use factual, verifiable information.
2. Clarity: Use clear, age-appropriate language.
3. Structure: Organize the report logically for slide creation.
4. Grounding: When <use_web_search>true</use_web_search>, you MUST use Google Search before writing the report.
5. Depth: Every sub-topic must include at least 3-4 specific supporting facts or examples.
</constraints>

<output_format>
Return a single plain-text research report. No markdown. No JSON.
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
  const effectiveUseWebSearch = sourceMaterial ? useWebSearch : true;
  const gradeString = gradeLevel.toLowerCase().includes('grade')
    ? gradeLevel
    : `${gradeLevel} Grade`;

  const sections: string[] = [];

  sections.push(`<context>
<use_web_search>${effectiveUseWebSearch ? 'true' : 'false'}</use_web_search>
<topic>${topic}</topic>
<subject>${subject}</subject>
<grade_level>${gradeString}</grade_level>
${additionalInstructions ? `<additional_instructions>${additionalInstructions}</additional_instructions>` : ''}
</context>`.trim());

if (sourceMaterial) {
  sections.push(`<source_material>
Use the following text as your primary source of truth.

SOURCE BEGIN:
${sourceMaterial}
SOURCE END
</source_material>`.trim());
}

if (sourceMaterial && effectiveUseWebSearch) {
    sections.push(`<research_instructions>
Use Google Search to supplement the source material with additional details, context, and examples.
</research_instructions>`.trim());
  } else if (sourceMaterial && !effectiveUseWebSearch) {
    sections.push(`<research_instructions>
You must derive your research ENTIRELY from the provided source material.
</research_instructions>`.trim());
  }

  return sections.join('\n\n').trim();
}

