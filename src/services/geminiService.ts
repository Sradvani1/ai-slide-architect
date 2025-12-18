import { auth } from '../firebaseConfig';
import { Slide, ImageSpec } from '../types';
import { GeminiError, ImageGenError } from '../../shared/errors';
import { prepareSpecForSave, formatImageSpec } from '../utils/imageUtils';

export { GeminiError, ImageGenError };
export { prepareSpecForSave };

import { functions } from '../firebaseConfig';

const getApiBaseUrl = () => {
  // For production, use actual function URL
  if (import.meta.env.PROD) {
    // Firebase Functions client SDK doesn't always expose region directly on the instance
    const projectId = functions.app.options.projectId;
    const region = import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1';
    return `https://${region}-${projectId}.cloudfunctions.net/api`;
  }
  // For local dev with emulator
  return import.meta.env.VITE_FUNCTIONS_URL || 'http://localhost:5001/ai-slide-architect/us-central1/api';
};

const API_BASE_URL = getApiBaseUrl();

async function authenticatedRequest<T>(endpoint: string, body: any): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated to use AI features.");
  }

  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || response.statusText;

    // Map status codes to specific errors if needed
    if (response.status === 429) {
      throw new GeminiError("Rate limit exceeded", 'RATE_LIMIT', true);
    }

    if (endpoint === '/generate-image') {
      throw new ImageGenError(message, 'UNKNOWN', false);
    }

    throw new GeminiError(message, 'API_ERROR', response.status >= 500);
  }

  return response.json();
}

/**
 * Generates slides based on the provided topic and options.
 */
export const generateSlidesFromDocument = async (
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string,
  numSlides: number,
  useWebSearch: boolean = false,
  temperature: number = 0.7,
  bulletsPerSlide: number = 4,
  additionalInstructions: string = '',
  uploadedFileNames?: string[]
): Promise<{
  slides: Slide[],
  inputTokens: number,
  outputTokens: number,
  sources: Array<{ uri: string; title?: string }>,
  searchEntryPoint?: string,
  webSearchQueries?: string[],
  warnings: string[]
}> => {

  const result = await authenticatedRequest<any>('/generate-slides', {
    topic,
    gradeLevel,
    subject,
    sourceMaterial,
    numSlides,
    useWebSearch,
    additionalInstructions,
    temperature,
    bulletsPerSlide,
    uploadedFileNames
  });

  // Transform result to match client expectations if needed (e.g. sources format)
  // Server returns { slides, inputTokens, outputTokens, searchEntryPoint, webSearchQueries }

  return {
    slides: result.slides,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    sources: result.sources || [],
    searchEntryPoint: result.searchEntryPoint,
    webSearchQueries: result.webSearchQueries,
    warnings: result.warnings || []
  };
};

/**
 * Generates an image based on the provided prompt using the Imagen 3 model.
 */
export const generateImageFromSpec = async (
  spec: ImageSpec,
  gradeLevel: string,
  subject: string,
  options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ blob: Blob; renderedPrompt: string }> => {
  // Format spec to prompt on client to return it, BUT send spec to server as requested?
  // User requested: "Update server endpoint to accept spec instead of prompt"
  // And "In geminiService.ts - restore original signature... // Format spec to prompt on client OR send spec to server"
  // I will format on client to return it in the object, but send spec to server.
  const renderedPrompt = formatImageSpec(spec, { gradeLevel, subject });

  const result = await authenticatedRequest<{ base64Data: string; mimeType: string, renderedPrompt?: string }>('/generate-image', {
    spec,
    gradeLevel,
    subject,
    options
  });

  // Convert base64 to blob
  const binaryString = atob(result.base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    blob: new Blob([bytes], { type: result.mimeType }),
    renderedPrompt: result.renderedPrompt || renderedPrompt
  };
};

/**
 * Repairs a malformed generated slide object using Gemini.
 * (Not strictly implemented in V1 server yet, but client might call it?)
 * TODO: Implement on server if needed. For now, throw or mock.
 */
export const repairSlideJSON = async (
  malformedJSON: string,
  errorContext: string
): Promise<any> => {
  // Placeholder: Server doesn't have a specific repair endpoint exposed yet.
  // The server does repair internally during generate-slides.
  // If client has malformed JSON, it's usually from local state issues or older code.
  console.warn("repairSlideJSON called but functionality is server-internal now.");
  throw new Error("JSON repair is handled server-side.");
};

export const extractTextFromImage = async (
  imageBase64: string,
  mimeType: string
): Promise<string> => {
  const result = await authenticatedRequest<{ text: string }>('/extract-text', {
    imageBase64,
    mimeType
  });
  return result.text;
};
