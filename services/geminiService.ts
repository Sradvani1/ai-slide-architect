
import { GoogleGenAI, Type } from "@google/genai";
import type { Slide } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const slideSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A concise and engaging title for the slide."
    },
    content: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: "An array of strings, where each string is a bullet point or a short sentence for the slide content."
    },
    layout: {
      type: Type.STRING,
      description: "A suggested layout for the slide, e.g., 'Title and Content', 'Image with Caption', 'Title Only'."
    },
    imagePrompt: {
      type: Type.STRING,
      description: "A short, descriptive prompt for an AI image generator to create a relevant visual for the slide."
    },
  },
  required: ["title", "content", "layout", "imagePrompt"]
};

export const generateSlidesFromDocument = async (
  sourceText: string,
  instructions: string,
  numSlides: number
): Promise<Slide[]> => {
  const prompt = `
    Based on the following source document and instructions, generate a slide deck presentation.

    **Instructions:**
    ${instructions}

    **Number of Slides:**
    ${numSlides}

    **Source Document:**
    ---
    ${sourceText}
    ---

    Please generate exactly ${numSlides} slides. For each slide, provide a title, content as bullet points, a suggested layout, and a prompt for an image generator.
    Ensure the output is a valid JSON array of slide objects.
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: slideSchema
        },
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    const slides: Slide[] = JSON.parse(jsonText);
    return slides;

  } catch (error) {
    console.error("Error generating slides with Gemini API:", error);
    throw new Error("The AI model failed to generate a valid response.");
  }
};
