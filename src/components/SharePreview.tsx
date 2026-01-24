import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { SlideDeck } from './SlideDeck';
import { Auth } from './Auth';
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

export const SharePreview: React.FC<SharePreviewProps> = ({ user }) => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [preview, setPreview] = useState<SharePreviewState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpired, setIsExpired] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [shouldClaim, setShouldClaim] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    const shareToken = useMemo(() => token?.trim() || '', [token]);

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
            setIsExpired(false);

            try {
                const result = await fetchSharePreview(shareToken);
                if (isMounted) {
                    setPreview(result);
                }
            } catch (err: any) {
                if (isMounted) {
                    const message = err?.message || 'Failed to load shared deck.';
                    setError(message);
                    setIsExpired(message.toLowerCase().includes('expired'));
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
        if (isExpired) {
            setError('This share link has expired. Ask the sender to create a new link.');
            return;
        }

        setIsClaiming(true);
        setError(null);
        try {
            const result = await claimShareLink(shareToken);
            navigate(`/project/${result.projectId}`);
            setShouldClaim(false);
        } catch (err: any) {
            const message = err?.message || 'Failed to claim this deck.';
            setError(message);
            setIsExpired(message.toLowerCase().includes('expired'));
        } finally {
            setIsClaiming(false);
        }
    };

    const handleCta = () => {
        if (user) {
            handleClaim();
            return;
        }
        setShouldClaim(true);
        setShowAuthModal(true);
    };

    const ctaLabel = user ? 'Create your copy' : 'Log in to edit and download';
    const helperText = user ? 'Create your own copy in seconds' : 'Create your own copy in seconds';

    return (
        <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary">
                            Preview — shared by {preview?.ownerName || 'a teacher'}
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
                    <div className="flex flex-col items-start lg:items-end gap-2">
                        <button
                            onClick={handleCta}
                            className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={isClaiming}
                        >
                            {isClaiming ? 'Preparing your copy...' : ctaLabel}
                        </button>
                        <p className="text-xs text-secondary-text">{helperText}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                {isExpired ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 bg-amber-50/80 text-amber-900 rounded-2xl border border-amber-200">
                        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.59c.75 1.334-.213 2.99-1.742 2.99H3.48c-1.53 0-2.492-1.656-1.743-2.99L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-2">This share link has expired</h2>
                        <p className="text-sm text-amber-800 mb-4">
                            Ask the sender to create a new share link.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="btn-primary px-4 py-2 text-sm"
                        >
                            Back to home
                        </button>
                    </div>
                ) : (
                    <SlideDeck
                        slides={preview?.slides || null}
                        sources={[]}
                        researchContent=""
                        projectTitle={preview?.project.title}
                        projectTopic={preview?.project.topic}
                        projectGradeLevel={preview?.project.gradeLevel}
                        projectSubject={preview?.project.subject}
                        isLoading={isLoading}
                        error={error}
                        onUpdateSlide={() => undefined}
                        userId=""
                        projectId={null}
                        readOnly={true}
                    />
                )}
            </div>

            {showAuthModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => {
                        setShowAuthModal(false);
                        setShouldClaim(false);
                    }}
                >
                    <div
                        className="relative max-w-[500px] w-full"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <Auth
                            isModal={true}
                            onClose={() => {
                                setShowAuthModal(false);
                                setShouldClaim(false);
                            }}
                            continueUrl={window.location.href}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
