import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { GRADE_LEVELS, SUBJECTS } from '@shared/constants';
import { Header } from './landing/Header';
import { ExploreFilters } from './ExploreFilters';
import { DeckCard } from './DeckCard';
import { Auth } from './Auth';
import { Modal } from './Modal';
import { fetchGallery } from '../services/galleryService';
import { usePageMeta } from '../hooks/usePageMeta';
import { logAnalyticsEvent } from '../utils/analytics';
import { ANALYTICS_EVENTS } from '@shared/constants';
import type { GalleryDeckItem, GallerySort } from '../types';

interface ExplorePageProps {
    user: User | null;
}

const parseSort = (value: string | null): GallerySort => {
    if (value === 'popular') return 'popular';
    return 'recent';
};

const parseGradeLevel = (value: string | null): string => {
    if (value && GRADE_LEVELS.includes(value)) return value;
    return '';
};

const parseSubject = (value: string | null): string => {
    if (value && SUBJECTS.includes(value)) return value;
    return '';
};

const getEmptyStateCopy = (gradeLevel: string, subject: string): { heading: string; subtext: string } => {
    if (gradeLevel && subject) {
        return {
            heading: `No public Grade ${gradeLevel} ${subject} decks yet.`,
            subtext: 'Try clearing filters or publish a matching deck.',
        };
    }
    if (subject) {
        return {
            heading: `No public ${subject} decks yet.`,
            subtext: `Be the first to publish a ${subject} deck.`,
        };
    }
    if (gradeLevel) {
        return {
            heading: `No public Grade ${gradeLevel} decks yet.`,
            subtext: `Be the first to publish a Grade ${gradeLevel} deck.`,
        };
    }
    return {
        heading: 'No public decks yet.',
        subtext: 'Public decks appear here automatically when teachers finish creating.',
    };
};

export const ExplorePage: React.FC<ExplorePageProps> = ({ user }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [showAuthModal, setShowAuthModal] = useState(false);

    const gradeLevel = parseGradeLevel(searchParams.get('gradeLevel'));
    const subject = parseSubject(searchParams.get('subject'));
    const sort = parseSort(searchParams.get('sort'));

    const [items, setItems] = useState<GalleryDeckItem[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fetchIdRef = useRef(0);

    usePageMeta({
        title: 'Explore Public Slide Decks | SlidesEdu',
        description: 'Browse free classroom slide decks by grade and subject. Remix and customize for your students.',
        canonical: 'https://www.slidesedu.org/explore',
    });

    useEffect(() => {
        logAnalyticsEvent(ANALYTICS_EVENTS.EXPLORE_VIEWED);
    }, []);

    useEffect(() => {
        const rawGrade = searchParams.get('gradeLevel');
        const rawSubject = searchParams.get('subject');
        const rawSort = searchParams.get('sort');

        const gradeMismatch = Boolean(rawGrade) && !GRADE_LEVELS.includes(rawGrade!);
        const subjectMismatch = Boolean(rawSubject) && !SUBJECTS.includes(rawSubject!);
        const sortMismatch = Boolean(rawSort) && rawSort !== 'recent' && rawSort !== 'popular';

        if (!gradeMismatch && !subjectMismatch && !sortMismatch) return;

        const next = new URLSearchParams(searchParams);
        if (gradeMismatch) next.delete('gradeLevel');
        if (subjectMismatch) next.delete('subject');
        if (sortMismatch) next.delete('sort');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const updateSearchParams = useCallback((updates: {
        gradeLevel?: string;
        subject?: string;
        sort?: GallerySort;
    }) => {
        const next = new URLSearchParams(searchParams);
        const nextGrade = updates.gradeLevel !== undefined ? updates.gradeLevel : gradeLevel;
        const nextSubject = updates.subject !== undefined ? updates.subject : subject;
        const nextSort = updates.sort !== undefined ? updates.sort : sort;

        if (nextGrade) next.set('gradeLevel', nextGrade);
        else next.delete('gradeLevel');

        if (nextSubject) next.set('subject', nextSubject);
        else next.delete('subject');

        if (nextSort === 'recent') next.delete('sort');
        else next.set('sort', nextSort);

        setSearchParams(next, { replace: true });
    }, [searchParams, gradeLevel, subject, sort, setSearchParams]);

    useEffect(() => {
        const fetchId = ++fetchIdRef.current;
        setCursor(null);
        setItems([]);
        setIsLoading(true);
        setError(null);

        void (async () => {
            try {
                const result = await fetchGallery({
                    gradeLevel: gradeLevel || undefined,
                    subject: subject || undefined,
                    sort,
                });

                if (fetchId !== fetchIdRef.current) return;

                setItems(result.items);
                setCursor(result.nextCursor);
                setHasMore(Boolean(result.nextCursor));
                setError(null);
            } catch (err: unknown) {
                if (fetchId !== fetchIdRef.current) return;
                const message = err instanceof Error ? err.message : 'Failed to load gallery.';
                setError(message);
                setItems([]);
                setCursor(null);
                setHasMore(false);
            } finally {
                if (fetchId !== fetchIdRef.current) return;
                setIsLoading(false);
            }
        })();
    }, [gradeLevel, subject, sort]);

    const loadMore = async () => {
        if (!cursor || isLoadingMore) return;

        const fetchId = ++fetchIdRef.current;
        const pageCursor = cursor;
        setIsLoadingMore(true);
        setError(null);

        try {
            const result = await fetchGallery({
                gradeLevel: gradeLevel || undefined,
                subject: subject || undefined,
                sort,
                cursor: pageCursor,
            });

            if (fetchId !== fetchIdRef.current) return;

            setItems(prev => [...prev, ...result.items]);
            setCursor(result.nextCursor);
            setHasMore(Boolean(result.nextCursor));
        } catch (err: unknown) {
            if (fetchId !== fetchIdRef.current) return;
            const message = err instanceof Error ? err.message : 'Failed to load gallery.';
            setError(message);
        } finally {
            if (fetchId !== fetchIdRef.current) return;
            setIsLoadingMore(false);
        }
    };

    const handleRetry = () => {
        const fetchId = ++fetchIdRef.current;
        setIsLoading(true);
        setError(null);

        void (async () => {
            try {
                const result = await fetchGallery({
                    gradeLevel: gradeLevel || undefined,
                    subject: subject || undefined,
                    sort,
                });

                if (fetchId !== fetchIdRef.current) return;

                setItems(result.items);
                setCursor(result.nextCursor);
                setHasMore(Boolean(result.nextCursor));
            } catch (err: unknown) {
                if (fetchId !== fetchIdRef.current) return;
                const message = err instanceof Error ? err.message : 'Failed to load gallery.';
                setError(message);
                setItems([]);
                setCursor(null);
                setHasMore(false);
            } finally {
                if (fetchId !== fetchIdRef.current) return;
                setIsLoading(false);
            }
        })();
    };

    const emptyCopy = getEmptyStateCopy(gradeLevel, subject);
    const isRateLimited = error === 'Too many requests';

    return (
        <div className="min-h-screen bg-background">
            <Header
                user={user}
                title="Explore"
                onSignIn={() => setShowAuthModal(true)}
            />

            <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-primary-text">Explore</h1>
                    <p className="text-secondary-text mt-2">
                        Browse free slide decks for teachers
                    </p>
                </div>

                <ExploreFilters
                    gradeLevel={gradeLevel}
                    subject={subject}
                    sort={sort}
                    onGradeLevelChange={(value) => updateSearchParams({ gradeLevel: value })}
                    onSubjectChange={(value) => updateSearchParams({ subject: value })}
                    onSortChange={(value) => updateSearchParams({ sort: value })}
                    onClearFilters={() => updateSearchParams({ gradeLevel: '', subject: '' })}
                />

                <div className="mt-8">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="rounded-xl overflow-hidden border border-[rgba(0,0,0,0.06)]">
                                    <div className="aspect-video bg-neutral-bg animate-pulse" />
                                    <div className="p-4 space-y-2">
                                        <div className="h-4 bg-neutral-bg animate-pulse rounded w-3/4" />
                                        <div className="h-3 bg-neutral-bg animate-pulse rounded w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error && items.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <h2 className="text-xl font-semibold text-primary-text mb-2">
                                {isRateLimited ? 'Too many requests — try again in a moment' : 'Something went wrong'}
                            </h2>
                            {!isRateLimited && (
                                <p className="text-secondary-text mb-6">{error}</p>
                            )}
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="btn-primary px-5 py-2 text-sm font-semibold"
                            >
                                Try again
                            </button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <h2 className="text-xl font-semibold text-primary-text mb-2">
                                {emptyCopy.heading}
                            </h2>
                            <p className="text-secondary-text mb-6">{emptyCopy.subtext}</p>
                            <Link
                                to="/"
                                className="btn-primary inline-block px-5 py-2 text-sm font-semibold"
                            >
                                Create your deck
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {items.map((deck) => (
                                    <DeckCard key={deck.token} deck={deck} />
                                ))}
                            </div>
                            {hasMore && (
                                <div className="flex flex-col items-center mt-10 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => void loadMore()}
                                        disabled={isLoadingMore}
                                        className="px-6 py-2.5 text-sm font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                    >
                                        {isLoadingMore ? 'Loading…' : 'Load more'}
                                    </button>
                                    {error && (
                                        <div className="text-center" role="alert">
                                            <p className="text-sm text-red-600">
                                                {isRateLimited ? 'Too many requests — try again in a moment' : error}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => void loadMore()}
                                                disabled={isLoadingMore}
                                                className="mt-2 text-sm font-medium text-primary hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md px-2 py-1"
                                            >
                                                Try again
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <Modal
                open={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                closeButton={false}
                ariaLabelledby="auth-dialog-title"
                panelClassName="max-w-[500px] p-0"
            >
                <Auth
                    isModal={true}
                    onClose={() => setShowAuthModal(false)}
                    continueUrl={window.location.href}
                />
            </Modal>
        </div>
    );
};
