import { auth } from '../firebaseConfig';
import { Slide } from '../types';
import { GeminiError, ImageGenError } from '../../shared/errors';

interface GenerateSlidesRequestBody {
  topic: string;
  gradeLevel: string;
  subject: string;
  sourceMaterial: string;
  numSlides: number;
  useWebSearch: boolean;
  bulletsPerSlide: number;
  additionalInstructions?: string;
  uploadedFileNames?: string[];
  projectId: string;
}

interface GenerateImageRequestBody {
  projectId: string;
  imagePrompt: string;
  options: {
    aspectRatio?: '16:9' | '1:1';
  };
}

interface ExtractTextRequestBody {
  projectId: string;
  imageBase64: string;
  mimeType: string;
}


interface GeneratePromptRequestBody {
  projectId: string;
  slideId: string;
  regenerate?: boolean;
}

interface SearchImagesRequestBody {
  projectId: string;
  slideId: string;
}

interface DownloadImagesZipRequestBody {
  projectId: string;
  images: Array<{ url: string; name?: string }>;
  filename?: string;
}

type GeminiRequestBody =
  | GenerateSlidesRequestBody
  | GenerateImageRequestBody
  | ExtractTextRequestBody
  | GeneratePromptRequestBody
  | SearchImagesRequestBody
  | DownloadImagesZipRequestBody;

export { GeminiError, ImageGenError };

import { functions } from '../firebaseConfig';

const getApiBaseUrl = () => {
  const projectId = functions.app.options.projectId || 'ai-slide-architect-9de88';

  // Check if we should use production API
  const useProdApi = import.meta.env.PROD || import.meta.env.VITE_USE_PROD_API === 'true';

  if (useProdApi) {
    // 2nd Gen functions have specific URLs - prioritize the environment variable if they set it
    const prodUrl = import.meta.env.VITE_PRODUCTION_API_URL || 'https://api-osqb5umzra-uc.a.run.app';
    console.log('[API] Using production API:', prodUrl);
    return prodUrl;
  }

  // For local dev with emulator
  const localUrl = import.meta.env.VITE_FUNCTIONS_URL || `http://localhost:5001/${projectId}/us-central1/api`;
  console.warn('[API] Using local emulator API:', localUrl, '(Set VITE_USE_PROD_API=true to use production)');
  return localUrl;
};

// Compute API URL dynamically on each call to ensure env vars are read correctly
const getApiBaseUrlDynamic = () => getApiBaseUrl();

const API_BASE_URL = getApiBaseUrl();

async function authenticatedRequest<T>(endpoint: string, body: GeminiRequestBody): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated to use AI features.");
  }

  const token = await user.getIdToken();

  // Get API URL dynamically to ensure we use the correct one
  const apiUrl = getApiBaseUrlDynamic();

  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  // Handle 202 Accepted (Background generation started)
  if (response.status === 202) {
    return {} as T;
  }

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
  bulletsPerSlide: number = 4,
  additionalInstructions: string = '',
  projectId: string,
  uploadedFileNames?: string[]
): Promise<{
  slides: Slide[],
  inputTokens: number,
  outputTokens: number,
  sources: string[],
  searchEntryPoint?: string,
  webSearchQueries?: string[],
  warnings: string[]
}> => {

  const result = await authenticatedRequest<{
    slides: Slide[],
    inputTokens: number,
    outputTokens: number,
    sources: string[],
    searchEntryPoint?: string,
    webSearchQueries?: string[],
    warnings: string[]
  }>('/generate-slides', {
    topic,
    gradeLevel,
    subject,
    sourceMaterial,
    numSlides,
    useWebSearch,
    additionalInstructions,
    bulletsPerSlide,
    projectId,
    uploadedFileNames
  });

  return {
    slides: result.slides || [],
    inputTokens: result.inputTokens || 0,
    outputTokens: result.outputTokens || 0,
    sources: result.sources || [],
    searchEntryPoint: result.searchEntryPoint,
    webSearchQueries: result.webSearchQueries,
    warnings: result.warnings || []
  };
};

/**
 * Generates an image based on the provided prompt using the Imagen 3 model.
 */
export const generateImageFromPrompt = async (
  projectId: string,
  imagePrompt: string,
  options: { aspectRatio?: '16:9' | '1:1' } = {}
): Promise<{ blob: Blob; renderedPrompt: string; inputTokens: number; outputTokens: number }> => {
  const result = await authenticatedRequest<{ base64Data: string; mimeType: string, renderedPrompt?: string; inputTokens: number; outputTokens: number }>('/generate-image', {
    projectId,
    imagePrompt,
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
    renderedPrompt: result.renderedPrompt || imagePrompt,
    inputTokens: result.inputTokens || 0,
    outputTokens: result.outputTokens || 0
  };
};

/**
 * Repairs a malformed generated slide object using Gemini.
 */
export const repairSlideJSON = async (
  malformedJSON: string,
  errorContext: string
): Promise<any> => {
  console.warn("repairSlideJSON called but functionality is server-internal now.");
  throw new Error("JSON repair is handled server-side.");
};

export const extractTextFromImage = async (
  projectId: string,
  imageBase64: string,
  mimeType: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> => {
  const result = await authenticatedRequest<{ text: string; inputTokens: number; outputTokens: number }>('/extract-text', {
    projectId,
    imageBase64,
    mimeType
  });
  return {
    text: result.text,
    inputTokens: result.inputTokens || 0,
    outputTokens: result.outputTokens || 0
  };
};


/**
 * Generates an image prompt for a specific slide.
 * Can be used for initial generation or regeneration.
 */
export const generatePrompt = async (
  projectId: string,
  slideId: string,
  regenerate: boolean = false
): Promise<{ success: boolean; message: string }> => {
  return authenticatedRequest<{ success: boolean; message: string }>('/generate-prompt', {
    projectId,
    slideId,
    regenerate
  });
};

export const searchImages = async (
  projectId: string,
  slideId: string
): Promise<{ searchTerms: string[]; results: Array<{ id: string; url: string }> }> => {
  return authenticatedRequest<{ searchTerms: string[]; results: Array<{ id: string; url: string }> }>('/search-images', {
    projectId,
    slideId
  });
};

export const downloadImagesZip = async (
  projectId: string,
  images: Array<{ url: string; name?: string }>,
  filename?: string
): Promise<Blob> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated to download images.");
  }
  const token = await user.getIdToken();
  const apiUrl = getApiBaseUrlDynamic();

  const response = await fetch(`${apiUrl}/download-images-zip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ projectId, images, filename })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || response.statusText);
  }

  return response.blob();
};

