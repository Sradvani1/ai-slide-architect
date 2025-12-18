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
export type ImageTextPolicy = 'NO_LABELS' | 'LIMITED_LABELS_1_TO_3' | 'DIAGRAM_LABELS_WITH_LEGEND';

/** Defines the visual structure and framing of the generated image */
export type ImageLayout =
    | 'single-focal-subject-centered'
    | 'balanced-pair'
    | 'simple-sequence-2-panel'
    | 'comparison-split-screen'
    | 'diagram-with-flow';

/** Camera angle / perspective for the image */
export type Viewpoint =
    | 'front-on'           // Direct, clear (was 'front')
    | 'three-quarter'      // Standard product/object view
    | 'side-profile'       // Structure/layers
    | 'overhead'           // Layout/relationships
    | 'bird-eye-view'      // Map-like (was 'bird's-eye-view')
    | 'isometric-3d'       // 3D structure (was 'isometric-3d-cutaway')
    | 'cross-section-side' // Internal parts
    | 'flow-diagram'       // Process visualization
    | 'child-eye-level';   // Relatable perspective

/** Amount of empty space around subjects */
export type Whitespace = 'generous' | 'moderate';

export type IllustrationStyle =
    | 'flat-vector'
    | 'clean-line-diagram'
    | 'infographic'
    | 'technical-diagram';

export type LightingApproach =
    | 'technical-neutral'
    | 'even-flat'
    | 'diagram-clarity';

/**
 * Structured specification for AI image generation.
 * Acts as the "Source of Truth" for an image's content and style.
 */
export interface ImageSpec {
    // Semantic Content
    primaryFocal: string;       // Main concept or action
    conceptualPurpose: string;  // The educational intent
    subjects: string[];         // 2–5 concrete objects to include

    // 5 Core Components Additions
    visualizationDynamics?: string[]; // Verbs describing processes (e.g. "evaporating", "colliding")
    environment?: string;       // Setting/location
    contextualDetails?: string[]; // Details about the environment

    mustInclude: string[];      // Critical visible elements
    avoid: string[];            // Clutter or concepts to exclude

    // Composition & Style
    composition: {
        layout: ImageLayout;
        viewpoint: Viewpoint;
        whitespace: Whitespace;
        depthOfField?: 'sharp-throughout'; // Educational constraint
        framingRationale?: string; // Explain why this viewpoint is chosen
    };

    illustrationStyle?: IllustrationStyle;

    background?: {
        style: 'pure-white' | 'light-gray';
        texture: 'flat' | 'subtle-texture';
    };

    isEducationalDiagram?: boolean;

    lighting?: {
        approach?: LightingApproach;
    };

    // Typography
    textPolicy: ImageTextPolicy;
    allowedLabels?: string[];     // Up to 3 labels if policy permits
    labelPlacement?: string;      // e.g. "next to arrows"
    labelFont?: string;           // e.g. "bold sans-serif"

    // Grounding
    requiresGrounding?: boolean; // Trigger Google Search for factual charts/maps

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
