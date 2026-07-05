import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DeckCard } from '../DeckCard';
import { fetchGallery } from '../../services/galleryService';
import type { GalleryDeckItem } from '../../types';

interface FeaturedDecksProps {
    onCreateDeck: () => void;
}

export const FeaturedDecks: React.FC<FeaturedDecksProps> = ({ onCreateDeck }) => {
    const [items, setItems] = useState<GalleryDeckItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDecks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchGallery({ limit: 6, sort: 'recent' });
            setItems(result.items);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load featured decks.';
            setError(message);
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDecks();
    }, [loadDecks]);

    return (
        <section className="w-full max-w-6xl mx-auto px-4 py-10 md:py-16">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-primary-text">
                        Featured public decks
                    </h2>
                    <p className="text-secondary-text mt-2">
                        Recently shared by teachers — browse, preview, and remix.
                    </p>
                </div>
                <Link
                    to="/explore"
                    className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                >
                    View all decks →
                </Link>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-xl overflow-hidden border border-[rgba(0,0,0,0.06)]">
                            <div className="aspect-video bg-neutral-bg animate-pulse" />
                            <div className="p-4 space-y-2">
                                <div className="h-4 bg-neutral-bg animate-pulse rounded w-3/4" />
                                <div className="h-3 bg-neutral-bg animate-pulse rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="text-center py-12 px-4 rounded-xl border border-[rgba(0,0,0,0.06)] bg-neutral-bg/30">
                    <p className="text-primary-text font-semibold mb-2">Couldn&apos;t load featured decks</p>
                    <p className="text-secondary-text text-sm mb-4">{error}</p>
                    <button
                        type="button"
                        onClick={() => void loadDecks()}
                        className="btn-primary px-5 py-2 text-sm font-semibold"
                    >
                        Try again
                    </button>
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-[rgba(0,0,0,0.06)] bg-neutral-bg/30">
                    <h3 className="text-xl font-semibold text-primary-text mb-2">No public decks yet.</h3>
                    <p className="text-secondary-text mb-6">
                        Public decks appear here automatically when teachers finish creating.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={onCreateDeck}
                            className="btn-primary px-5 py-2 text-sm font-semibold min-h-[44px]"
                        >
                            Create your deck
                        </button>
                        <Link
                            to="/explore"
                            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors min-h-[44px] inline-flex items-center"
                        >
                            Browse Explore →
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((deck) => (
                        <DeckCard key={deck.token} deck={deck} />
                    ))}
                </div>
            )}
        </section>
    );
};
