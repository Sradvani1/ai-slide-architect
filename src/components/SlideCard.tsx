import React, { useState, useEffect, useRef } from 'react';
import type { Slide, ImageGenError } from '../types';
import { CopyIcon, CheckIcon, ImageIcon, PencilIcon } from './icons';
import { generateImageFromPrompt, incrementProjectTokens, retryPromptGeneration } from '../services/geminiService';
import { uploadImageToStorage } from '../services/projectService';
import { isRetryableError } from '../utils/typeGuards';
import { MODEL_IMAGE_GENERATION, MODEL_SLIDE_GENERATION } from '../constants';

interface SlideCardProps {
    slide: Slide;
    slideNumber: number;
    onUpdateSlide: (patch: Partial<Slide>) => void;
    creativityLevel: number;
    userId: string;
    projectId: string | null;
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
        .replace(/`([^`]+)`/g, '$1')     // Code
        .replace(/^[\s\-\*]+/, '');      // Remove leading dashes, asterisks, and whitespace
};

export const SlideCard: React.FC<SlideCardProps> = ({ slide, slideNumber, onUpdateSlide, creativityLevel, userId, projectId }) => {
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);

    // Source of Truth
    const imagePrompts = slide.imagePrompts || [];
    const generatedImages = slide.generatedImages || [];

    // Determine current prompt
    const currentPromptId = slide.currentPromptId && imagePrompts.some(p => p.id === slide.currentPromptId)
        ? slide.currentPromptId
        : (imagePrompts.length > 0 ? imagePrompts[0].id : undefined);
    const currentPrompt = imagePrompts.find(p => p.id === currentPromptId);
    const imagePromptText = currentPrompt?.text || '';

    const [editedPrompt, setEditedPrompt] = useState(imagePromptText);

    // Filter images for current prompt OR orphaned images
    const visibleImages = generatedImages.filter(img => !img.promptId || img.promptId === currentPromptId);

    // Sync editedPrompt when current prompt changes
    useEffect(() => {
        if (!isEditingPrompt) {
            setEditedPrompt(imagePromptText);
        }
    }, [imagePromptText, isEditingPrompt]);

    // Hard Re-entrancy Locks
    const isGeneratingImageRef = useRef(false);

    const [isEditingContent, setIsEditingContent] = useState(false);
    const [contentText, setContentText] = useState(slide.content.join('\n'));
    const contentRef = useRef<HTMLTextAreaElement>(null);

    const contentToCopy = `${slide.title}\n\n${slide.content.map(item => `- ${item}`).join('\n')}`;

    // Auto-resize textareas
    useEffect(() => {
        if (isEditingContent && contentRef.current) {
            contentRef.current.style.height = 'auto';
            contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
        }
    }, [contentText, isEditingContent]);

    // Aspect Ratio Local state
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1'>(slide.aspectRatio || '16:9');

    useEffect(() => {
        if (slide.aspectRatio) {
            setAspectRatio(slide.aspectRatio);
        }
    }, [slide.aspectRatio]);

    const [isRetrying, setIsRetrying] = useState(false);

    const sanitizeFilename = (filename: string): string => {
        return filename
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 100);
    };
    const handleGenerateImage = async () => {
        if (isGeneratingImageRef.current) return;
        if (!imagePromptText || !currentPromptId || !currentPrompt) {
            alert("No image prompt available for this slide.");
            return;
        }

        isGeneratingImageRef.current = true;
        setIsGeneratingImage(true);
        try {
            const { blob, inputTokens, outputTokens } = await generateImageFromPrompt(imagePromptText, {
                aspectRatio,
                temperature: creativityLevel
            });

            if (userId && projectId) {
                const sanitizedTitle = sanitizeFilename(slide.title);
                const filename = `img-${slideNumber}-${sanitizedTitle}-${Date.now()}.png`;
                const generatedImage = await uploadImageToStorage(
                    userId,
                    projectId,
                    blob,
                    filename,
                    currentPromptId,
                    aspectRatio,
                    inputTokens,
                    outputTokens
                );

                onUpdateSlide({
                    generatedImages: [...generatedImages, generatedImage],
                    backgroundImage: generatedImage.url
                });

                // Report tokens to backend for cost tracking
                await incrementProjectTokens(
                    projectId,
                    MODEL_IMAGE_GENERATION,
                    inputTokens,
                    outputTokens,
                    'image'
                );

            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `slide-${slideNumber}-image.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

        } catch (error) {
            console.error('Error generating image:', error);
            let message = 'Failed to generate image. Please try again.';
            if (String(error).includes('NO_IMAGE_DATA')) {
                message = "No image returned from AI. Try editing the prompt.";
            } else if (isRetryableError(error)) {
                message = "Temporary AI glitch. Please try clicking 'Generate Image' again.";
            }
            alert(message);
        } finally {
            setIsGeneratingImage(false);
            isGeneratingImageRef.current = false;
        }
    };

    const handleRetryPromptGeneration = async () => {
        if (!projectId || isRetrying) return;
        setIsRetrying(true);
        try {
            await retryPromptGeneration(projectId, slide.id);
            // State will update via Firestore listener
        } catch (error) {
            console.error('Error retrying prompt generation:', error);
            alert('Failed to retry prompt generation. Please try again.');
        } finally {
            setIsRetrying(false);
        }
    };

    const handleSavePrompt = () => {
        if (!currentPromptId) return;

        const updatedPrompts = imagePrompts.map(p =>
            p.id === currentPromptId ? { ...p, text: editedPrompt } : p
        );

        onUpdateSlide({ imagePrompts: updatedPrompts });
        setIsEditingPrompt(false);
    };


    const handleSaveContent = () => {
        const newContent = contentText.split('\n').filter(line => line.trim() !== '');
        onUpdateSlide({ content: newContent });
        setIsEditingContent(false);
    };

    const handleCancelContentEdit = () => {
        setContentText(slide.content.join('\n'));
        setIsEditingContent(false);
    };

    return (
        <div className="glass-card rounded-2xl overflow-hidden group border border-[#rgba(0,0,0,0.08)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            {/* Header */}
            <header className="p-4 sm:p-5 flex justify-between items-start border-b border-slate-100 bg-surface/50 gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">Slide {slideNumber}</span>
                        <span className="text-xs text-secondary-text uppercase tracking-wider font-semibold">{slide.layout}</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-primary-text break-words line-clamp-2">{slide.title}</h3>
                </div>
            </header>

            {/* Content Area */}
            <div className="p-6 relative group/content">
                {isEditingContent ? (
                    <div className="w-full animate-fade-in">
                        <textarea
                            ref={contentRef}
                            value={contentText}
                            onChange={e => setContentText(e.target.value)}
                            className="w-full h-full min-h-[300px] resize-none outline-none text-secondary-text leading-relaxed bg-transparent"
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

                        <div className="flex flex-col gap-2 absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                                onClick={() => setIsEditingContent(true)}
                                className="p-2 text-secondary-text hover:text-primary bg-surface shadow-sm rounded-lg border border-slate-100"
                                title="Edit Content"
                            >
                                <PencilIcon className="h-4 w-4" />
                            </button>
                            <CopyButton textToCopy={contentToCopy} />
                        </div>
                    </div>
                )}
            </div>

            <footer className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                {slide.promptGenerationState === 'failed' ? (
                    <div className="flex flex-col items-center justify-center p-6 bg-red-50/50 rounded-xl border border-red-100 shadow-sm animate-fade-in">
                        <div className="flex flex-col items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Generation Failed</span>
                            <p className="text-xs text-red-500 max-w-[200px] text-center">{slide.promptGenerationError || 'Unknown error occurred'}</p>
                        </div>
                        <button
                            onClick={handleRetryPromptGeneration}
                            disabled={isRetrying}
                            className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md shadow-red-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                        >
                            {isRetrying && (
                                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {isRetrying ? 'Retrying...' : 'Retry Generation'}
                        </button>
                    </div>
                ) : (slide.promptGenerationState !== 'completed' && imagePrompts.length === 0) ? (
                    <div className="flex items-center justify-center p-8 bg-white/50 rounded-xl border border-slate-100 shadow-sm animate-pulse w-full">
                        <div className="flex flex-col items-center gap-3">
                            <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-bold text-secondary-text uppercase tracking-widest">
                                {slide.promptGenerationState === 'generating' ? 'Generating Visual Idea...' : 'Preparing Visual Idea...'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start gap-3 w-full">
                            <div className="mt-1 p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 shadow-sm">
                                <ImageIcon className="w-4 h-4" />
                            </div>

                            <div className="flex-grow min-w-0">
                                {/* Control Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#627C81]">Visual Idea</span>
                                </div>

                                {isEditingPrompt ? (
                                    <div className="animate-fade-in bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                        <textarea
                                            value={editedPrompt}
                                            onChange={(e) => setEditedPrompt(e.target.value)}
                                            className="w-full min-h-[100px] text-sm text-primary-text mb-3 p-2 border border-slate-200 rounded outline-none focus:border-primary/50"
                                            placeholder="Describe the image you want to generate..."
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setIsEditingPrompt(false)}
                                                className="px-3 py-1.5 text-xs font-medium text-secondary-text hover:text-primary-text"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSavePrompt}
                                                className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded shadow-sm hover:bg-primary/90"
                                            >
                                                Save Idea
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative group/prompt flex gap-3">
                                        <div
                                            className={`flex-grow bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:border-primary/30 transition-all cursor-pointer ${!isPromptExpanded ? 'max-h-[80px] overflow-hidden' : ''}`}
                                            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                                        >
                                            <div className="prose prose-sm max-w-none text-secondary-text text-sm">
                                                <p className="whitespace-pre-wrap leading-relaxed">{imagePromptText}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 opacity-0 group-hover/prompt:opacity-100 transition-all">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsEditingPrompt(true); }}
                                                className="p-2 text-secondary-text hover:text-primary bg-white shadow-sm rounded-lg border border-slate-100"
                                                title="Edit Visual Idea"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <CopyButton textToCopy={imagePromptText} />
                                        </div>
                                    </div>
                                )}

                                {/* Recent Images Strip */}
                                {visibleImages.length > 0 && (
                                    <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                        {visibleImages.map((img) => (
                                            <a
                                                key={img.id}
                                                href={img.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-shrink-0 relative group/img w-16 h-16 rounded border border-slate-200 overflow-hidden bg-white hover:border-primary transition-colors"
                                                title={`Generated ${new Date(img.createdAt).toLocaleTimeString()}`}
                                            >
                                                <img src={img.url} alt="Generated" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end items-center pt-2 w-full gap-2 border-t border-slate-100/50 mt-1">
                            {/* Aspect Ratio Selector */}
                            <div className="flex items-center space-x-1 mr-auto bg-slate-100/50 p-1 rounded-lg">
                                <button
                                    onClick={() => {
                                        setAspectRatio('16:9');
                                        onUpdateSlide({ aspectRatio: '16:9' });
                                    }}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${aspectRatio === '16:9'
                                        ? 'bg-white text-primary shadow-sm border border-slate-200'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    16:9
                                </button>
                                <button
                                    onClick={() => {
                                        setAspectRatio('1:1');
                                        onUpdateSlide({ aspectRatio: '1:1' });
                                    }}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${aspectRatio === '1:1'
                                        ? 'bg-white text-primary shadow-sm border border-slate-200'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    1:1
                                </button>
                            </div>

                            <button
                                onClick={handleGenerateImage}
                                disabled={isGeneratingImage || !imagePromptText}
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
                                <span>{isGeneratingImage ? 'Generating...' : 'Generate Image'}</span>
                            </button>
                        </div>
                    </>
                )}
            </footer>
        </div >
    );
};
