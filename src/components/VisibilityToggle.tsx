import React from 'react';
import type { ProjectVisibility } from '../types';

interface VisibilityToggleProps {
    value: ProjectVisibility;
    onChange: (visibility: ProjectVisibility) => void;
    disabled?: boolean;
    loading?: boolean;
    compact?: boolean;
}

export const VisibilityToggle: React.FC<VisibilityToggleProps> = ({
    value,
    onChange,
    disabled = false,
    loading = false,
    compact = false,
}) => {
    const isPublic = value !== 'private';
    const isDisabled = disabled || loading;

    const handleToggle = () => {
        if (isDisabled) return;
        onChange(isPublic ? 'private' : 'public');
    };

    return (
        <div
            className={`${compact ? 'gap-2' : 'gap-3'} flex flex-col`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className={`flex items-center ${compact ? 'justify-between gap-2' : 'justify-between'} p-3 rounded-lg border transition-colors ${isDisabled ? 'bg-neutral-bg/50 border-border-light/50 opacity-60' : 'bg-neutral-bg border-border-light hover:border-primary/20'}`}>
                <div className="flex items-center gap-2 min-w-0">
                    {isPublic ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.064.208-2.082.584-3m0 0A11.953 11.953 0 0 1 12 4.5" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-secondary-text flex-shrink-0" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                    )}
                    <div className="flex flex-col min-w-0">
                        <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} ${isDisabled ? 'text-secondary-text' : 'text-primary-text'}`}>
                            {isPublic ? 'Public' : 'Private'}
                        </span>
                        {!compact && (
                            <p className="text-secondary-text text-xs mt-0.5">
                                Public decks appear in Explore and can be remixed.
                            </p>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={isPublic}
                    aria-label={isPublic ? 'Set deck to private' : 'Set deck to public'}
                    onClick={handleToggle}
                    disabled={isDisabled}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isPublic ? 'bg-primary' : 'bg-border-light'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPublic ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                </button>
            </div>
            {compact && (
                <p className="text-secondary-text text-[11px] leading-snug px-1">
                    Public decks appear in Explore and can be remixed.
                </p>
            )}
        </div>
    );
};
