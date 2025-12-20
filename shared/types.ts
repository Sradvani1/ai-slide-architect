/**
 * Metadata for a generated image asset stored in Firebase Storage.
 */
export interface GeneratedImage {
    id: string;
    url: string;
    storagePath: string;
    createdAt: number;
    aspectRatio?: '16:9' | '1:1';
    inputTokens?: number;
    outputTokens?: number;
    promptId: string; // Maps image to specific prompt
}

/**
 * Represents a single image prompt idea.
 */
export interface ImagePrompt {
    id: string;
    text: string;
    createdAt: number;
    isOriginal?: boolean; // True for prompts generated during initial slide creation
    inputTokens?: number;
    outputTokens?: number;
}

/**
 * Represents a single slide within a presentation deck.
 */
export interface Slide {
    id: string;
    sortOrder: number;
    title: string;
    content: string[];

    imagePrompts?: ImagePrompt[];     // Array of prompts with history
    currentPromptId?: string;         // ID of currently selected/active prompt
    generatedImages?: GeneratedImage[]; // History of images for this slide
    backgroundImage?: string;          // Current active image URL
    speakerNotes: string;
    layout?: 'Title Slide' | 'Content' | string;
    aspectRatio?: '16:9' | '1:1';
    updatedAt?: any;                   // Firestore Timestamp
}

/**
 * Represents pricing for a specific AI model.
 */
export interface ModelPricing {
    id: string;                    // Model identifier (e.g., "gemini-1.5-flash")
    modelName: string;             // Display name
    modelType: 'text' | 'image';   // Operation type
    inputPricePer1MTokens: number; // Price per 1M input tokens (in USD)
    outputPricePer1MTokens: number;// Price per 1M output tokens (in USD)
    effectiveDate: number;         // Timestamp when pricing became effective
    isActive: boolean;             // Whether this pricing is currently active
    createdAt: number;
    updatedAt: number;
}
