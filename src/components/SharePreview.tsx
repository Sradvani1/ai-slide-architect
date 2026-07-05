import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { SlideDeck } from './SlideDeck';
import { Auth } from './Auth';
import { Modal } from './Modal';
import { Footer } from './landing/Footer';
import { claimShareLink, fetchSharePreview } from '../services/shareService';
import { submitGalleryReport } from '../services/galleryService';
import { usePageMeta } from '../hooks/usePageMeta';
import { logAnalyticsEvent } from '../utils/analytics';
import { ANALYTICS_EVENTS } from '@shared/constants';
import type { GalleryReportReason, SharePreviewResponse } from '../types';

interface SharePreviewProps {
    user: User | null;
}

const DECK_NOT_AVAILABLE = 'This deck is not available';
const DEFAULT_OG_IMAGE = 'https://www.slidesedu.org/og-image.png';

const REPORT_REASONS: { value: GalleryReportReason; label: string }[] = [
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'copyright', label: 'Copyright concern' },
    { value: 'inaccurate', label: 'Inaccurate information' },
    { value: 'other', label: 'Other' },
];

export const SharePreview: React.FC<SharePreviewProps> = ({ user }) => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [preview, setPreview] = useState<SharePreviewResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isClaiming, setIsClaiming] = useState(false);
    const [shouldClaim, setShouldClaim] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showReportForm, setShowReportForm] = useState(false);
    const [reportReason, setReportReason] = useState<GalleryReportReason>('inappropriate');
    const [reportDetails, setReportDetails] = useState('');
    const [isReporting, setIsReporting] = useState(false);
    const [reportSuccess, setReportSuccess] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const loggedViewForToken = useRef<string | null>(null);

    const shareToken = useMemo(() => token?.trim() || '', [token]);
    const isNotAvailable = error === DECK_NOT_AVAILABLE;

    const pageTitle = preview
        ? `${preview.project.title} — Grade ${preview.project.gradeLevel} ${preview.project.subject} | SlidesEdu`
        : '';
    const pageDescription = preview
        ? `Free ${preview.project.subject} slide deck on ${preview.project.topic}. Remix and customize for your classroom.`
        : '';
    const pageCanonical = shareToken
        ? `https://www.slidesedu.org/share/${shareToken}`
        : '';
    const ogImage = preview?.thumbnailUrl ?? DEFAULT_OG_IMAGE;

    const openGraph = useMemo(() => preview ? {
        title: pageTitle,
        description: pageDescription,
        image: ogImage,
        url: pageCanonical,
    } : undefined, [preview, pageTitle, pageDescription, ogImage, pageCanonical]);

    const jsonLd = useMemo(() => preview ? {
        // keep in sync with functions/src/utils/sharePageMeta.ts buildSharePageJsonLd()
        '@context': 'https://schema.org',
        '@type': ['LearningResource', 'CreativeWork'],
        '@id': pageCanonical,
        name: preview.project.title,
        description: pageDescription,
        url: pageCanonical,
        image: ogImage,
        educationalLevel: preview.project.gradeLevel,
        about: preview.project.topic,
        inLanguage: 'en',
        isAccessibleForFree: true,
        provider: { '@type': 'Organization', name: 'SlidesEdu', url: 'https://www.slidesedu.org' },
    } : undefined, [preview, pageDescription, pageCanonical, ogImage]);

    usePageMeta({
        enabled: Boolean(preview),
        title: pageTitle,
        description: pageDescription,
        canonical: pageCanonical,
        openGraph,
        jsonLd,
    });

    useEffect(() => {
        setShowReportForm(false);
        setReportSuccess(false);
        setReportError(null);
        setReportDetails('');

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
                    if (loggedViewForToken.current !== shareToken) {
                        loggedViewForToken.current = shareToken;
                        logAnalyticsEvent(ANALYTICS_EVENTS.DECK_VIEWED, { token: shareToken });
                    }
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
            if (!result.alreadyClaimed) {
                logAnalyticsEvent(ANALYTICS_EVENTS.DECK_REMIXED, { token: shareToken });
            }
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

    const handleReportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shareToken || isReporting) return;

        setIsReporting(true);
        setReportError(null);
        try {
            await submitGalleryReport({
                token: shareToken,
                reason: reportReason,
                details: reportDetails.trim() || undefined,
            });
            setReportSuccess(true);
            setShowReportForm(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to submit report.';
            setReportError(message);
        } finally {
            setIsReporting(false);
        }
    };

    if (isNotAvailable && !isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="max-w-md text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-primary-text mb-2">This deck isn&apos;t available</h1>
                        <p className="text-secondary-text mb-6">
                            It may still be generating or no longer available.
                        </p>
                        <button
                            onClick={() => navigate('/new')}
                            className="btn-primary px-5 py-2 text-sm font-semibold"
                        >
                            Create your own deck
                        </button>
                        <Link
                            to="/explore"
                            className="mt-4 inline-block text-sm font-medium text-secondary-text hover:text-primary transition-colors"
                        >
                            Browse public decks
                        </Link>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-primary-text truncate">
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
                        <Link
                            to="/explore"
                            className="text-sm font-medium text-secondary-text hover:text-primary transition-colors px-1 py-2"
                        >
                            Browse public decks
                        </Link>
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

                {preview && !isLoading && (
                    <div className="mt-8 border-t border-subtle pt-6">
                        {reportSuccess ? (
                            <p className="text-sm text-secondary-text">
                                Thanks — we&apos;ll review this report.
                            </p>
                        ) : showReportForm ? (
                            <form onSubmit={handleReportSubmit} className="max-w-md space-y-4">
                                <h2 className="text-sm font-semibold text-primary-text">Report this deck</h2>
                                <div>
                                    <label htmlFor="report-reason" className="block text-sm text-secondary-text mb-1">
                                        Reason
                                    </label>
                                    <select
                                        id="report-reason"
                                        value={reportReason}
                                        onChange={(e) => setReportReason(e.target.value as GalleryReportReason)}
                                        className="w-full rounded-lg border border-subtle px-3 py-2 text-sm bg-white text-primary-text"
                                    >
                                        {REPORT_REASONS.map(({ value, label }) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="report-details" className="block text-sm text-secondary-text mb-1">
                                        Details (optional)
                                    </label>
                                    <textarea
                                        id="report-details"
                                        value={reportDetails}
                                        onChange={(e) => setReportDetails(e.target.value.slice(0, 500))}
                                        rows={3}
                                        maxLength={500}
                                        className="w-full rounded-lg border border-subtle px-3 py-2 text-sm bg-white text-primary-text resize-y"
                                        placeholder="Tell us more about your concern"
                                    />
                                </div>
                                {reportError && (
                                    <p className="text-sm text-red-600" role="alert">{reportError}</p>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={isReporting}
                                        className="btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
                                    >
                                        {isReporting ? 'Submitting…' : 'Submit report'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowReportForm(false);
                                            setReportError(null);
                                        }}
                                        className="text-sm text-secondary-text hover:text-primary transition-colors px-2 py-2"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowReportForm(true)}
                                className="text-sm text-secondary-text hover:text-primary transition-colors underline-offset-2 hover:underline"
                            >
                                Report this deck
                            </button>
                        )}
                    </div>
                )}
            </main>

            <Footer />

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
