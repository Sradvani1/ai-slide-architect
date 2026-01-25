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
            } catch (err: any) {
                if (isMounted) {
                    const message = err?.message || 'Failed to load shared deck.';
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
        } catch (err: any) {
            const message = err?.message || 'Failed to claim this deck.';
            setError(message);
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
                            {isClaiming ? 'Preparing your copy…' : ctaLabel}
                        </button>
                        <p className="text-xs text-secondary-text">{helperText}</p>
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
                    error={error}
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
