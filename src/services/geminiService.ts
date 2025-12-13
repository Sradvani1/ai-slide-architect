
import { GoogleGenAI } from "@google/genai";
import type { Slide } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });


export const generateSlidesFromDocument = async (
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string,
  numSlides: number,
  useWebSearch: boolean = false,
  temperature: number = 0.7,
  bulletsPerSlide: number = 4
): Promise<Slide[]> => {
  let prompt = `
    Based on the following topic, grade level, and subject, generate a slide deck presentation.

    **Topic:**
    ${topic}

    **Grade Level:**
    ${gradeLevel}

    **Subject:**
    ${subject}

    **Number of Slides:**
    ${numSlides}
    `;

  if (sourceMaterial) {
    prompt += `
    **Source Material:**
    ---
    ${sourceMaterial}
    ---
    `;
  }

  if (useWebSearch) {
    prompt += `
    **Web Search:**
    You have access to Google Search. Please use it to find the most up-to-date and relevant information to supplement the content, especially if the source material is missing details or if the topic requires current knowledge.
    `;
  }

  const totalSlides = numSlides + 1;

  prompt += `
    Please generate exactly ${totalSlides} slides.
    
    **SLIDE 1 MUST BE A TITLE SLIDE:**
    - **Title:** Use the provided Topic: "${topic}".
    - **Content:**
      - A catchy, short tagline related to the topic.
      - "${gradeLevel}"
      - "${subject}"
    - **Layout:** "Title Slide"
    - **Image Prompt:** Create a prompt for an educational illustration that visually represents the overall topic in an engaging, classroom-appropriate style.
    - **Speaker Notes:** Brief introductory remarks welcoming the class and introducing the topic.

    **SLIDES 2 to ${totalSlides}:**
    - Generate content slides covering the topic in a logical sequence.
    - For each slide, provide a title, content as bullet points (EXACTLY ${bulletsPerSlide} bullet points per slide), a suggested layout, a prompt for an image generator, and detailed speaker notes.
    - **IMPORTANT:** Do NOT use markdown formatting (like **bold** or *italic*) in the bullet points. Use plain text only.
    - **IMPORTANT:** Do NOT use nested bullet points or sub-bullets. Each content item must be a single, standalone statement.
    
    **CRITICAL REQUIREMENTS FOR IMAGE PROMPTS:**

    For each slide, generate an imagePrompt for an EDUCATIONAL ILLUSTRATION. These images will be PROJECTED IN A CLASSROOM for ${gradeLevel} grade students during teacher presentations.

    **Style Requirements:**
    Use moderately detailed educational illustrations. Simplify complex concepts while maintaining accuracy. Use engaging visuals with clear labels and relatable contexts.

    **Subject-Specific Guidelines:**
    - **Math:** Illustrate mathematical concepts with visual representations, labeled shapes, and equations integrated into the illustration.
    - **Science:** Illustrate scientific concepts with labeled components, process flows, and accurate visual representations.
    - **Language Arts:** Illustrate thematic imagery, symbolism, historical context, and period-appropriate scenes.
    - **Social Studies:** Illustrate historical scenes, geographical concepts, and cause-effect relationships.
    - **World Languages:** Illustrate cultural markers, landmarks, daily life scenes, and clear text labels in the target language.
    - **Arts:** Illustrate artistic techniques, specific movements, tools/materials, and masterpieces with accurate visual references.
    - **Physical Education:** Illustrate correct form, court/field layouts, game strategies, and anatomical focus areas.

    **Classroom Projection Requirements:**
    - **High contrast:** Use bold colors and clear visual distinctions
    - **Large text:** All labels must be easily readable when projected
    - **Minimal clutter:** Focus on 3-5 key visual elements
    - **Clear focal point:** Direct attention to the main concept

    **Text and Label Requirements:**
    - Include labels where they enhance understanding of the illustration
    - **Label formatting:** Sans-serif, bold, high contrast, with clear arrows/lines connecting to elements

    **Examples of Excellent Prompts:**
    - (Science): "An educational illustration of a plant cell cross-section. The cell wall, nucleus, chloroplasts, and large central vacuole are clearly illustrated with large, bold labels."
    - (Math): "An educational illustration showing a right triangle with sides labeled a, b, c. Three squares are attached to each side showing areas a², b², c². The equation a² + b² = c² is displayed prominently."
    - (History): "An educational illustration of a 19th-century textile factory interior showing workers operating mechanical looms and steam-powered machinery with period-accurate clothing and equipment."

    **Examples of Poor Prompts to Avoid:**
    - "Abstract representation of photosynthesis" (too vague)
    - "Simple icon of a cell" (not an illustration)
    - "Infographic about the water cycle" (wrong image type)
    
    Ensure the output is a valid JSON array of slide objects. Each object MUST have these properties:
    - "title": string
    - "content": array of strings (each bullet point as a separate string)
    - "layout": string
    - "imagePrompt": string
    - "speakerNotes": string (Detailed speaker notes for the teacher. **IMPORTANT:** At the very end of the speaker notes, add a section titled "Sources:". You MUST list the full URLs of any websites used from web search. Do NOT just say "Google Search" or "Web Search". List the actual links found. If using uploaded files, list the filenames. If no specific sources were used, omit this section.)
    `;

  try {
    const tools: any[] = [];
    if (useWebSearch) {
      tools.push({ googleSearch: {} });
    }

    const config: any = {
      temperature: temperature,
      tools: tools.length > 0 ? tools : undefined,
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: config,
    });

    let jsonText = response.text.trim();

    // Clean up markdown formatting if present (needed when not using JSON mode)
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const slides: Slide[] = JSON.parse(jsonText);

    // Ensure speakerNotes exists for each slide
    slides.forEach(slide => {
      if (!slide.speakerNotes) {
        slide.speakerNotes = "Speaker notes were not generated for this slide.";
      }
    });

    return slides;

  } catch (error) {
    console.error("Error generating slides with Gemini API:", error);
    throw new Error("The AI model failed to generate a valid response.");
  }
};

export const generateImage = async (prompt: string, temperature: number = 0.3): Promise<Blob> => {
  try {
    // Combine the generated prompt with guiding instructions for the image gen model
    const enhancedPrompt = `${prompt}

**Style Requirements:**
Use moderately detailed educational illustrations. Simplify complex concepts while maintaining accuracy. Use engaging visuals with clear labels and relatable contexts.

**Classroom Projection Requirements:**
- High contrast: Use bold colors and clear visual distinctions
- Large text: All labels must be easily readable when projected
- Minimal clutter: Focus on 3-5 key visual elements
- Clear focal point: Direct attention to the main concept

**Text and Label Requirements:**
- Include labels where they enhance understanding of the illustration
- Label formatting: Sans-serif, bold, high contrast, with clear arrows/lines connecting to elements`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: enhancedPrompt,
      config: {
        temperature: temperature,
      },
    });

    // Extract image data from response
    // Try different possible response structures
    const parts = (response as any).parts || (response as any).candidates?.[0]?.content?.parts || [];

    if (parts && parts.length > 0) {
      for (const part of parts) {
        // Try both camelCase and snake_case property names
        const inlineData = part.inlineData || part.inline_data;
        if (inlineData) {
          // Convert base64 to blob
          const base64Data = inlineData.data;
          const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';

          // Convert base64 to binary
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          return new Blob([bytes], { type: mimeType });
        }
      }
    }

    // Log response structure for debugging if image not found
    console.error("Response structure:", JSON.stringify(response, null, 2));
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image with Gemini API:", error);
    throw new Error("Failed to generate image. Please try again.");
  }
};

export const regenerateImagePrompt = async (
  slideTitle: string,
  slideContent: string[],
  gradeLevel: string,
  subject: string,
  temperature: number = 0.7
): Promise<string> => {
  // IMPORTANT: These instructions must mirror exactly what is in generateSlidesFromDocument
  const prompt = `
    Generate an imagePrompt for an EDUCATIONAL ILLUSTRATION for the following presentation slide. This image will be PROJECTED IN A CLASSROOM for 6th-12th grade students.
    
    **Slide Context:**
    - Title: "${slideTitle}"
    - Content: ${slideContent.join('; ')}
    - Grade Level: "${gradeLevel}"
    - Subject: "${subject}"

    **Style Requirements:**
    Use moderately detailed educational illustrations. Simplify complex concepts while maintaining accuracy. Use engaging visuals with clear labels and relatable contexts.

    **Subject-Specific Guidelines:**
    - **Math:** Illustrate mathematical concepts with visual representations, labeled shapes, and equations integrated into the illustration.
    - **Science:** Illustrate scientific concepts with labeled components, process flows, and accurate visual representations.
    - **Language Arts:** Illustrate thematic imagery, symbolism, historical context, and period-appropriate scenes.
    - **Social Studies:** Illustrate historical scenes, geographical concepts, and cause-effect relationships.
    - **World Languages:** Illustrate cultural markers, landmarks, daily life scenes, and clear text labels in the target language.
    - **Arts:** Illustrate artistic techniques, specific movements, tools/materials, and masterpieces with accurate visual references.
    - **Physical Education:** Illustrate correct form, court/field layouts, game strategies, and anatomical focus areas.

    **Classroom Projection Requirements:**
    - **High contrast:** Use bold colors and clear visual distinctions
    - **Large text:** All labels must be easily readable when projected
    - **Minimal clutter:** Focus on 3-5 key visual elements
    - **Clear focal point:** Direct attention to the main concept

    **Text and Label Requirements:**
    - Include labels where they enhance understanding of the illustration
    - **Label formatting:** Sans-serif, bold, high contrast, with clear arrows/lines connecting to elements

    **Examples of Excellent Prompts:**
    - (Science): "An educational illustration of a plant cell cross-section. The cell wall, nucleus, chloroplasts, and large central vacuole are clearly illustrated with large, bold labels."
    - (Math): "An educational illustration showing a right triangle with sides labeled a, b, c. Three squares are attached to each side showing areas a², b², c². The equation a² + b² = c² is displayed prominently."
    - (History): "An educational illustration of a 19th-century textile factory interior showing workers operating mechanical looms and steam-powered machinery with period-accurate clothing and equipment."

    **Examples of Poor Prompts to Avoid:**
    - "Abstract representation of photosynthesis" (too vague)
    - "Simple icon of a cell" (not an illustration)
    - "Infographic about the water cycle" (wrong image type)

    **Output:**
    Return ONLY the prompt text for an educational illustration. Do not include any conversational text or labels like "Prompt:".
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        temperature: temperature,
      },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error regenerating image prompt:", error);
    throw new Error("Failed to regenerate image prompt.");
  }
};

export const extractTextFromImage = async (base64Data: string, mimeType: string): Promise<string> => {
  const prompt = `
    Analyze this educational image and extract all visible text, including labels, captions, and annotations.
    Also describe any diagrams, charts, equations, or visual elements that convey educational information.
    Format the output as a coherent text block suitable for use as source material for creating presentation slides.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error extracting text from image:", error);
    throw new Error("Failed to process image content.");
  }
};
