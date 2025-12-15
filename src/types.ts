
export interface Slide {
  title: string;
  content: string[];
  imagePrompt: string;
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
