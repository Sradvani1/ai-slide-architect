import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Slide } from '../types';
import { CopyIcon, CheckIcon, ImageIcon, PencilIcon } from './icons';
import { downloadImagesZip, generateImageFromPrompt, generatePrompt, searchImages } from '../services/geminiService';
import { uploadImageToStorage } from '../services/projectService';
import { isRetryableError } from '../utils/typeGuards';
import { ImageViewerModal } from './ImageViewerModal';

interface SlideCardProps {
    slide: Slide;
    slideNumber: number;
    onUpdateSlide: (patch: Partial<Slide>) => void;
    userId: string;
    projectId: string | null;
    readOnly?: boolean;
}

const CopyButton: React.FC<{ textToCopy: string; disabled?: boolean }> = ({ textToCopy, disabled }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (disabled) return;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            disabled={disabled}
            className={`h-8 w-8 rounded-[6px] bg-[#F5F5F5] border border-border-light text-primary-text hover:bg-slate-200 hover:border-primary transition-colors flex items-center justify-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
        </button>
    );
};

const IconActionButton: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}> = ({ onClick, disabled, title, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`h-8 w-8 rounded-[6px] bg-[#F5F5F5] border border-border-light text-primary-text hover:bg-slate-200 hover:border-primary transition-colors flex items-center justify-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={title}
    >
        {children}
    </button>
);

export const cleanText = (text: string): string => {
    return text.replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/__(.*?)__/g, '$1')     // Bold
        .replace(/_(.*?)_/g, '$1')       // Italic
        .replace(/`([^`]+)`/g, '$1')     // Code
        .replace(/^[\s\-\*]+/, '');      // Remove leading dashes, asterisks, and whitespace
};

export const SlideCard: React.FC<SlideCardProps> = ({ slide, slideNumber, onUpdateSlide, userId, projectId, readOnly = false }) => {
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [imageMode, setImageMode] = useState<'generate' | 'search'>('search');
    const isReadOnly = readOnly;
    const [modalOpen, setModalOpen] = useState(false);
    const [modalImageIndex, setModalImageIndex] = useState(0);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);

    // Source of Truth
    const imagePrompts = slide.imagePrompts || [];
    const allImages = slide.generatedImages || [];

    // Determine current prompt
    const currentPromptId = slide.currentPromptId && imagePrompts.some(p => p.id === slide.currentPromptId)
        ? slide.currentPromptId
        : (imagePrompts.length > 0 ? imagePrompts[0].id : undefined);
    const currentPrompt = imagePrompts.find(p => p.id === currentPromptId);
    const imagePromptText = currentPrompt?.text || '';

    const [editedPrompt, setEditedPrompt] = useState(imagePromptText);

    const [failedSearchImageIds, setFailedSearchImageIds] = useState<Set<string>>(new Set());

    const { generatedImagesForSlide, searchImagesForSlide } = useMemo(() => {
        const generated = allImages.filter(img => img.source !== 'search');
        const search = allImages.filter(img => img.source === 'search');
        return {
            generatedImagesForSlide: generated,
            searchImagesForSlide: search.slice(0, 50),
        };
    }, [allImages, currentPromptId]);

    const hasSearchResults = searchImagesForSlide.length > 0;
    const visibleSearchImages = useMemo(() => {
        return searchImagesForSlide.filter(img => !failedSearchImageIds.has(img.id));
    }, [searchImagesForSlide, failedSearchImageIds]);
    const selectedImages = useMemo(() => {
        return visibleSearchImages.filter(img => selectedImageIds.has(img.id));
    }, [visibleSearchImages, selectedImageIds]);

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

    // Sync local generating state with Firestore
    useEffect(() => {
        if (slide.promptGenerationState === 'completed' || slide.promptGenerationState === 'failed') {
            setIsGeneratingPrompt(false);
            setIsRetrying(false);
        }
    }, [slide.promptGenerationState]);

    const sanitizeFilename = (filename: string): string => {
        return filename
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 100);
    };
    const handleGenerateImage = async () => {
        if (isReadOnly) return;
        if (isGeneratingImageRef.current) return;
        if (!imagePromptText || !currentPromptId || !currentPrompt) {
            alert("No image prompt available for this slide.");
            return;
        }
        if (!projectId) {
            alert("Project is required to generate images.");
            return;
        }

        isGeneratingImageRef.current = true;
        setIsGeneratingImage(true);
        try {
            const { blob, inputTokens, outputTokens } = await generateImageFromPrompt(projectId, imagePromptText, {
                aspectRatio
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
                    generatedImages: [...allImages, generatedImage],
                    backgroundImage: generatedImage.url
                });

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

    const handleSearchImages = async () => {
        if (isReadOnly || isSearching || !projectId) return;
        if (hasSearchResults) {
            alert('Search already completed for this slide.');
            return;
        }
        setFailedSearchImageIds(new Set());
        setIsSearching(true);
        try {
            await searchImages(projectId, slide.id);
        } catch (error: any) {
            console.error('Error searching images:', error);
            const message = error?.response?.data?.error || 'Failed to search images. Please try again.';
            alert(message);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchImageError = (imageId: string) => {
        setFailedSearchImageIds(prev => {
            const next = new Set(prev);
            next.add(imageId);
            return next;
        });
        setSelectedImageIds(prev => {
            if (!prev.has(imageId)) return prev;
            const next = new Set(prev);
            next.delete(imageId);
            return next;
        });
        const updatedImages = allImages.filter(img => img.id !== imageId);
        onUpdateSlide({ generatedImages: updatedImages });
    };

    const handleSearchThumbnailError = (imageId: string) => {
        setFailedSearchImageIds(prev => {
            const next = new Set(prev);
            next.add(imageId);
            return next;
        });
    };

    const handleGeneratePrompt = async () => {
        if (isReadOnly) return;
        if (!projectId || isGeneratingPrompt) return;
        setIsGeneratingPrompt(true);
        try {
            await generatePrompt(projectId, slide.id, false);
            // State will update via Firestore listener, which triggers useEffect above
        } catch (error: any) {
            console.error('Error generating prompt:', error);
            const message = error?.response?.data?.error || 'Failed to generate prompt. Please try again.';
            alert(message);
            setIsGeneratingPrompt(false);
        }
    };

    const handleRetryPromptGeneration = async () => {
        if (isReadOnly) return;
        if (!projectId || isRetrying) return;
        setIsRetrying(true);
        try {
            await generatePrompt(projectId, slide.id, true); // regenerate = true
            // State will update via Firestore listener, which triggers useEffect above
        } catch (error: any) {
            console.error('Error retrying prompt generation:', error);
            const message = error?.response?.data?.error || 'Failed to retry prompt generation. Please try again.';
            alert(message);
            setIsRetrying(false);
        }
    };

    const handleSavePrompt = () => {
        if (isReadOnly) return;
        if (!currentPromptId) return;

        const updatedPrompts = imagePrompts.map(p =>
            p.id === currentPromptId ? { ...p, text: editedPrompt } : p
        );

        onUpdateSlide({ imagePrompts: updatedPrompts });
        setIsEditingPrompt(false);
    };


    const handleSaveContent = () => {
        if (isReadOnly) return;
        const newContent = contentText.split('\n').filter(line => line.trim() !== '');
        onUpdateSlide({ content: newContent });
        setIsEditingContent(false);
    };

    const handleCancelContentEdit = () => {
        setContentText(slide.content.join('\n'));
        setIsEditingContent(false);
    };

    useEffect(() => {
        if (isReadOnly) {
            setIsEditingContent(false);
            setIsEditingPrompt(false);
        }
    }, [isReadOnly]);

    useEffect(() => {
        if (!selectionMode) return;
        if (visibleSearchImages.length === 0) {
            setSelectionMode(false);
            setSelectedImageIds(new Set());
            return;
        }
        const visibleIds = new Set(visibleSearchImages.map(img => img.id));
        setSelectedImageIds(prev => {
            const next = new Set([...prev].filter(id => visibleIds.has(id)));
            return next;
        });
    }, [selectionMode, visibleSearchImages]);

    const handleImageClick = (index: number) => {
        if (selectionMode) return;
        setModalImageIndex(index);
        setModalOpen(true);
    };

    const handleToggleSelection = (imageId: string) => {
        setSelectedImageIds(prev => {
            const next = new Set(prev);
            if (next.has(imageId)) {
                next.delete(imageId);
            } else {
                next.add(imageId);
            }
            return next;
        });
    };

    const handleEnterSelectionMode = () => {
        setSelectionMode(true);
        setSelectedImageIds(new Set());
    };

    const handleExitSelectionMode = () => {
        setSelectionMode(false);
        setSelectedImageIds(new Set());
    };

    const handleDownloadSelected = async () => {
        if (selectedImages.length === 0 || isDownloading) return;
        if (!projectId) {
            alert('Project is required to download images.');
            return;
        }
        setIsDownloading(true);
        try {
            const filename = `slide-${slideNumber}-images-${Date.now()}.zip`;
            const payload = selectedImages.map((image, index) => ({
                url: image.url,
                name: `slide-${slideNumber}-${index + 1}`
            }));
            const zipBlob = await downloadImagesZip(projectId, payload, filename);
            const url = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download images. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handlePrimaryAction = () => {
        if (imageMode === 'search') {
            handleSearchImages();
            return;
        }

        if (imagePrompts.length === 0) {
            handleGeneratePrompt();
            return;
        }

        handleGenerateImage();
    };

    const actionLabel = imageMode === 'search'
        ? (isSearching ? 'Searching...' : hasSearchResults ? 'Search Complete' : 'Search Images')
        : imagePrompts.length === 0
            ? (isGeneratingPrompt ? 'Generating...' : 'Generate Visual Idea')
            : (isGeneratingImage ? 'Generating...' : 'Generate Image');

    const isPrimaryActionDisabled = imageMode === 'search'
        ? isSearching || hasSearchResults || !projectId
        : imagePrompts.length === 0
            ? isGeneratingPrompt || !projectId
            : isGeneratingImage || !imagePromptText;

    return (
        <div className="glass-card rounded-2xl overflow-hidden group border border-[#rgba(0,0,0,0.08)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            {/* Header */}
            <header className="p-4 sm:p-5 flex justify-between items-start border-b border-slate-100 bg-surface/50 gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                            {slideNumber === 1 ? 'Title Slide' : `Slide ${slideNumber - 1}`}
                        </span>
                        <span className="text-xs text-secondary-text uppercase tracking-wider font-semibold">{slide.layout}</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-primary-text break-words line-clamp-2">{slide.title}</h3>
                </div>
                {!isEditingContent && (
                    <div className="flex items-center gap-2">
                        <IconActionButton
                            onClick={() => {
                                if (isReadOnly) return;
                                setIsEditingContent(true);
                            }}
                            disabled={isReadOnly}
                            title={isReadOnly ? "Log in to edit and download" : "Edit Content"}
                        >
                            <PencilIcon className="h-3 w-3" />
                        </IconActionButton>
                        <CopyButton textToCopy={contentToCopy} disabled={isReadOnly} />
                    </div>
                )}
            </header>

            {/* Content Area */}
            <div className="p-6 relative group/content">
                {isEditingContent ? (
                    <div className="w-full animate-fade-in">
                        <textarea
                            ref={contentRef}
                            value={contentText}
                            onChange={e => setContentText(e.target.value)}
                            className="w-full h-full min-h-[120px] resize-none outline-none text-secondary-text leading-relaxed bg-transparent"
                        />
                        <div className="flex justify-end space-x-2 mt-3">
                            <button
                                onClick={handleCancelContentEdit}
                                disabled={isReadOnly}
                                className="px-3 py-1.5 text-xs font-medium text-secondary-text hover:text-primary-text hover:bg-slate-100 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveContent}
                                disabled={isReadOnly}
                                className={`px-3 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-md shadow-lg shadow-primary/20 transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                            <ul className="space-y-3 text-primary-text/90">
                                {slide.content.map((item, index) => (
                                    <li key={index} className="flex items-start">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-2 mr-3 flex-shrink-0"></span>
                                        <span className="leading-relaxed text-[#627C81]">{cleanText(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {!isReadOnly && (
                <footer className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                    {slide.promptGenerationState === 'failed' && (
                        <div className="flex flex-col items-center justify-center p-6 bg-red-50/50 rounded-xl border border-red-100 shadow-sm animate-fade-in">
                            <div className="flex flex-col items-center gap-2 mb-3">
                                <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Generation Failed</span>
                                <p className="text-xs text-red-500 max-w-[200px] text-center">{slide.promptGenerationError || 'Unknown error occurred'}</p>
                            </div>
                            <button
                                onClick={handleRetryPromptGeneration}
                                disabled={isRetrying}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md shadow-red-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    )}

                    {imagePrompts.length > 0 && (
                        <div className="flex items-start w-full">
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">Visual Idea</span>
                                    {!isEditingPrompt && (
                                        <div className="flex items-center gap-2">
                                            <IconActionButton
                                                onClick={() => setIsEditingPrompt(true)}
                                                title="Edit Visual Idea"
                                            >
                                                <PencilIcon className="h-3 w-3" />
                                            </IconActionButton>
                                            <CopyButton textToCopy={imagePromptText} />
                                        </div>
                                    )}
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
                                    <div className="relative flex">
                                        <div
                                            className={`flex-grow bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:border-primary/30 transition-all cursor-pointer ${!isPromptExpanded ? 'max-h-[80px] overflow-hidden' : ''}`}
                                            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                                        >
                                            <div className="prose prose-sm max-w-none text-secondary-text text-sm">
                                                <p className="whitespace-pre-wrap leading-relaxed">{imagePromptText}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {visibleSearchImages.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Search Results
                                </span>
                                {!selectionMode ? (
                                    <button
                                        type="button"
                                        onClick={handleEnterSelectionMode}
                                        className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-white border border-slate-200 text-primary hover:border-primary transition-all"
                                    >
                                        Select Images
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-semibold text-slate-600">
                                            {selectedImageIds.size} selected
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleExitSelectionMode}
                                            className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDownloadSelected}
                                            disabled={selectedImages.length === 0 || isDownloading}
                                            className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isDownloading ? 'Downloading...' : `Download (${selectedImageIds.size})`}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                {visibleSearchImages.map((img, index) => {
                                const isSearchImage = img.source === 'search';
                                const imageSrc = img.thumbnailUrl || img.url;
                                const title = isSearchImage ? 'Search result' : `Generated ${new Date(img.createdAt).toLocaleTimeString()}`;
                                const isSelected = selectedImageIds.has(img.id);
                                const shouldUseFallbackImage = failedSearchImageIds.has(img.id);
                                const resolvedImageSrc = shouldUseFallbackImage ? img.url : imageSrc;
                                return (
                                    <button
                                        key={img.id}
                                        type="button"
                                        onClick={() => {
                                            if (selectionMode) {
                                                handleToggleSelection(img.id);
                                            } else {
                                                handleImageClick(index);
                                            }
                                        }}
                                        aria-pressed={selectionMode ? isSelected : undefined}
                                        className={`flex-shrink-0 relative group/img w-16 h-16 rounded border overflow-hidden bg-white transition-colors ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-slate-200 hover:border-primary'}`}
                                        title={title}
                                    >
                                        <img
                                            src={resolvedImageSrc}
                                            alt={isSearchImage ? 'Search result' : 'Generated'}
                                            className="w-full h-full object-cover"
                                            onError={() => {
                                                if (isSearchImage) {
                                                    if (resolvedImageSrc !== img.url) {
                                                        handleSearchThumbnailError(img.id);
                                                    } else {
                                                        handleSearchImageError(img.id);
                                                    }
                                                }
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors" />
                                        {selectionMode && (
                                            <div className={`absolute top-1 right-1 h-4 w-4 rounded-full border ${isSelected ? 'bg-primary border-primary text-white' : 'bg-white/80 border-white/80 text-transparent'} flex items-center justify-center`}>
                                                <CheckIcon className="h-3 w-3" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                            </div>
                        </div>
                    )}

                    {generatedImagesForSlide.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                            {generatedImagesForSlide.map((img) => (
                                <a
                                    key={img.id}
                                    href={img.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 relative group/img w-16 h-16 rounded border border-slate-200 overflow-hidden bg-white hover:border-primary transition-colors"
                                    title={`Generated ${new Date(img.createdAt).toLocaleTimeString()}`}
                                >
                                    <img
                                        src={img.url}
                                        alt="Generated"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors" />
                                </a>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end items-center pt-2 w-full gap-2 border-t border-slate-100/50 mt-1">
                        <div className="flex items-center gap-2 mr-auto">
                            <div className="flex items-center bg-slate-100/50 p-1 rounded-lg">
                                <button
                                    onClick={() => setImageMode('search')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${imageMode === 'search'
                                        ? 'bg-white text-primary shadow-sm border border-slate-200'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Search
                                </button>
                                <button
                                    onClick={() => setImageMode('generate')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${imageMode === 'generate'
                                        ? 'bg-white text-primary shadow-sm border border-slate-200'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Generate
                                </button>
                            </div>

                            {imageMode === 'generate' && imagePrompts.length > 0 && (
                                <div className="flex items-center space-x-1 bg-slate-100/50 p-1 rounded-lg">
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
                            )}
                        </div>

                        <button
                            onClick={handlePrimaryAction}
                            disabled={isPrimaryActionDisabled}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-[#F5F5F5] hover:bg-slate-200 text-[#134252] rounded-lg text-xs font-semibold transition-all border border-border-light shadow-sm disabled:opacity-50 h-[36px]"
                        >
                            {(isGeneratingImage || isGeneratingPrompt || isSearching) ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            )}
                            <span>{actionLabel}</span>
                        </button>
                    </div>
                </footer>
            )}
            <ImageViewerModal
                images={visibleSearchImages}
                initialIndex={modalImageIndex}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </div >
    );
};
