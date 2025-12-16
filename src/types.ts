
export interface GeneratedImage {
  id: string;
  url: string;
  storagePath: string;
  createdAt: number;
  aspectRatio?: '16:9' | '1:1';
}

export interface ImagePrompt {
  id: string;
  prompt: string;
  createdAt: number;
  generatedImages: GeneratedImage[];
  spec?: ImageSpec; // Store the spec that generated this prompt
}

export type ImageTextPolicy = 'NO_LABELS' | 'LIMITED_LABELS_1_TO_3';

export type ImageLayout =
  | 'single-focal-subject-centered'
  | 'balanced-pair'
  | 'simple-sequence-2-panel';

export type Viewpoint =
  | 'front'
  | 'three-quarter'
  | 'side'
  | 'overhead'
  | 'child-eye-level';

export type Whitespace = 'generous' | 'moderate';

export interface ImageSpec {
  // WHAT: semantic content
  primaryFocal: string;       // Single main visible concept/action
  subjects: string[];         // 2–5 concrete objects
  actions?: string[];         // 0–3 verbs
  mustInclude: string[];      // 2–6 critical visible elements
  avoid: string[];            // clutter/confusers

  // HOW: composition & layout
  composition: {
    layout: ImageLayout;
    viewpoint: Viewpoint;
    whitespace: Whitespace;
  };

  // TEXT in the image
  textPolicy: ImageTextPolicy;
  allowedLabels?: string[];     // 0–3 labels if LIMITED_LABELS_1_TO_3

  // Palette
  colors?: string[];            // 0–5 main colors

  // Additional negative constraints
  negativePrompt?: string[];    // 0–10 extra failure modes to avoid
}

export class ImageGenError extends Error {
  constructor(
    message: string,
    public code: 'NO_IMAGE_DATA' | 'INVALID_MIME_TYPE' | 'NETWORK' | 'TIMEOUT' | 'UNKNOWN',
    public isRetryable: boolean,
    public context?: any
  ) {
    super(message);
    this.name = 'ImageGenError';
  }
}

export interface Slide {
  title: string;
  content: string[];
  imagePrompt?: string; // Deprecated, kept for backward compatibility (optional now)
  imageSpec?: ImageSpec; // Structured image specification (Source of Truth)
  renderedImagePrompt?: string; // Deterministic prompt derived from spec (for display/API)
  renderedImagePromptHash?: string; // SHA-256 hash of the rendered prompt for change detection
  prompts?: ImagePrompt[]; // New history support
  selectedPromptId?: string; // ID of the currently selected prompt
  backgroundImage?: string; // URL for the generated image
  speakerNotes: string; // Required, defaults to empty string if missing
  sources?: string[];
  layout?: 'Title Slide' | 'Content' | string; // Narrowed, but keeping string for safety against hallucinations
}

export interface ProjectFile {
  id: string;
  name: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  size: number;
  extractedContent?: string;
}
