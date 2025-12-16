import React, { useState, useEffect, useRef } from 'react';
import type { Slide, ImagePrompt, GeneratedImage, ImageSpec, ImageGenError } from '../types';
import { CopyIcon, CheckIcon, ImageIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { generateImageFromSpec, regenerateImageSpec } from '../services/geminiService';
import { formatImageSpec } from '../utils/imageUtils';
import { uploadImageToStorage } from '../services/projectService';

interface SlideCardProps {
    slide: Slide;
    slideNumber: number;
    onUpdateSlide: (updatedSlide: Slide) => void;
    gradeLevel: string;
    subject: string;
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
        .replace(/`([^`]+)`/g, '$1')    // Code
        .replace(/^[\s\-\*]+/, '');      // Remove leading dashes, asterisks, and whitespace
};

export const SlideCard: React.FC<SlideCardProps> = ({ slide, slideNumber, onUpdateSlide, gradeLevel, subject, creativityLevel, userId, projectId }) => {
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);

    // History State
    // We initialize this lazily to handle the legacy -> history migration on first render if needed
    // However, for strict React purity, we should not mutate props. 
    // We will derive the "display" prompts array on the fly.
    // History State
    const prompts: ImagePrompt[] = slide.prompts || [
        {
            id: 'legacy-' + Date.now(),
            prompt: slide.renderedImagePrompt || slide.imagePrompt || '',
            createdAt: Date.now(),
            generatedImages: [],
            spec: slide.imageSpec // Store spec if available
        }
    ];

    // Identify which prompt is selected. Default to the last one (most recent) if not specified.
    // If selectedPromptId is set but not found, fallback to last.
    const selectedPromptIndex = slide.selectedPromptId
        ? prompts.findIndex(p => p.id === slide.selectedPromptId)
        : prompts.length - 1;

    // Safety check: if index -1 (not found), default to last.
    const activeIndex = selectedPromptIndex >= 0 ? selectedPromptIndex : prompts.length - 1;
    const activePrompt = prompts[activeIndex];

    const [promptText, setPromptText] = useState(activePrompt.prompt);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const editContainerRef = useRef<HTMLDivElement>(null);

    const [isEditingContent, setIsEditingContent] = useState(false);
    const [contentText, setContentText] = useState(slide.content.join('\n'));
    const contentRef = useRef<HTMLTextAreaElement>(null);

    const contentToCopy = `${slide.title}\n\n${slide.content.map(item => `- ${item}`).join('\n')}`;

    // Auto-resize textareas
    useEffect(() => {
        if (isEditingPrompt && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [promptText, isEditingPrompt]);

    useEffect(() => {
        if (isEditingContent && contentRef.current) {
            contentRef.current.style.height = 'auto';
            contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
        }
    }, [contentText, isEditingContent]);

    // Aspect Ratio State
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1'>('16:9');

    // Sync local text state when active prompt changes
    useEffect(() => {
        setPromptText(activePrompt.prompt);
    }, [activePrompt.id, activePrompt.prompt]);

    // Click outside to cancel prompt edit
    useEffect(() => {
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
        return filename
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 100);
    };

    const handleNavigateHistory = (direction: 'prev' | 'next') => {
        const newIndex = direction === 'prev' ? activeIndex - 1 : activeIndex + 1;
        if (newIndex >= 0 && newIndex < prompts.length) {
            const newPrompt = prompts[newIndex];
            // Update parent with new selected ID
            onUpdateSlide({
                ...slide,
                // Ensure prompts array is fully populated in the update if it wasn't before
                prompts: prompts,
                selectedPromptId: newPrompt.id,
                imagePrompt: newPrompt.prompt // Update legacy field just in case
            });
        }
    };

    const handleGenerateImage = async () => {
        setIsGeneratingImage(true);
        try {
            // New Flow: generateImageFromSpec
            if (activePrompt.spec || slide.imageSpec) {
                const specToUse = activePrompt.spec || slide.imageSpec;
                if (!specToUse) throw new Error("No image spec available");

                const { blob, renderedPrompt } = await generateImageFromSpec(specToUse, gradeLevel, subject, {
                    temperature: creativityLevel,
                    aspectRatio: aspectRatio
                });

                // Handle result...
                if (userId && projectId) {
                    const sanitizedTitle = sanitizeFilename(slide.title);
                    const filename = `img-${slideNumber}-${sanitizedTitle}.png`;
                    const generatedImage = await uploadImageToStorage(userId, projectId, blob, filename, aspectRatio);

                    // Update history
                    const updatedPrompts = [...prompts];
                    const updatedPrompt = {
                        ...activePrompt,
                        prompt: renderedPrompt,
                        generatedImages: [...(activePrompt.generatedImages || []), generatedImage],
                        spec: specToUse
                    };
                    updatedPrompts[activeIndex] = updatedPrompt;

                    onUpdateSlide({
                        ...slide,
                        prompts: updatedPrompts,
                        selectedPromptId: activePrompt.id,
                        backgroundImage: generatedImage.url,
                        renderedImagePrompt: renderedPrompt
                    });
                } else {
                    // Fallback download
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `slide-${slideNumber}-image.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }

            } else {
                // Fallback for legacy (should not hit in new decks)
                alert("Legacy format not supported for regeneration. Please create a new deck.");
            }
        } catch (error) {
            console.error('Error generating image:', error);

            let message = 'Failed to generate image. Please try again.';
            if (error instanceof Error && (error as any).isRetryable) { // Check for ImageGenError attributes
                const imgErr = error as ImageGenError;
                if (imgErr.code === 'NO_IMAGE_DATA') {
                    message = "No image returned from AI. Try clicking 'New Visual Idea' to reset the concept.";
                } else if (imgErr.isRetryable) {
                    message = "Temporary AI glitch. Please try clicking 'Generate Image' again.";
                } else if (imgErr.code === 'INVALID_MIME_TYPE') {
                    message = "Unexpected image format received. Please report this issue.";
                }
            }
            alert(message);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleNewVisualIdea = async () => {
        setIsRegeneratingPrompt(true);
        try {
            // Generate NEW Spec
            const newSpec = await regenerateImageSpec(
                slide.title,
                slide.content,
                gradeLevel,
                subject,
                creativityLevel
            );

            // Create display string
            const rendered = formatImageSpec(newSpec, { gradeLevel, subject });

            const newPromptObj: ImagePrompt = {
                id: crypto.randomUUID(),
                prompt: rendered,
                createdAt: Date.now(),
                generatedImages: [],
                spec: newSpec
            };

            const updatedPrompts = [...prompts, newPromptObj];

            onUpdateSlide({
                ...slide,
                prompts: updatedPrompts,
                imageSpec: newSpec, // Update authoritative spec
                renderedImagePrompt: rendered,
                selectedPromptId: newPromptObj.id
            });
            // Note: We don't auto-generate the image here, we let the user click "Generate"
            // Or we could auto-generate?
            // "New Visual Idea" suggests getting the idea first. User can then generate.

        } catch (error) {
            console.error('Error generating new visual idea:', error);
            alert('Failed to create new visual idea. Please try again.');
        } finally {
            setIsRegeneratingPrompt(false);
        }
    };

    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPromptText(e.target.value);
    };

    const handleSavePrompt = () => {
        // Update the CURRENT prompt version
        const updatedPrompts = [...prompts];
        updatedPrompts[activeIndex] = {
            ...activePrompt,
            prompt: promptText
        };

        onUpdateSlide({
            ...slide,
            prompts: updatedPrompts,
            imagePrompt: promptText
        });
        setIsEditingPrompt(false);
    };

    const handleCancelEdit = () => {
        setPromptText(activePrompt.prompt);
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

            {/* Footer / Image Prompt v2.0 */}
            <footer className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex items-start gap-3 w-full">
                    {/* Icon - Constant */}
                    <div className="mt-1 p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 shadow-sm">
                        <ImageIcon className="w-4 h-4" />
                    </div>

                    <div className="flex-grow min-w-0">
                        {/* Prompt Header: Label + Navigation + Actions */}
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#627C81]">Image Prompt</span>

                            {/* Navigation Controls */}
                            <div className="flex items-center space-x-2">
                                {prompts.length > 1 && (
                                    <div className="flex items-center bg-white border border-slate-200 rounded-md shadow-sm h-7">
                                        <button
                                            onClick={() => handleNavigateHistory('prev')}
                                            disabled={activeIndex <= 0}
                                            className="px-2 h-full hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-slate-500 transition-colors border-r border-slate-100"
                                            title="Previous Version"
                                        >
                                            <ChevronLeftIcon className="w-3 h-3" />
                                        </button>
                                        <span className="px-2 text-[10px] font-semibold text-slate-500 tabular-nums select-none">
                                            {activeIndex + 1} / {prompts.length}
                                        </span>
                                        <button
                                            onClick={() => handleNavigateHistory('next')}
                                            disabled={activeIndex >= prompts.length - 1}
                                            className="px-2 h-full hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-slate-500 transition-colors border-l border-slate-100"
                                            title="Next Version"
                                        >
                                            <ChevronRightIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}

                                {!isEditingPrompt && (
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={() => setIsEditingPrompt(true)}
                                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-colors"
                                            title="View Full Prompt"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleNewVisualIdea}
                                            disabled={isRegeneratingPrompt}
                                            className="flex items-center space-x-1 px-2 py-1 hover:bg-slate-100 rounded text-xs text-secondary-text hover:text-accent transition-colors disabled:opacity-50 border border-transparent hover:border-slate-200"
                                            title="Get New Visual Idea (New Spec)"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isRegeneratingPrompt ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                            </svg>
                                            <span className="font-semibold">New Idea</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Prompt Text / Edit Mode */}
                        {isEditingPrompt ? (
                            <div className="w-full animate-fade-in" ref={editContainerRef}>
                                <div className="p-2 mb-2 bg-amber-50 text-amber-600 text-xs rounded border border-amber-200">
                                    <strong>Note:</strong> Editing the prompt text directly disconnects it from the Visual Spec.
                                    (Currently Disabled for consistency - use "New Idea" instead)
                                </div>
                                <textarea
                                    ref={textareaRef}
                                    value={promptText}
                                    onChange={handlePromptChange}
                                    readOnly={true} // Read-only for now to enforce spec workflow
                                    className="input-field text-sm min-h-[80px] bg-slate-100 text-slate-500 cursor-not-allowed"
                                    rows={2}
                                />
                                <div className="flex justify-end space-x-2 mt-2">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="px-2 py-1 text-xs font-medium text-secondary-text hover:text-primary-text transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative group/prompt">
                                <p className="text-sm text-secondary-text italic cursor-pointer hover:text-primary-text transition-colors line-clamp-3" onClick={() => setIsEditingPrompt(true)}>
                                    {activePrompt.prompt}
                                </p>
                            </div>
                        )}

                        {/* Generated Images Strip */}
                        {activePrompt.generatedImages && activePrompt.generatedImages.length > 0 && (
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                {activePrompt.generatedImages.map((img) => (
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
                            onClick={() => setAspectRatio('16:9')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${aspectRatio === '16:9'
                                ? 'bg-white text-primary shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            16:9
                        </button>
                        <button
                            onClick={() => setAspectRatio('1:1')}
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
                    <CopyButton textToCopy={activePrompt.prompt} />
                </div>
            </footer>
        </div>
    );
};
