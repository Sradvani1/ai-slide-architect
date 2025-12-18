
export * from '@shared/types';
export { ImageGenError } from '@shared/errors';

export interface ProjectFile {
  id: string;
  name: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  size: number;
  extractedContent?: string;
}
