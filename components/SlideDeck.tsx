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
}

const WelcomeMessage: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-700">
        <div className="w-16 h-16 mb-4 text-sky-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
            </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Ready to Create Your Presentation?</h2>
        <p className="mt-2 text-slate-400 max-w-md">
            Add your source material and instructions, then click "Create Presentation" to generate a ready-to-use slide deck for your classroom.
        </p>
    </div>
);

const Loader: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <svg className="animate-spin h-12 w-12 text-sky-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-xl font-semibold text-slate-300">Creating your presentation...</p>
        <p className="text-slate-400">This may take a moment.</p>
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

export const SlideDeck: React.FC<SlideDeckProps> = ({ slides, isLoading, error, onUpdateSlide, gradeLevel, subject }) => {
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
                    const blob = await generateImage(slide.imagePrompt);
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
        return <div className="flex items-center justify-center h-full text-center p-8 bg-red-900/20 text-red-300 rounded-lg border border-red-500/50">{error}</div>;
    }

    if (!slides) {
        return <WelcomeMessage />;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-100">Your Presentation</h2>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleDownloadAllImages}
                        disabled={isDownloadingImages || isExporting}
                        title="Download All Images as Zip"
                        className="flex items-center justify-center py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-md shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isDownloadingImages ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <ImageIcon className="mr-2" />
                                Download Images
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleDownloadNotes}
                        disabled={isDownloadingNotes || isExporting || isDownloadingImages}
                        title="Download Speaker Notes (DOCX)"
                        className="flex items-center justify-center py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-md shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isDownloadingNotes ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <DocumentTextIcon className="mr-2" />
                                Speaker Notes (DOCX)
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleExportPPTX}
                        disabled={isExporting || !PptxGenJS || isDownloadingImages}
                        title={PptxGenJS ? "Download PowerPoint Presentation" : "Presentation library is loading..."}
                        className="flex items-center justify-center py-2 px-6 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md shadow-md transition-colors duration-200 disabled:bg-slate-500 disabled:cursor-wait"
                    >
                        {isExporting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Creating PPTX...
                            </>
                        ) : (
                            <>
                                <PptxIcon className="mr-2" />
                                Download PPTX
                            </>
                        )}
                    </button>
                </div>
            </div>
            <div className="space-y-6 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
                {slides.map((slide, index) => (
                    <SlideCard
                        key={index}
                        slide={slide}
                        slideNumber={index + 1}
                        onUpdateSlide={(updatedSlide) => onUpdateSlide(index, updatedSlide)}
                        gradeLevel={gradeLevel}
                        subject={subject}
                    />
                ))}
            </div>
        </div>
    );
};