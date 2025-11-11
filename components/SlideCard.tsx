
import React, { useState } from 'react';
import type { Slide } from '../types';
import { CopyIcon, CheckIcon, ImageIcon } from './icons';

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

    const contentToCopy = `${slide.title}\n\n${slide.content.map(item => `- ${item}`).join('\n')}`;

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
                <CopyButton textToCopy={slide.imagePrompt} />
            </footer>
        </div>
    );
};
