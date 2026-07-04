import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { GalleryDeckItem } from '../types';
import { PptxIcon } from './icons';

interface DeckCardProps {
    deck: GalleryDeckItem;
}

export const DeckCard: React.FC<DeckCardProps> = ({ deck }) => {
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const showThumbnail = Boolean(deck.thumbnailUrl) && !thumbnailFailed;

    return (
        <Link
            to={`/share/${deck.token}`}
            className="group block rounded-xl border border-[rgba(0,0,0,0.06)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] bg-surface hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-transform transition-shadow duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden"
        >
            <div className="aspect-video bg-neutral-bg flex items-center justify-center overflow-hidden">
                {showThumbnail ? (
                    <img
                        src={deck.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={() => setThumbnailFailed(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                        <PptxIcon className="w-10 h-10" />
                    </div>
                )}
            </div>
            <div className="p-4">
                <h3 className="font-semibold text-primary-text line-clamp-1">{deck.title}</h3>
                {deck.topic && (
                    <p className="text-sm text-secondary-text line-clamp-1 mt-0.5">{deck.topic}</p>
                )}
                <p className="text-xs text-secondary-text mt-2">{deck.ownerDisplayName}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        Grade {deck.gradeLevel}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        {deck.subject}
                    </span>
                    {deck.slideCount > 0 && (
                        <span className="text-xs text-secondary-text">
                            {deck.slideCount} {deck.slideCount === 1 ? 'slide' : 'slides'}
                        </span>
                    )}
                    {deck.viewCount > 0 && (
                        <span className="text-xs text-secondary-text">
                            {deck.viewCount} {deck.viewCount === 1 ? 'view' : 'views'}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
};
