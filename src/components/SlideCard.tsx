
import React, { useState } from 'react';
import type { Slide } from '../types';
import { CopyIcon, CheckIcon, ImageIcon } from './icons';
import { generateImage, regenerateImagePrompt } from '../services/geminiService';

interface SlideCardProps {
    slide: Slide;
    slideNumber: number;
    onUpdateSlide: (updatedSlide: Slide) => void;
    gradeLevel: string;
    subject: string;
    creativityLevel: number;
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
            className="p-3 rounded-md text-secondary-text hover:bg-slate-100 hover:text-primary-text transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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

export const SlideCard: React.FC<SlideCardProps> = ({ slide, slideNumber, onUpdateSlide, gradeLevel, subject, creativityLevel }) => {
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [promptText, setPromptText] = useState(slide.imagePrompt);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const editContainerRef = React.useRef<HTMLDivElement>(null);

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

    // Update local prompt text if slide prop changes (e.g. after regeneration)
    React.useEffect(() => {
        setPromptText(slide.imagePrompt);
    }, [slide.imagePrompt]);

    // Click outside to cancel prompt edit
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isEditingPrompt && editContainerRef.current && !editContainerRef.current.contains(event.target as Node)) {
                handleCancelEdit();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isEditingPrompt]);

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
            const imageBlob = await generateImage(slide.imagePrompt, gradeLevel, creativityLevel);
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

    const handleRegeneratePrompt = async () => {
        setIsRegeneratingPrompt(true);
        try {
            const newPrompt = await regenerateImagePrompt(
                slide.title,
                slide.content,
                gradeLevel,
                subject,
                creativityLevel
            );
            onUpdateSlide({ ...slide, imagePrompt: newPrompt });
        } catch (error) {
            console.error('Error regenerating prompt:', error);
            alert('Failed to regenerate prompt. Please try again.');
        } finally {
            setIsRegeneratingPrompt(false);
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
        <div className="glass-card rounded-2xl overflow-hidden group border border-[#rgba(0,0,0,0.08)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            {/* Header */}
            <header className="p-5 flex justify-between items-start border-b border-slate-100 bg-surface/50">
                <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center space-x-3 mb-1">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">Slide {slideNumber}</span>
                        <span className="text-xs text-secondary-text uppercase tracking-wider font-semibold">{slide.layout}</span>
                    </div>
                    <h3 className="text-xl font-bold text-primary-text truncate">{slide.title}</h3>
                </div>

                <div className="flex items-center space-x-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    <CopyButton textToCopy={contentToCopy} />
                </div>
            </header>

            {/* Content Area */}
            <div className="p-6 relative group/content">
                {isEditingContent ? (
                    <div className="w-full animate-fade-in">
                        <textarea
                            ref={contentRef}
                            value={contentText}
                            onChange={handleContentChange}
                            className="input-field min-h-[150px] leading-relaxed resize-none focus:bg-white"
                            rows={slide.content.length || 3}
                        />
                        <div className="flex justify-end space-x-2 mt-3">
                            <button
                                onClick={handleCancelContentEdit}
                                className="px-3 py-1.5 text-xs font-medium text-secondary-text hover:text-primary-text hover:bg-slate-100 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveContent}
                                className="px-3 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-md shadow-lg shadow-primary/20 transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative pl-4 border-l-2 border-primary/20 hover:border-primary/50 transition-colors">
                        <ul className="space-y-3 text-primary-text/90">
                            {slide.content.map((item, index) => (
                                <li key={index} className="flex items-start">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-2 mr-3 flex-shrink-0"></span>
                                    <span className="leading-relaxed text-[#627C81]">{cleanText(item)}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => setIsEditingContent(true)}
                            className="absolute top-0 right-0 p-2 text-secondary-text hover:text-primary opacity-0 group-hover/content:opacity-100 transition-all bg-surface shadow-sm rounded-lg"
                            title="Edit Content"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Footer / Image Prompt */}
            <footer className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex items-start gap-3 w-full">
                    <div className="mt-1 p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 shadow-sm">
                        <ImageIcon className="w-4 h-4" />
                    </div>

                    <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#627C81]">Image Prompt</span>
                            {!isEditingPrompt && (
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setIsEditingPrompt(true)}
                                        className="p-3 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                        title="Edit Prompt"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handleRegeneratePrompt}
                                        disabled={isRegeneratingPrompt}
                                        className="p-3 hover:bg-slate-100 rounded text-secondary-text hover:text-accent transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                        title="Regenerate Prompt"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isRegeneratingPrompt ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>

                        {isEditingPrompt ? (
                            <div className="w-full animate-fade-in" ref={editContainerRef}>
                                <textarea
                                    ref={textareaRef}
                                    value={promptText}
                                    onChange={handlePromptChange}
                                    className="input-field text-sm min-h-[80px] bg-surface text-primary-text"
                                    rows={2}
                                />
                                <div className="flex justify-end space-x-2 mt-2">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="px-2 py-1 text-xs font-medium text-secondary-text hover:text-primary-text transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSavePrompt}
                                        className="px-2 py-1 text-xs font-bold bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                                    >
                                        Update Prompt
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-secondary-text italic cursor-pointer hover:text-primary-text transition-colors line-clamp-2" onClick={() => setIsEditingPrompt(true)}>
                                {slide.imagePrompt}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end items-center pt-2 w-full gap-2">
                    <button
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-[#F5F5F5] hover:bg-slate-200 text-[#134252] rounded-lg text-xs font-semibold transition-all border border-border-light shadow-sm disabled:opacity-50 h-[36px]"
                    >
                        {isGeneratingImage ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        )}
                        <span>Generate Image</span>
                    </button>
                    <CopyButton textToCopy={slide.imagePrompt} />
                </div>
            </footer>
        </div>
    );
};
