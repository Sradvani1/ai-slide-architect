/**
 * Metadata for a generated image asset stored in Firebase Storage.
 */
export interface GeneratedImage {
    id: string;
    url: string;
    storagePath: string;
    createdAt: number;
    aspectRatio?: '16:9' | '1:1';
}

/** Controls how the AI generator handles text/labels within the image */
export type ImageTextPolicy = 'NO_LABELS' | 'LIMITED_LABELS_1_TO_3';

/** Defines the visual structure and framing of the generated image */
export type ImageLayout =
    | 'single-focal-subject-centered'
    | 'balanced-pair'
    | 'simple-sequence-2-panel'
    | 'comparison-split-screen'
    | 'diagram-with-flow';

/** Camera angle / perspective for the image */
export type Viewpoint =
    | 'front'
    | 'three-quarter'
    | 'side'
    | 'overhead'
    | 'child-eye-level'
    | 'side-profile'
    | 'isometric-3d-cutaway'
    | 'bird\'s-eye-view';

/** Amount of empty space around subjects */
export type Whitespace = 'generous' | 'moderate';

/**
 * Structured specification for AI image generation.
 * Acts as the "Source of Truth" for an image's content and style.
 */
export interface ImageSpec {
    // Semantic Content
    primaryFocal: string;       // Main concept or action
    conceptualPurpose: string;  // The educational intent
    subjects: string[];         // 2–5 concrete objects to include
    actions?: string[];         // Optional verbs/actions
    mustInclude: string[];      // Critical visible elements
    avoid: string[];            // Clutter or concepts to exclude

    // Composition & Style
    composition: {
        layout: ImageLayout;
        viewpoint: Viewpoint;
        whitespace: Whitespace;
    };

    // Typography
    textPolicy: ImageTextPolicy;
    allowedLabels?: string[];     // Up to 3 labels if policy permits

    // Presentation
    colors?: string[];            // Primary color palette
    negativePrompt?: string[];    // Explicit failure modes to avoid
}

/**
 * Represents a single slide within a presentation deck.
 */
export interface Slide {
    id: string;
    sortOrder: number;
    title: string;
    content: string[];

    imageSpec?: ImageSpec;             // The structural visual idea
    renderedImagePrompt?: string;      // The actual string sent to the AI
    generatedImages?: GeneratedImage[]; // History of images for this slide
    backgroundImage?: string;          // Current active image URL
    speakerNotes: string;
    sources?: string[];
    layout?: 'Title Slide' | 'Content' | string;
    aspectRatio?: '16:9' | '1:1';
    updatedAt?: any;                   // Firestore Timestamp
}
