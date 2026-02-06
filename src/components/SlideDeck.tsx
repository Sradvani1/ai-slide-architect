import React, { useEffect, useRef, useState } from 'react';
import { CopyIcon, DocumentTextIcon, DownloadIcon, ShareIcon } from './icons';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ExternalHyperlink } from 'docx';
import { SlideCard, cleanText } from './SlideCard';
import { generateImageFromPrompt } from '../services/geminiService';
import type { Slide, ProjectData } from '../types';

type GenerationPhase = NonNullable<ProjectData['generationPhase']>;

import PptxGenJS from 'pptxgenjs';

interface SlideDeckProps {
    slides: Slide[] | null;
    sources?: string[];
    researchContent?: string;
    projectTitle?: string;
    projectTopic?: string;
    projectGradeLevel?: string;
    projectSubject?: string;
    isLoading: boolean;
    error: string | null;
    onUpdateSlide: (index: number, patch: Partial<Slide>) => void;
    userId?: string;
    projectId?: string | null;
    generationProgress?: number;
    generationPhase?: ProjectData['generationPhase'];
    generationMessage?: string;
    generationStartedAtMs?: number;
    onRetry?: () => void;
    onShare?: () => void;
    shareUrl?: string | null;
    shareCopied?: boolean;
    onCopyShare?: () => void;
    shareDisabled?: boolean;
    readOnly?: boolean;
}

const WelcomeMessage: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-12 glass-panel rounded-2xl border border-slate-200/50 bg-surface/60 backdrop-blur-md max-w-2xl mx-auto mt-20 shadow-xl shadow-slate-200/50">
        <div className="w-20 h-20 mb-6 text-primary bg-primary/10 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
            </svg>
        </div>
        <h2 className="text-3xl font-bold text-primary-text mb-4 tracking-tight">Ready to Create?</h2>
        <p className="text-lg text-secondary-text max-w-lg leading-relaxed">
            Add your details to start building your slides with grounded research and speaker notes.
        </p>
    </div>
);

const Loader: React.FC<{
    progress?: number;
    message?: string;
    phase?: ProjectData['generationPhase'];
    startedAtMs?: number;
}> = ({ progress, message, phase, startedAtMs }) => {
    const phaseLabels: Partial<Record<GenerationPhase, string>> = {
        research: 'Researching content',
        drafting: 'Drafting slides',
        persisting: 'Saving slides',
        finalizing: 'Finalizing presentation',
        completed: 'Presentation ready',
        failed: 'Generation failed'
    };
    const getStatusMessage = () => {
        if (progress === undefined) return 'Preparing your presentation';
        if (phase === 'research') {
            if (progress < 10) return 'Starting your deck';
            if (progress < 50) return 'Researching your topic';
        }
        if (progress < 50) return 'Researching your topic';
        if (progress < 90) return 'Drafting slide content';
        if (progress < 100) return 'Finalizing your slide deck';
        return 'Almost done';
    };
    const statusMessage = message || (phase ? (phaseLabels[phase] || getStatusMessage()) : getStatusMessage());

    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4 animate-fade-in">
            {/* Spinner Icon */}
            <div className="mb-8">
                <svg
                    className="animate-spin h-10 w-10 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-label="Loading"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            </div>

            <h2 className="text-3xl font-bold text-primary-text mb-6 tracking-tight">
                {statusMessage}
            </h2>

            {/* Progress Bar - Clean and minimal */}
            <div className="w-full max-w-md">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full bg-primary rounded-full transition-all duration-500 ease-out ${progress === undefined ? 'animate-pulse' : ''}`}
                        style={{
                            width: progress !== undefined
                                ? `${progress}%`
                                : '33%'
                        }}
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Generation progress"
                    />
                </div>
                {progress !== undefined && (
                    <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-[0.1em]">
                        {progress}% Completed
                    </p>
                )}
            </div>
        </div>
    );
};

const normalizeLinkTarget = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    if (trimmed.startsWith('www.') || trimmed.startsWith('vertexaisearch.cloud.google.com/')) {
        return `https://${trimmed}`;
    }
    return trimmed;
};

const buildSourceParagraphs = (sources: string[]) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return sources.map((source, index) => {
        const trimmedSource = source.trim();
        if (
            trimmedSource.startsWith('www.') ||
            trimmedSource.startsWith('vertexaisearch.cloud.google.com/')
        ) {
            const paragraphChildren: (TextRun | ExternalHyperlink)[] = [];
            const prefix = `${index + 1}. `;
            paragraphChildren.push(new TextRun(prefix));
            paragraphChildren.push(new ExternalHyperlink({
                children: [
                    new TextRun({
                        text: source,
                        style: "Hyperlink",
                    }),
                ],
                link: normalizeLinkTarget(source),
            }));

            return new Paragraph({
                children: paragraphChildren,
                spacing: { after: 100 },
            });
        }

        const parts = source.split(urlRegex);
        const paragraphChildren: (TextRun | ExternalHyperlink)[] = [];
        const prefix = `${index + 1}. `;
        paragraphChildren.push(new TextRun(prefix));

        parts.forEach(part => {
            if (part.match(urlRegex)) {
                paragraphChildren.push(new ExternalHyperlink({
                    children: [
                        new TextRun({
                            text: part,
                            style: "Hyperlink",
                        }),
                    ],
                    link: normalizeLinkTarget(part),
                }));
            } else if (part) {
                paragraphChildren.push(new TextRun(part));
            }
        });

        return new Paragraph({
            children: paragraphChildren,
            spacing: { after: 100 },
        });
    });
};

const buildParagraphsFromText = (text: string) => {
    if (!text.trim()) {
        return [new Paragraph({ text: "No research content available." })];
    }

    const normalized = text.replace(/\r\n/g, '\n');
    return normalized.split('\n').map(line => new Paragraph({
        text: line.trim(),
        spacing: { after: 120 },
    }));
};

const splitSources = (sources: string[]) => {
    const webSources: string[] = [];
    const fileSources: string[] = [];

    sources.forEach(source => {
        if (source.trim().startsWith('File:')) {
            fileSources.push(source);
        } else {
            webSources.push(source);
        }
    });

    return { webSources, fileSources };
};

const buildFileSourceParagraphs = (sources: string[]) => {
    return sources.map(source => new Paragraph({
        text: source,
        spacing: { after: 80 },
    }));
};

const generateDocx = async (slides: Slide[], sources: string[] = []) => {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                ...slides.flatMap((slide, index) => {
                    const children = [
                        new Paragraph({
                            text: `Slide ${index + 1}: ${slide.title}`,
                            heading: HeadingLevel.HEADING_1,
                            spacing: {
                                before: 200,
                                after: 100,
                            },
                        }),
                    ];

                    const notes = slide.speakerNotes || "No speaker notes available.";
                    children.push(new Paragraph({
                        text: notes,
                        spacing: {
                            after: 200,
                        },
                    }));

                    children.push(new Paragraph({ text: "" })); // Spacing between slides

                    return children;
                }),

                // Sources section removed from speaker notes export
            ]
        }],
    });

    return await Packer.toBlob(doc);
};

const generateResearchReportDocx = async ({
    researchContent,
    sources = [],
    title,
    topic,
    gradeLevel,
    subject,
}: {
    researchContent: string;
    sources?: string[];
    title?: string;
    topic?: string;
    gradeLevel?: string;
    subject?: string;
}) => {
    const metadataEntries = [
        { label: 'Title', value: title },
        { label: 'Topic', value: topic },
        { label: 'Grade Level', value: gradeLevel },
        { label: 'Subject', value: subject },
    ].filter(entry => entry.value);

    const { webSources, fileSources } = splitSources(sources);

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    text: "Research Report",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 200 },
                }),
                ...(metadataEntries.length > 0 ? [
                    new Paragraph({
                        text: "Project Metadata",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 120 },
                    }),
                    ...metadataEntries.map(entry => new Paragraph({
                        text: `${entry.label}: ${entry.value}`,
                        spacing: { after: 80 },
                    })),
                ] : []),
                new Paragraph({
                    text: "Research Content",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 240, after: 120 },
                }),
                ...buildParagraphsFromText(researchContent),
                ...(webSources.length > 0 ? [
                    new Paragraph({
                        text: "Sources",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 240, after: 120 },
                    }),
                    ...buildSourceParagraphs(webSources),
                ] : []),
                ...(fileSources.length > 0 ? [
                    new Paragraph({
                        text: "Uploaded Files",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 240, after: 120 },
                    }),
                    ...buildFileSourceParagraphs(fileSources),
                ] : []),
            ],
        }],
    });

    return await Packer.toBlob(doc);
};

export const SlideDeck: React.FC<SlideDeckProps> = ({
    slides,
    sources,
    researchContent,
    projectTitle,
    projectTopic,
    projectGradeLevel,
    projectSubject,
    isLoading,
    error,
    onUpdateSlide,
    userId,
    projectId,
    generationProgress,
    generationPhase,
    generationMessage,
    generationStartedAtMs,
    onRetry,
    onShare,
    shareUrl,
    shareCopied = false,
    onCopyShare,
    shareDisabled = false,
    readOnly = false,
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [isDownloadingReport, setIsDownloadingReport] = useState(false);
    const [isDownloadingNotes, setIsDownloadingNotes] = useState(false);
    const [isShareVisible, setIsShareVisible] = useState(false);
    const [displayProgress, setDisplayProgress] = useState<number | undefined>(generationProgress);
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const PROGRESS_STEP_INTERVAL_MS = 1500;

    const getProgressCap = (
        message: string | undefined,
        phase: ProjectData['generationPhase'],
        progress: number
    ) => {
        if (phase === 'completed' || phase === 'failed') return progress;
        if (message === 'Researching your topic') return Math.max(progress, 49);
        if (message === 'Drafting slide content') return Math.max(progress, 89);
        if (message === 'Finalizing your slide deck') return Math.max(progress, 99);
        if (phase === 'research' && progress < 50) return Math.max(progress, 49);
        if (phase === 'drafting' && progress < 90) return Math.max(progress, 89);
        if (phase === 'finalizing' && progress < 100) return Math.max(progress, 99);
        return progress;
    };

    const clearProgressInterval = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    };

    useEffect(() => {
        const target = typeof generationProgress === 'number' ? generationProgress : undefined;

        if (!isLoading || target === undefined) {
            clearProgressInterval();
            setDisplayProgress(target);
            return;
        }

        setDisplayProgress(target);

        clearProgressInterval();

        const cap = getProgressCap(generationMessage, generationPhase, target);
        if (cap <= target) {
            return;
        }

        progressIntervalRef.current = setInterval(() => {
            setDisplayProgress(prev => {
                if (typeof prev !== 'number') return target;
                if (prev >= cap) {
                    clearProgressInterval();
                    return cap;
                }
                return Math.min(cap, prev + 1);
            });
        }, PROGRESS_STEP_INTERVAL_MS);

        return () => {
            clearProgressInterval();
        };
    }, [generationProgress, generationMessage, generationPhase, isLoading]);

    const handleExportPPTX = async () => {
        if (readOnly) return;
        if (!slides) return;

        setIsExporting(true);
        try {
            const pptx = new PptxGenJS();
            pptx.layout = 'LAYOUT_16x9';

            slides.forEach((slideData, index) => {
                const slide = pptx.addSlide();

                if (index === 0) {
                    // Title Slide Formatting
                    slide.addText(slideData.title || 'Untitled', {
                        x: 0.5,
                        y: 1.0,
                        w: 9,
                        h: 1.5,
                        fontSize: 44,
                        bold: true,
                        align: 'center',
                        valign: 'middle',
                    });

                    if (slideData.content && slideData.content.length > 0) {
                        const contentText = slideData.content.map(item => cleanText(item)).join('\n');
                        slide.addText(contentText, {
                            x: 0.5,
                            y: 2.8,
                            w: 9,
                            h: 2.0,
                            fontSize: 24,
                            bullet: false,
                            align: 'center',
                            valign: 'top',
                        });
                    }
                } else {
                    // Standard Slide Formatting
                    slide.addText(slideData.title || 'Untitled', {
                        x: 0.5,
                        y: 0.3,
                        w: 9,
                        h: 0.7,
                        fontSize: 32,
                        bold: true,
                        align: 'left',
                        valign: 'top',
                    });

                    if (slideData.content && slideData.content.length > 0) {
                        const contentText = slideData.content.map(item => cleanText(item)).join('\n');
                        slide.addText(contentText, {
                            x: 0.5,
                            y: 1.2,
                            w: 9,
                            h: 4.3,
                            fontSize: 18,
                            bullet: true,
                            align: 'left',
                            valign: 'top',
                        });
                    }
                }
            });

            const fileName = slides[0]?.title
                ? `${slides[0].title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50)}.pptx`
                : 'presentation.pptx';
            await pptx.writeFile({ fileName });
        } catch (err) {
            console.error("Error during PPTX file generation:", err);
            alert("An error occurred while exporting the PPTX file.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadResearchReport = async () => {
        if (readOnly) return;
        if (!researchContent || !researchContent.trim()) {
            alert("No research report content is available for this project.");
            return;
        }

        setIsDownloadingReport(true);
        try {
            const baseFileName = (projectTitle || projectTopic || 'research_report')
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase()
                .substring(0, 50);

            const docxBlob = await generateResearchReportDocx({
                researchContent,
                sources: sources || [],
                title: projectTitle,
                topic: projectTopic,
                gradeLevel: projectGradeLevel,
                subject: projectSubject,
            });
            const docxUrl = URL.createObjectURL(docxBlob);
            const docxLink = document.createElement('a');
            docxLink.href = docxUrl;
            docxLink.download = `${baseFileName}_research_report.docx`;
            document.body.appendChild(docxLink);
            docxLink.click();
            document.body.removeChild(docxLink);
            URL.revokeObjectURL(docxUrl);

        } catch (err) {
            console.error("Error downloading research report:", err);
            alert("An error occurred while generating the research report.");
        } finally {
            setIsDownloadingReport(false);
        }
    };

    const handleShareToggle = () => {
        if (!onShare) return;
        const shouldShow = !isShareVisible;
        setIsShareVisible(shouldShow);
        if (shouldShow && !shareUrl) {
            onShare();
        }
    };

    const handleDownloadNotes = async () => {
        if (readOnly) return;
        if (!slides) return;

        setIsDownloadingNotes(true);
        try {
            const baseFileName = slides[0]?.title
                ? slides[0].title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50)
                : 'speaker_notes';

            const docxBlob = await generateDocx(slides, sources || []);
            const docxUrl = URL.createObjectURL(docxBlob);
            const docxLink = document.createElement('a');
            docxLink.href = docxUrl;
            docxLink.download = `${baseFileName}_speaker_notes.docx`;
            document.body.appendChild(docxLink);
            docxLink.click();
            document.body.removeChild(docxLink);
            URL.revokeObjectURL(docxUrl);

        } catch (err) {
            console.error("Error downloading notes:", err);
            alert("An error occurred while generating the notes.");
        } finally {
            setIsDownloadingNotes(false);
        }
    };

    if (isLoading) {
        return (
            <Loader
                progress={displayProgress}
                message={generationMessage}
                phase={generationPhase}
                startedAtMs={generationStartedAtMs}
            />
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-red-500/10 text-red-100 rounded-2xl border border-red-500/20 mt-20 backdrop-blur-md">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Generation Failed</h3>
                <p className="max-w-md mb-6">{error}</p>
                {onRetry && (
                    <div className="flex gap-4">
                        <button
                            onClick={onRetry}
                            className="btn-primary px-6 py-2"
                        >
                            Retry Generation
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all font-semibold"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (!slides) {
        return <WelcomeMessage />;
    }

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pt-4 gap-4">
                <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto sm:ml-auto">
                    {onShare && (
                        <button
                            onClick={handleShareToggle}
                            disabled={readOnly || shareDisabled}
                            className="group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                bg-[#F5F5F5] border-border-light hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]"
                            title={readOnly ? "Log in to edit and download" : (shareDisabled ? "Finish generating to share" : "Share")}
                        >
                            <div className="relative z-10 flex items-center space-x-2 text-primary transition-colors">
                                <ShareIcon className="h-4 w-4" aria-hidden="true" />
                                <span className="font-semibold tracking-wide text-[13px] font-[600]">Share</span>
                            </div>
                        </button>
                    )}
                    <button
                        onClick={handleDownloadResearchReport}
                        disabled={readOnly || isDownloadingReport || isExporting || !researchContent?.trim()}
                        className={`group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed
                            ${isDownloadingReport
                                ? 'bg-white border-primary shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                                : 'bg-[#F5F5F5] border-border-light hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                            }`}
                        title={readOnly ? "Log in to edit and download" : (researchContent?.trim() ? "Download Research Report" : "Research report not available yet")}
                    >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="relative z-10 flex items-center space-x-2 text-primary transition-colors">
                            <DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                            <span className="font-semibold tracking-wide text-[13px] font-[600]">Research</span>
                        </div>
                    </button>

                    <button
                        onClick={handleDownloadNotes}
                        disabled={readOnly || isDownloadingNotes || isExporting || isDownloadingReport}
                        className={`group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed
                            ${isDownloadingNotes
                                ? 'bg-white border-primary shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                                : 'bg-[#F5F5F5] border-border-light hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                            }`}
                        title={readOnly ? "Log in to edit and download" : "Download Notes"}
                    >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="relative z-10 flex items-center space-x-2 text-primary transition-colors">
                            <CopyIcon className="h-4 w-4" aria-hidden="true" />
                            <span className="font-semibold tracking-wide text-[13px] font-[600]">Notes</span>
                        </div>
                    </button>

                    <button
                        onClick={handleExportPPTX}
                        disabled={readOnly || isExporting || isDownloadingReport}
                        className={`group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] border transition-all disabled:opacity-50 disabled:cursor-wait
                            ${isExporting
                                ? 'bg-white border-primary shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                                : 'bg-[#F5F5F5] border-border-light hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                            }`}
                        title={readOnly ? "Log in to edit and download" : "Download Slides"}
                    >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="relative z-10 flex items-center space-x-2 text-primary transition-colors">
                            <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                            <span className="font-semibold tracking-wide text-[13px] font-[600]">Slides</span>
                        </div>
                    </button>
                </div>
            </div>

            {shareUrl && isShareVisible && (
                <div className="mb-6 rounded-2xl border border-slate-200 bg-white/80 shadow-sm p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <input
                            type="text"
                            value={shareUrl}
                            readOnly
                            className="w-full md:flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            aria-label="Share link"
                        />
                        <button
                            onClick={onCopyShare}
                            disabled={!onCopyShare}
                            className="btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {shareCopied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8 pb-12">
                {slides.map((slide, index) => (
                    <SlideCard
                        key={index}
                        slide={slide}
                        slideNumber={index + 1}
                        onUpdateSlide={(patch) => onUpdateSlide(index, patch)}
                        userId={userId || ''}
                        projectId={projectId ?? null}
                        readOnly={readOnly}
                    />
                ))}
            </div>
        </div>
    );
};