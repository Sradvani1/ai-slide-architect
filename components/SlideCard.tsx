
import React, { useState } from 'react';
import type { Slide } from '../types';
import { CopyIcon, CheckIcon, ImageIcon } from './icons';
import { generateImage } from '../services/geminiService';

interface SlideCardProps {
  slide: Slide;
  slideNumber: number;
}

const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-600 hover:text-slate-100 transition-colors"
        >
            {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
    );
};


export const SlideCard: React.FC<SlideCardProps> = ({ slide, slideNumber }) => {
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    const contentToCopy = `${slide.title}\n\n${slide.content.map(item => `- ${item}`).join('\n')}`;

    const sanitizeFilename = (filename: string): string => {
        // Remove or replace characters that are invalid in filenames
        return filename
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 100); // Limit length
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleGenerateImage = async () => {
        setIsGeneratingImage(true);
        try {
            const imageBlob = await generateImage(slide.imagePrompt);
            const sanitizedTitle = sanitizeFilename(slide.title);
            const filename = `${slideNumber}-${sanitizedTitle}.png`;
            downloadBlob(imageBlob, filename);
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Failed to generate image. Please try again.');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    return (
        <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden transition-all duration-300 hover:border-sky-500/50 hover:shadow-sky-500/10">
            <header className="p-4 bg-slate-700/50 flex justify-between items-center border-b border-slate-700">
                <div className="flex items-baseline">
                    <span className="text-sm font-bold text-sky-400 mr-3">SLIDE {slideNumber}</span>
                    <h3 className="text-lg font-bold text-slate-100">{slide.title}</h3>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">{slide.layout}</span>
                    <CopyButton textToCopy={contentToCopy} />
                </div>
            </header>
            <div className="p-5">
                <ul className="space-y-2 list-disc list-inside text-slate-300">
                    {slide.content.map((item, index) => (
                        <li key={index}>{item}</li>
                    ))}
                </ul>
            </div>
            <footer className="px-5 py-3 bg-slate-800/50 border-t border-slate-700 flex justify-between items-center text-sm">
                <div className="flex items-center text-slate-400">
                    <ImageIcon className="mr-2" />
                    <p className="italic">Image Prompt: "{slide.imagePrompt}"</p>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="p-1.5 rounded-md text-slate-400 hover:bg-slate-600 hover:text-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        title="Generate Image"
                    >
                        {isGeneratingImage ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        )}
                    </button>
                    <CopyButton textToCopy={slide.imagePrompt} />
                </div>
            </footer>
        </div>
    );
};
