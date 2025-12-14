
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
    - **Image Prompt:** Create a prompt for an educational illustration that visually represents the overall topic in an engaging, grade level appropriate style.
    - **Speaker Notes:** Brief introductory remarks welcoming the class and introducing the topic.

    **SLIDES 2 to ${totalSlides}:**
    - Generate content slides covering the topic in a logical sequence.
    - For each slide, provide a title, content as EXACTLY ${bulletsPerSlide} bullet points per slide, a prompt for an image generator, and detailed speaker notes.
    - **IMPORTANT:** Do NOT use markdown formatting (like **bold** or *italic*) in the bullet points. Use plain text only.
    - **IMPORTANT:** Do NOT use nested bullet points or sub-bullets. Each content item must be a single, standalone statement.
    
    **REQUIREMENTS FOR IMAGE PROMPTS:**
    For each slide, generate a clear, descriptive imagePrompt for an EDUCATIONAL ILLUSTRATION to explain the concept. Focus on the objects, actions, or diagrams that should be visible, ensuring the visual complexity is appropriate for ${gradeLevel} students. If a diagram is needed, explicitly specify "labeled diagram" and list key labels. Do NOT include style instructions in the prompt.
    
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
    Generate a clear, descriptive imagePrompt for an EDUCATIONAL ILLUSTRATION to explain the concept of the following presentation slide. Focus on the objects, actions, or diagrams that should be visible, ensuring the visual complexity is appropriate for ${gradeLevel} students. If a diagram is needed, explicitly specify "labeled diagram" and list key labels. Do NOT include style instructions in the prompt.
    
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
