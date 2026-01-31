import JSZip from 'jszip';
import type { GeneratedImage } from '../types';

export interface ImageDownloadFailure {
  id: string;
  url: string;
  error: string;
}

export interface ImageDownloadResult {
  successCount: number;
  failed: ImageDownloadFailure[];
}

const extensionFromMime = (mimeType: string) => {
  if (!mimeType) return 'bin';
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'bin';
};

const extensionFromUrl = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
};

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 120);
};

const loadImageAsCanvasBlob = (url: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context not available'));
          return;
        }
        context.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Unable to export image from canvas'));
            return;
          }
          resolve(blob);
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to render image'));
      }
    };

    img.onerror = () => reject(new Error('Image could not be loaded for canvas fallback'));
    img.src = url;
  });
};

export const fetchImageAsBlob = async (url: string): Promise<Blob> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    try {
      return await loadImageAsCanvasBlob(url);
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Canvas fallback failed';
      const message = error instanceof Error ? error.message : 'Unknown fetch error';
      throw new Error(`${message}. ${fallbackMessage}`);
    }
  }
};

export const downloadImagesAsZip = async (
  images: GeneratedImage[],
  filename: string
): Promise<ImageDownloadResult> => {
  const zip = new JSZip();
  const failed: ImageDownloadFailure[] = [];
  let successCount = 0;

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    try {
      const blob = await fetchImageAsBlob(image.url);
      const mimeExtension = extensionFromMime(blob.type);
      const urlExtension = extensionFromUrl(image.url);
      const extension = urlExtension || mimeExtension || 'bin';
      const baseName = sanitizeFilename(`image-${index + 1}`);
      const fileName = `${baseName}.${extension}`;
      zip.file(fileName, blob);
      successCount += 1;
    } catch (error) {
      failed.push({
        id: image.id,
        url: image.url,
        error: error instanceof Error ? error.message : 'Unknown download error'
      });
    }
  }

  if (successCount === 0) {
    throw new Error('No images could be downloaded.');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const safeName = sanitizeFilename(filename.replace(/\.zip$/i, ''));
  const finalName = `${safeName || 'images'}.zip`;

  const link = document.createElement('a');
  const url = URL.createObjectURL(zipBlob);
  link.href = url;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { successCount, failed };
};
