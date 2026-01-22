import React, { useState } from 'react';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ExternalHyperlink } from 'docx';
import { SlideCard, cleanText } from './SlideCard';
import { PptxIcon, DocumentTextIcon } from './icons';
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
    userId: string;
    projectId: string | null;
    generationProgress?: number;
    generationPhase?: ProjectData['generationPhase'];
    generationMessage?: string;
    onRetry?: () => void;
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
            Fill in the details on the left, upload your source materials, and let our AI architect the perfect slide deck for you.
        </p>
    </div>
);

const Loader: React.FC<{
    progress?: number;
    message?: string;
    phase?: ProjectData['generationPhase'];
}> = ({ progress, message, phase }) => {
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
        if (progress < 25) return 'Researching content';
        if (progress < 75) return 'Writing slides';
        if (progress < 100) return 'Finalizing presentation';
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

const buildSourceParagraphs = (sources: string[]) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return sources.map(source => {
        const parts = source.split(urlRegex);
        const paragraphChildren: (TextRun | ExternalHyperlink)[] = [];

        parts.forEach(part => {
            if (part.match(urlRegex)) {
                paragraphChildren.push(new ExternalHyperlink({
                    children: [
                        new TextRun({
                            text: part,
                            style: "Hyperlink",
                        }),
                    ],
                    link: part,
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

                // Sources section at the end (if sources exist)
                ...(sources && sources.length > 0 ? [
                    new Paragraph({
                        text: "Sources",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                    }),
                    ...buildSourceParagraphs(sources),
                ] : []),
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
                ...(sources && sources.length > 0 ? [
                    new Paragraph({
                        text: "Sources",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 240, after: 120 },
                    }),
                    ...buildSourceParagraphs(sources),
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
    onRetry,
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [isDownloadingReport, setIsDownloadingReport] = useState(false);
    const [isDownloadingNotes, setIsDownloadingNotes] = useState(false);

    const handleExportPPTX = async () => {
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

    const handleDownloadNotes = async () => {
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
                progress={generationProgress}
                message={generationMessage}
                phase={generationPhase}
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
                <h2 className="text-xl font-bold text-primary-text hidden sm:block">Your Slide Deck</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleDownloadResearchReport}
                        disabled={isDownloadingReport || isExporting || !researchContent?.trim()}
                        className={`group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed
                            ${isDownloadingReport
                                ? 'bg-white border-primary shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                                : 'bg-[#F5F5F5] border-border-light hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                            }`}
                        title={researchContent?.trim() ? "Download Research Report" : "Research report not available yet"}
                    >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute inset-0 border border-transparent rounded-lg group-hover:border-primary/20 transition-colors duration-300"></div>

                        <div className="relative z-10 flex items-center space-x-2 text-secondary-text group-hover:text-primary transition-colors">
                            {isDownloadingReport ? (
                                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <DocumentTextIcon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform duration-300" />
                            )}
                            <span className="font-semibold tracking-wide text-[13px] font-[600]">Research Report</span>
                        </div>
                    </button>

                    <button
                        onClick={handleDownloadNotes}
                        disabled={isDownloadingNotes || isExporting || isDownloadingReport}
                        className={`group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed
                            ${isDownloadingNotes
                                ? 'bg-white border-primary shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                                : 'bg-[#F5F5F5] border-border-light hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                            }`}
                        title="Download Notes"
                    >
                        <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute inset-0 border border-transparent rounded-lg group-hover:border-secondary/20 transition-colors duration-300"></div>

                        <div className="relative z-10 flex items-center space-x-2 text-secondary-text group-hover:text-secondary transition-colors">
                            {isDownloadingNotes ? (
                                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <DocumentTextIcon className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform duration-300" />
                            )}
                            <span className="font-semibold tracking-wide text-[13px] font-[600]">Notes</span>
                        </div>
                    </button>

                    <button
                        onClick={handleExportPPTX}
                        disabled={isExporting || isDownloadingReport}
                        className={`group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] border transition-all disabled:opacity-50 disabled:cursor-wait
                            ${isExporting
                                ? 'bg-white border-primary shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                                : 'bg-[#F5F5F5] border-border-light hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                            }`}
                        title="Download Slides"
                    >
                        <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute inset-0 border border-transparent rounded-lg group-hover:border-accent/20 transition-colors duration-300"></div>

                        <div className="relative z-10 flex items-center space-x-2 text-secondary-text group-hover:text-accent transition-colors">
                            {isExporting ? (
                                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <PptxIcon className="w-5 h-5 text-accent group-hover:scale-110 transition-transform duration-300" />
                            )}
                            <span className="font-semibold tracking-wide text-[13px] font-[600]">Slides</span>
                        </div>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 pb-12">
                {slides.map((slide, index) => (
                    <SlideCard
                        key={index}
                        slide={slide}
                        slideNumber={index + 1}
                        onUpdateSlide={(patch) => onUpdateSlide(index, patch)}
                        userId={userId}
                        projectId={projectId}
                    />
                ))}
            </div>
        </div>
    );
};