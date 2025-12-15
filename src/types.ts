
export interface GeneratedImage {
  id: string;
  url: string;
  storagePath: string;
  createdAt: number;
}

export interface ImagePrompt {
  id: string;
  prompt: string;
  createdAt: number;
  generatedImages: GeneratedImage[];
}

export interface Slide {
  title: string;
  content: string[];
  imagePrompt: string; // Deprecated, kept for backward compatibility
  prompts?: ImagePrompt[]; // New history support
  selectedPromptId?: string; // ID of the currently selected prompt
  backgroundImage?: string; // URL for the generated image
  speakerNotes?: string;
  sources?: string[];
  layout?: string;
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
