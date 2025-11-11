import React, { useState, useEffect } from 'react';
import { SlideCard } from './SlideCard';
import { PptxIcon } from './icons';
import type { Slide } from '../types';

type PptxGenJsConstructor = typeof import('pptxgenjs') extends { default: infer DefaultExport }
  ? DefaultExport
  : never;

interface SlideDeckProps {
  slides: Slide[] | null;
  isLoading: boolean;
  error: string | null;
}

const WelcomeMessage: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-700">
        <div className="w-16 h-16 mb-4 text-sky-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="http://www.w3.org/2000/svg" strokeWidth={1.5} stroke="currentColor">
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
        <svg className="animate-spin h-12 w-12 text-sky-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-xl font-semibold text-slate-300">Creating your presentation...</p>
        <p className="text-slate-400">This may take a moment.</p>
    </div>
);

export const SlideDeck: React.FC<SlideDeckProps> = ({ slides, isLoading, error }) => {
    const [isExporting, setIsExporting] = useState(false);
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

            for (const slideData of slides) {
                const slide = pptx.addSlide();

                // Title at the top
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

                // Content below the title
                if (slideData.content && slideData.content.length > 0) {
                    const contentText = slideData.content.join('\n');
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

            await pptx.writeFile({ fileName: 'Teacher-Presentation.pptx' });
        } catch(err) {
            console.error("Error during PPTX file generation:", err);
            alert("An error occurred while exporting the PPTX file.");
        } finally {
            setIsExporting(false);
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
                <div className="flex items-center">
                    <button
                        onClick={handleExportPPTX}
                        disabled={isExporting || !PptxGenJS}
                        title={PptxGenJS ? "Download PowerPoint Presentation" : "Presentation library is loading..."}
                        className="flex items-center justify-center py-2 px-6 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md shadow-md transition-colors duration-200 disabled:bg-slate-500 disabled:cursor-wait"
                    >
                        {isExporting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="http://www.w3.org/2000/svg">
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
            <div className="space-y-6 overflow-y-auto pr-2" style={{maxHeight: 'calc(100vh - 12rem)'}}>
                {slides.map((slide, index) => (
                    <SlideCard key={index} slide={slide} slideNumber={index + 1} />
                ))}
            </div>
        </div>
    );
};