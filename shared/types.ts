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

    // State machine fields for image prompt generation
    promptGenerationState?: 'pending' | 'queued' | 'generating' | 'partial' | 'completed' | 'failed';
    promptGenerationError?: string;
    promptGenerationAttempts?: number;
    promptGenerationLastAttempt?: any; // Firestore Timestamp
    promptGenerationNextRetry?: any;   // Firestore Timestamp
    promptGenerationQueuedAt?: any;    // Firestore Timestamp

    // Partial progress tracking
    promptGenerationProgress?: {
        succeeded: number; // Count of prompts successfully generated
        failed: number;    // Count of prompts that failed after retries
        lastSuccessAt?: any;
    };
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

/**
 * Metadata for a user-uploaded file (PDF/Docx/image).
 */
export interface ProjectFile {
    id: string;
    name: string;
    storagePath: string;
    downloadUrl: string;
    mimeType: string;
    size: number;
    extractedContent?: string;
}

/**
 * Root data structure for a project document in Firestore.
 */
export interface ProjectData {
    id?: string;
    userId: string;
    title: string;
    topic: string;
    gradeLevel: string;
    subject: string;
    additionalInstructions?: string;
    slides?: Slide[]; // Usually loaded from subcollection, but kept for type completeness
    files?: ProjectFile[];

    // Token Aggregation (per project)
    textInputTokens?: number;      // Generated slides + prompt regeneration
    textOutputTokens?: number;
    imageInputTokens?: number;     // Image generation only
    imageOutputTokens?: number;

    // Cost Tracking
    totalCost?: number;            // Total USD cost

    createdAt?: any;               // Firestore Timestamp
    updatedAt?: any;               // Firestore Timestamp
    sources?: string[];
    status?: 'generating' | 'completed' | 'failed';
    generationProgress?: number;
    generationError?: string;
    generationStartedAt?: any;     // Firestore Timestamp
    generationCompletedAt?: any;   // Firestore Timestamp
}
