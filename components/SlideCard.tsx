
import React, { useState } from 'react';
import type { Slide } from '../types';
import { CopyIcon, CheckIcon, ImageIcon } from './icons';
import { generateImage } from '../services/geminiService';

interface SlideCardProps {
    slide: Slide;
    slideNumber: number;
    onUpdateSlide: (updatedSlide: Slide) => void;
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

export const cleanText = (text: string): string => {
    return text.replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/__(.*?)__/g, '$1')     // Bold
        .replace(/_(.*?)_/g, '$1')       // Italic
        .replace(/`([^`]+)`/g, '$1')    // Code
        .replace(/^[\s\-\*]+/, '');      // Remove leading dashes, asterisks, and whitespace
};

export const SlideCard: React.FC<SlideCardProps> = ({ slide, slideNumber, onUpdateSlide }) => {
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [promptText, setPromptText] = useState(slide.imagePrompt);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const [isEditingContent, setIsEditingContent] = useState(false);
    const [contentText, setContentText] = useState(slide.content.join('\n'));
    const contentRef = React.useRef<HTMLTextAreaElement>(null);

    const contentToCopy = `${slide.title}\n\n${slide.content.map(item => `- ${item}`).join('\n')}`;

    React.useEffect(() => {
        if (isEditingPrompt && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [promptText, isEditingPrompt]);

    React.useEffect(() => {
        if (isEditingContent && contentRef.current) {
            contentRef.current.style.height = 'auto';
            contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
        }
    }, [contentText, isEditingContent]);

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

    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPromptText(e.target.value);
    };

    const handleSavePrompt = () => {
        onUpdateSlide({ ...slide, imagePrompt: promptText });
        setIsEditingPrompt(false);
    };

    const handleCancelEdit = () => {
        setPromptText(slide.imagePrompt);
        setIsEditingPrompt(false);
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContentText(e.target.value);
    };

    const handleSaveContent = () => {
        const newContent = contentText.split('\n').filter(line => line.trim() !== '');
        onUpdateSlide({ ...slide, content: newContent });
        setIsEditingContent(false);
    };

    const handleCancelContentEdit = () => {
        setContentText(slide.content.join('\n'));
        setIsEditingContent(false);
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
            <div className="p-5 relative group/content">
                {isEditingContent ? (
                    <div className="w-full">
                        <textarea
                            ref={contentRef}
                            value={contentText}
                            onChange={handleContentChange}
                            className="w-full bg-slate-900 text-slate-200 border border-slate-600 rounded p-2 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-base resize-none overflow-hidden leading-relaxed"
                            rows={slide.content.length || 3}
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                            <button
                                onClick={handleCancelContentEdit}
                                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveContent}
                                className="px-3 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <ul className="space-y-2 list-disc list-inside text-slate-300">
                            {slide.content.map((item, index) => (
                                <li key={index}>{cleanText(item)}</li>
                            ))}
                        </ul>
                        <button
                            onClick={() => setIsEditingContent(true)}
                            className="absolute top-2 right-2 opacity-0 group-hover/content:opacity-100 transition-opacity text-sky-400 hover:text-sky-300 p-1 rounded hover:bg-slate-700/50"
                            title="Edit Content"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    </>
                )}
            </div>
            <footer className="px-5 py-3 bg-slate-800/50 border-t border-slate-700 flex flex-col space-y-3 text-sm">
                <div className="flex items-start text-slate-400 w-full">
                    <ImageIcon className="mr-2 mt-1 flex-shrink-0" />
                    <div className="flex-grow">
                        {isEditingPrompt ? (
                            <div className="w-full">
                                <textarea
                                    ref={textareaRef}
                                    value={promptText}
                                    onChange={handlePromptChange}
                                    className="w-full bg-slate-900 text-slate-200 border border-slate-600 rounded p-2 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-sm resize-none overflow-hidden"
                                    rows={1}
                                />
                                <div className="flex justify-end space-x-2 mt-2">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSavePrompt}
                                        className="px-3 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="group relative">
                                <p className="italic pr-8 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => setIsEditingPrompt(true)}>
                                    Image Prompt: "{slide.imagePrompt}"
                                </p>
                                <button
                                    onClick={() => setIsEditingPrompt(true)}
                                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-sky-400 hover:text-sky-300"
                                    title="Edit Prompt"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end items-center space-x-2 pt-2 border-t border-slate-700/50 w-full">
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
