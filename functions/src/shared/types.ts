
export interface GeneratedImage {
    id: string;
    url: string;
    storagePath: string;
    createdAt: number;
    aspectRatio?: '16:9' | '1:1';
}

export type ImageTextPolicy = 'NO_LABELS' | 'LIMITED_LABELS_1_TO_3';

export type ImageLayout =
    | 'single-focal-subject-centered'
    | 'balanced-pair'
    | 'simple-sequence-2-panel'
    | 'comparison-split-screen'
    | 'diagram-with-flow';

export type Viewpoint =
    | 'front'
    | 'three-quarter'
    | 'side'
    | 'overhead'
    | 'child-eye-level'
    | 'side-profile'
    | 'isometric-3d-cutaway';

export type Whitespace = 'generous' | 'moderate';

export interface ImageSpec {
    // WHAT: semantic content
    primaryFocal: string;       // Single main visible concept/action
    conceptualPurpose: string;  // REQUIRED - Teaching intent
    subjects: string[];         // 2–5 concrete objects
    actions?: string[];         // 0–3 verbs
    mustInclude: string[];      // 2–6 critical visible elements
    avoid: string[];            // clutter/confusers

    // HOW: composition & layout
    composition: {
        layout: ImageLayout;
        viewpoint: Viewpoint;
        whitespace: Whitespace;
    };

    // TEXT in the image
    textPolicy: ImageTextPolicy;
    allowedLabels?: string[];     // 0–3 labels if LIMITED_LABELS_1_TO_3

    // Palette
    colors?: string[];            // 0–5 main colors

    // Additional negative constraints
    negativePrompt?: string[];    // 0–10 extra failure modes to avoid
}

export interface Slide {
    id: string; // UUID for subcollection addressing
    sortOrder: number; // For maintaining order in subcollection
    title: string;
    content: string[];

    imageSpec?: ImageSpec; // Structured image specification (Source of Truth)
    renderedImagePrompt?: string; // Deterministic prompt derived from spec (for display/API)
    generatedImages?: GeneratedImage[]; // Simple flat array of all images
    backgroundImage?: string; // URL for the generated image
    speakerNotes: string; // Required, defaults to empty string if missing
    sources?: string[];
    layout?: 'Title Slide' | 'Content' | string;
    updatedAt?: any; // Firestore Timestamp or number
}
