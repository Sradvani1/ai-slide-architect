import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ExternalHyperlink } from 'docx';
import { SlideCard, cleanText } from './SlideCard';
import { PptxIcon, ImageIcon, DocumentTextIcon } from './icons';
import { generateImage } from '../services/geminiService';
import type { Slide } from '../types';

type PptxGenJsConstructor = typeof import('pptxgenjs') extends { default: infer DefaultExport }
    ? DefaultExport
    : never;

interface SlideDeckProps {
    slides: Slide[] | null;
    isLoading: boolean;
    error: string | null;
    onUpdateSlide: (index: number, updatedSlide: Slide) => void;
    gradeLevel: string;
    subject: string;
    creativityLevel: number;
    userId: string;
    projectId: string | null;
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

const Loader: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center mt-20">
        <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-4 border-4 border-accent rounded-full border-b-transparent animate-spin-reverse opacity-70"></div>
        </div>
        <p className="text-2xl font-bold text-primary-text mb-2">Architecting Presentation...</p>
        <p className="text-secondary-text animate-pulse">Analyzing content & designing slides</p>
    </div>
);

const generateDocx = async (slides: Slide[]) => {
    const doc = new Document({
        sections: [{
            properties: {},
            children: slides.flatMap((slide, index) => {
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
                const sourcesIndex = notes.indexOf("Sources:");

                let mainNotes = notes;
                let sourcesSection = "";

                if (sourcesIndex !== -1) {
                    mainNotes = notes.substring(0, sourcesIndex).trim();
                    sourcesSection = notes.substring(sourcesIndex).trim();
                }

                children.push(new Paragraph({
                    text: mainNotes,
                    spacing: {
                        after: 200,
                    },
                }));

                if (sourcesSection) {
                    // Add spacing before sources
                    children.push(new Paragraph({ text: "" }));

                    // Add Sources Header
                    children.push(new Paragraph({
                        text: "Sources",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { after: 100 }
                    }));

                    // Add spacing after header
                    children.push(new Paragraph({ text: "" }));

                    // Parse sources
                    const sourceContent = sourcesSection.replace(/^Sources:?\s*/i, "");
                    const sourceLines = sourceContent.split('\n').map(s => s.trim()).filter(s => s);

                    sourceLines.forEach(line => {
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const parts = line.split(urlRegex);
                        const paragraphChildren = [];

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

                        children.push(new Paragraph({
                            children: paragraphChildren,
                            spacing: { after: 100 }
                        }));
                    });
                }

                children.push(new Paragraph({ text: "" })); // Spacing between slides
                return children;
            }),
        }],
    });

    return await Packer.toBlob(doc);
};

export const SlideDeck: React.FC<SlideDeckProps> = ({ slides, isLoading, error, onUpdateSlide, gradeLevel, subject, creativityLevel, userId, projectId }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [isDownloadingImages, setIsDownloadingImages] = useState(false);
    const [isDownloadingNotes, setIsDownloadingNotes] = useState(false);
    const [PptxGenJS, setPptxGenJS] = useState<PptxGenJsConstructor | null>(null);

    useEffect(() => {
        let isCancelled = false;

        import('pptxgenjs')
            .then((module) => {
                if (!isCancelled) {
                    const Constructor = (module as { default: PptxGenJsConstructor }).default;
                    setPptxGenJS(() => Constructor);
                }
            })
            .catch((err) => {
                console.error('Failed to load pptxgenjs library', err);
            });

        return () => {
            isCancelled = true;
        };
    }, []);

    const handleExportPPTX = async () => {
        if (!slides || !PptxGenJS) return;

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

    const handleDownloadAllImages = async () => {
        if (!slides) return;

        setIsDownloadingImages(true);
        try {
            const zip = new JSZip();
            const folder = zip.folder("slide-images");

            if (!folder) {
                throw new Error("Failed to create zip folder");
            }

            // Generate images sequentially to avoid hitting rate limits too hard
            // Parallel could be faster but riskier with API limits
            for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];
                try {
                    const blob = await generateImage(slide.imagePrompt, creativityLevel);
                    const sanitizedTitle = slide.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
                    const filename = `slide-${i + 1}-${sanitizedTitle}.png`;
                    folder.file(filename, blob);
                } catch (err) {
                    console.error(`Failed to generate image for slide ${i + 1}`, err);
                    // Continue with other slides even if one fails
                    folder.file(`slide-${i + 1}-error.txt`, `Failed to generate image for prompt: ${slide.imagePrompt}`);
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = "presentation-images.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error("Error downloading all images:", err);
            alert("An error occurred while generating the images zip file.");
        } finally {
            setIsDownloadingImages(false);
        }
    };

    const handleDownloadNotes = async () => {
        if (!slides) return;

        setIsDownloadingNotes(true);
        try {
            const baseFileName = slides[0]?.title
                ? slides[0].title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50)
                : 'speaker_notes';

            // Generate DOCX
            const docxBlob = await generateDocx(slides);
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
        return <Loader />;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 mt-20">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Generation Failed</h3>
                <p className="max-w-md">{error}</p>
            </div>
        );
    }

    if (!slides) {
        return <WelcomeMessage />;
    }

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="flex justify-end items-center mb-6 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleDownloadAllImages}
                        disabled={isDownloadingImages || isExporting}
                        className={`group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed
                            ${isDownloadingImages
                                ? 'bg-white border-primary shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                                : 'bg-[#F5F5F5] border-border-light hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]'
                            }`}
                        title="Download Images"
                    >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute inset-0 border border-transparent rounded-lg group-hover:border-primary/20 transition-colors duration-300"></div>

                        <div className="relative z-10 flex items-center space-x-2 text-secondary-text group-hover:text-primary transition-colors">
                            {isDownloadingImages ? (
                                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <ImageIcon className="w-5 h-5 text-secondary-text group-hover:text-primary group-hover:scale-110 transition-all duration-300" />
                            )}
                            <span className="font-semibold tracking-wide text-[13px] font-[600]">Images</span>
                        </div>
                    </button>

                    <button
                        onClick={handleDownloadNotes}
                        disabled={isDownloadingNotes || isExporting || isDownloadingImages}
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
                        disabled={isExporting || !PptxGenJS || isDownloadingImages}
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
                        onUpdateSlide={(updatedSlide) => onUpdateSlide(index, updatedSlide)}
                        gradeLevel={gradeLevel}
                        subject={subject}
                        creativityLevel={creativityLevel}
                        userId={userId}
                        projectId={projectId}
                    />
                ))}
            </div>
        </div>
    );
};