import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeneratedImage } from '../types';
import { Modal } from './Modal';

interface ImageViewerModalProps {
  images: GeneratedImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

const clampIndex = (index: number, length: number) => {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
};

export function ImageViewerModal({
  images,
  initialIndex,
  open,
  onClose
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(() => clampIndex(initialIndex, images.length));
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const totalImages = images.length;
  const currentImage = images[currentIndex];

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(clampIndex(initialIndex, images.length));
  }, [open, initialIndex, images.length]);

  useEffect(() => {
    if (!open) return;
    setCurrentIndex((prev) => clampIndex(prev, images.length));
  }, [open, images.length]);

  useEffect(() => {
    if (!currentImage?.url) return;
    setIsLoading(true);
    setHasError(false);
  }, [currentImage?.url]);

  useEffect(() => {
    if (!open) return;
    const imageElement = imageRef.current;
    if (imageElement?.complete && imageElement.naturalWidth > 0) {
      setIsLoading(false);
    }
  }, [open, currentImage?.url]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => clampIndex(prev - 1, images.length));
  }, [images.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => clampIndex(prev + 1, images.length));
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, goPrev, goNext]);

  useEffect(() => {
    if (!currentImage?.url) return;
    const preload = (index: number) => {
      const image = images[index];
      if (!image?.url) return;
      const preloaded = new Image();
      preloaded.src = image.url;
    };
    preload(currentIndex - 1);
    preload(currentIndex + 1);
  }, [currentIndex, images, currentImage?.url]);

  const counterLabel = useMemo(() => {
    if (!totalImages) return '0 of 0';
    return `${currentIndex + 1} of ${totalImages}`;
  }, [currentIndex, totalImages]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabelledby="image-viewer-title"
      panelClassName="w-full max-w-6xl p-0"
    >
      <div className="relative bg-slate-900 text-white rounded-xl overflow-hidden">
        <div className="flex items-center justify-center min-h-[60vh] max-h-[80vh]">
          {currentImage ? (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              {hasError ? (
                <div className="text-sm text-white/80">Failed to load image.</div>
              ) : (
                <img
                  ref={imageRef}
                  src={currentImage.url}
                  alt={currentImage.source === 'search' ? 'Search result' : 'Generated'}
                  className="max-h-[80vh] w-full object-contain"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                />
              )}
            </>
          ) : (
            <div className="text-sm text-white/80">No image available.</div>
          )}
        </div>

        <h2 id="image-viewer-title" className="sr-only">
          Image viewer
        </h2>

        <div className="absolute inset-y-0 left-2 flex items-center">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex <= 0}
            aria-label="Previous image"
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="absolute inset-y-0 right-2 flex items-center">
          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex >= totalImages - 1}
            aria-label="Next image"
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="absolute bottom-3 right-4 text-xs text-white/80 bg-black/40 px-2 py-1 rounded">
          {counterLabel}
        </div>
      </div>
    </Modal>
  );
}
