
import { GoogleGenAI } from "@google/genai";
import type { Slide } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });


const IMAGE_STYLE_GUIDE = `
**Visual Style Guidelines:**
- **Art Style:** Flat vector-style educational illustration. Professional, clean lines. No photorealism, 3D renders, or cartoons.
- **Background:** Clean, solid, or white background. No scenic backgrounds or visual clutter.
- **Color & Contrast:** High contrast, distinct colors optimized for classroom projection.
- **Typography:** Use LARGE, BOLD, Sans-Serif fonts for all text. Ensure maximum readability from a distance.
- **Labeling:** Connect labels with clear, straight lines. No floating text.
`;

export const generateSlidesFromDocument = async (
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string,
  numSlides: number,
  useWebSearch: boolean = false,
  temperature: number = 0.7,
  bulletsPerSlide: number = 4,
  additionalInstructions: string = ''
): Promise<Slide[]> => {
  const totalSlides = numSlides + 1;

  // 1. SYSTEM ROLE & OBJECTIVE
  let prompt = `
    You are an expert educational content creator and curriculum designer.
    Your goal is to generate a professional, engaging slide deck that is perfectly tailored to the specified grade level.
  `;

  // 2. INPUT CONTEXT
  prompt += `
    **Presentation Context:**
    - Topic: "${topic}"
    - Target Audience: ${gradeLevel}
    - Subject: ${subject}
    - Target Length: exactly ${totalSlides} slides (1 Title + ${numSlides} Content)
  `;

  if (additionalInstructions) {
    prompt += `
    - User Instructions: "${additionalInstructions}"
    `;
  }

  // 3. SOURCE MATERIAL / RESEARCH (Mutually Exclusive Logic)
  if (sourceMaterial) { // Curator Mode
    prompt += `
    **Source Material (GROUND TRUTH):**
    You must derive your content PRIMARILY from the following text. Do not contradict it.
    
    SOURCE BEGIN:
    ${sourceMaterial}
    SOURCE END
    `;
  } else if (useWebSearch) { // Researcher Mode
    prompt += `
    **Research Phase (REQUIRED):**
    Since no source material is provided, you MUST use Google Search to act as the **primary content researcher**.
    
    **Instructions:**
    1.  **Find Content:** Search for high-quality, age-appropriate information to build the core content of these slides.
    2.  **Curate Sources:** Select the best, most reliable references (URLs) that a teacher would value.
    3.  **Synthesize:** Use these search results as the SOLE source of truth for the presentation.
    `;
  }

  // 4. CONTENT GENERATION STANDARDS
  prompt += `
    **Content Standards:**
    1. **Educational Value:** Content must be accurate, age-appropriate, and pedagogically sound.
    2. **Clarity:** Use clear, concise language. Avoid jargon unless defined.
    3. **Engagement:** Speaker notes should be engaging and conversational (script format).
  `;

  // 5. STRUCTURE REQUIREMENTS
  prompt += `
    **Structure Requirements:**
    - Slide 1: Title Slide (Topic, Tagline, Student Metadata).
    - Slides 2-${totalSlides}: Content Slides (Title, Content, Image Prompt, Speaker Notes).
  `;

  // 6. FORMATTING CONTRAINTS (CRITICAL)
  prompt += `
    **Formatting Constraints (CRITICAL):**
    - **Bullets:** Exactly ${bulletsPerSlide} bullet points per content slide.
    - **No Markdown:** Bullet points must be plain strings. NO bold (**), italics (*), or bullet characters (-) in the string itself.
    - **Image Prompts:** Visual descriptions ONLY. No "Prompt:" prefix. Focus on the subject matter (e.g., "A cross-section of a plant cell"). Do NOT include style instructions.
  `;

  // 7. OUTPUT SCHEMA
  prompt += `
    **Output Format:**
    Return a valid JSON array of objects satisfying this structure:
    [
      {
        "title": "string",
        "content": ["string", "string", ...], // Exactly ${bulletsPerSlide} items
        "layout": "Title Slide" | "Content",
        "imagePrompt": "string",
        "speakerNotes": "string (Start with script. End with a 'Sources:' section listing URLs if Web Search was used)"
      }
    ]
  `;

  try {
    const tools: any[] = [];
    if (useWebSearch && !sourceMaterial) {
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

    // Clean up markdown formatting if present
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

export const generateImage = async (prompt: string, gradeLevel: string, temperature: number = 0.3): Promise<Blob> => {
  try {
    // Inject centralized style guidelines into the prompt
    const enhancedPrompt = `
    **Image Subject:**
    ${prompt}

    **Target Audience:**
    ${gradeLevel} Grade Students

    ${IMAGE_STYLE_GUIDE}`;

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
    Generate a clear, descriptive imagePrompt for an EDUCATIONAL ILLUSTRATION to explain the concept of the following presentation slide. Focus ONLY on the visible objects, actions, and diagrams. Ensuring the visual complexity is appropriate for ${gradeLevel} students. If a diagram is needed, explicitly specify "labeled diagram" and list key labels. DO NOT include any style, artistic, or rendering instructions (e.g., "detailed", "photorealistic", "illustration style").
    
    **Slide Context:**
    - Title: "${slideTitle}"
    - Content: ${slideContent.join('; ')}
    - Grade Level: "${gradeLevel}"
    - Subject: "${subject}"

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
