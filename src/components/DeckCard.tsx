import React from 'react';
import { Link } from 'react-router-dom';
import type { GalleryDeckItem } from '../types';

interface DeckCardProps {
    deck: GalleryDeckItem;
}

export const DeckCard: React.FC<DeckCardProps> = ({ deck }) => {
    return (
        <Link
            to={`/share/${deck.token}`}
            className="group block rounded-xl border border-[rgba(0,0,0,0.06)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] bg-surface hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-transform transition-shadow duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden"
        >
            <div className="p-4">
                <h3 className="font-semibold text-primary-text line-clamp-1">{deck.title}</h3>
                {deck.topic && (
                    <p className="text-sm text-secondary-text line-clamp-1 mt-0.5">{deck.topic}</p>
                )}
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
                    {deck.remixCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-200/80">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                            </svg>
                            {deck.remixCount} {deck.remixCount === 1 ? 'remix' : 'remixes'}
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
