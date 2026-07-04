import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { SlideDeck } from './SlideDeck';
import { Auth } from './Auth';
import { Modal } from './Modal';
import { claimShareLink, fetchSharePreview } from '../services/shareService';
import type { Slide } from '../types';

interface SharePreviewProps {
    user: User | null;
}

interface SharePreviewState {
    ownerName: string;
    project: {
        title: string;
        topic: string;
        gradeLevel: string;
        subject: string;
    };
    slides: Slide[];
}

const DECK_NOT_AVAILABLE = 'This deck is not available';

export const SharePreview: React.FC<SharePreviewProps> = ({ user }) => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [preview, setPreview] = useState<SharePreviewState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isClaiming, setIsClaiming] = useState(false);
    const [shouldClaim, setShouldClaim] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    const shareToken = useMemo(() => token?.trim() || '', [token]);
    const isNotAvailable = error === DECK_NOT_AVAILABLE;

    useEffect(() => {
        let isMounted = true;
        const loadPreview = async () => {
            if (!shareToken) {
                setError('Invalid share link.');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const result = await fetchSharePreview(shareToken);
                if (isMounted) {
                    setPreview(result);
                }
            } catch (err: unknown) {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : 'Failed to load shared deck.';
                    setError(message);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadPreview();
        return () => {
            isMounted = false;
        };
    }, [shareToken]);

    useEffect(() => {
        if (!user || !shouldClaim || !shareToken) return;
        setShowAuthModal(false);
        handleClaim();
    }, [user, shouldClaim, shareToken]);

    const handleClaim = async () => {
        if (!shareToken || isClaiming) return;
        if (!user) {
            setShouldClaim(true);
            setShowAuthModal(true);
            return;
        }
        setIsClaiming(true);
        setError(null);
        try {
            const result = await claimShareLink(shareToken);
            navigate(`/project/${result.projectId}`);
            setShouldClaim(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to claim this deck.';
            setError(message);
        } finally {
            setIsClaiming(false);
        }
    };

    const handleRemix = () => {
        if (user) {
            handleClaim();
            return;
        }
        setShouldClaim(true);
        setShowAuthModal(true);
    };

    if (isNotAvailable && !isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="max-w-md text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-primary-text mb-2">This deck isn&apos;t available</h1>
                    <p className="text-secondary-text mb-6">
                        It may be private or still generating.
                    </p>
                    <button
                        onClick={() => navigate('/new')}
                        className="btn-primary px-5 py-2 text-sm font-semibold"
                    >
                        Create your own deck
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary">
                            Shared by {preview?.ownerName || 'a teacher'}
                        </p>
                        <h1 className="text-2xl font-bold text-primary-text mt-1 truncate">
                            {preview?.project.title || 'Shared Slide Deck'}
                        </h1>
                        <div className="text-xs text-secondary-text mt-2 flex flex-wrap gap-2">
                            {preview?.project.gradeLevel && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                    Grade {preview.project.gradeLevel}
                                </span>
                            )}
                            {preview?.project.subject && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                    {preview.project.subject}
                                </span>
                            )}
                            {preview?.project.topic && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                    {preview.project.topic}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <button
                            onClick={handleRemix}
                            className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={isClaiming || isLoading}
                        >
                            {isClaiming ? 'Preparing your copy…' : 'Remix this deck'}
                        </button>
                        <button
                            onClick={() => navigate('/new')}
                            className="px-5 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                        >
                            Create your own deck
                        </button>
                    </div>
                </div>
            </div>

            <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                <SlideDeck
                    slides={preview?.slides || null}
                    sources={[]}
                    researchContent=""
                    projectTitle={preview?.project.title}
                    projectTopic={preview?.project.topic}
                    projectGradeLevel={preview?.project.gradeLevel}
                    projectSubject={preview?.project.subject}
                    isLoading={isLoading}
                    error={error && !isNotAvailable ? error : null}
                    onUpdateSlide={() => undefined}
                    userId=""
                    projectId={null}
                    readOnly={true}
                />
            </main>

            <Modal
                open={showAuthModal}
                onClose={() => {
                    setShowAuthModal(false);
                    setShouldClaim(false);
                }}
                closeButton={false}
                ariaLabelledby="auth-dialog-title"
                panelClassName="max-w-[500px] p-0"
            >
                <Auth
                    isModal={true}
                    onClose={() => {
                        setShowAuthModal(false);
                        setShouldClaim(false);
                    }}
                    continueUrl={window.location.href}
                />
            </Modal>
        </div>
    );
};
