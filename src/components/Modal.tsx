import React, { useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useScrollLock } from '../hooks/useScrollLock';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledby?: string;
  closeButton?: boolean;
  children: React.ReactNode;
  backdropClassName?: string;
  panelClassName?: string;
}

export function Modal({
  open,
  onClose,
  ariaLabelledby = 'auth-dialog-title',
  closeButton = true,
  children,
  backdropClassName = '',
  panelClassName = ''
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(panelRef, open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${backdropClassName}`}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClose();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Close dialog"
      data-focus-trap-exclude
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledby}
        tabIndex={-1}
        className={`relative w-full max-w-md p-4 ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {closeButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute -top-10 right-0 rounded-full p-2 text-white/90 hover:text-white hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
