export const IMAGE_SPEC_SCHEMA = {
    type: "object",
    properties: {
        primaryFocal: {
            type: "string",
            description: "One-sentence description of the main visual subject."
        },
        conceptualPurpose: {
            type: "string",
            description: "The educational goal: what concept should the student understand from this image?"
        },
        subjects: {
            type: "array",
            items: { type: "string" },
            description: "2-5 concrete visual elements.",
        },
        visualizationDynamics: {
            type: "array",
            items: { type: "string" },
            description: "Verbs describing processes (e.g. 'evaporating', 'colliding').",
        },
        environment: {
            type: "string",
            description: "Setting or location of the visualization.",
        },
        contextualDetails: {
            type: "array",
            items: { type: "string" },
            description: "Details about the environment.",
        },
        mustInclude: {
            type: "array",
            items: { type: "string" },
            description: "2-6 essential details.",
        },
        avoid: {
            type: "array",
            items: { type: "string" },
            description: "Elements to exclude to prevent confusion.",
        },
        composition: {
            type: "object",
            properties: {
                layout: {
                    type: "string",
                    enum: [
                        "single-focal-subject-centered",
                        "balanced-pair",
                        "simple-sequence-2-panel",
                        "comparison-split-screen",
                        "diagram-with-flow",
                    ],
                },
                viewpoint: {
                    type: "string",
                    enum: [
                        "front",
                        "three-quarter",
                        "side",
                        "overhead",
                        "macro-close-up",
                        "dutch-angle",
                        "child-eye-level",
                        "side-profile",
                        "isometric-3d-cutaway",
                        "bird's-eye-view",
                    ],
                },
                whitespace: {
                    type: "string",
                    enum: ["generous", "moderate"],
                },
                depthOfField: {
                    type: "string",
                    enum: ["shallow", "deep"],
                },
                framingRationale: {
                    type: "string",
                    description: "Why this viewpoint is chosen.",
                },
            },
            required: ["layout", "viewpoint", "whitespace"],
        },
        lighting: {
            type: "object",
            properties: {
                quality: { type: "string" },
                direction: { type: "string" },
                colorTemperature: { type: "string" },
                mood: { type: "string" },
            },
        },
        textPolicy: {
            type: "string",
            enum: ["NO_LABELS", "LIMITED_LABELS_1_TO_3", "DIAGRAM_LABELS_WITH_LEGEND"],
        },
        allowedLabels: {
            type: "array",
            items: { type: "string" },
        },
        labelPlacement: { type: "string" },
        labelFont: { type: "string" },
        requiresGrounding: { type: "boolean" },
        colors: {
            type: "array",
            items: { type: "string" },
            description: "3-5 key colors.",
        },
        negativePrompt: {
            type: "array",
            items: { type: "string" },
        },
    },
    required: [
        "primaryFocal",
        "conceptualPurpose",
        "subjects",
        "mustInclude",
        "avoid",
        "composition",
        "textPolicy",
    ],
};

export const SLIDES_SCHEMA = {
    type: "array",
    items: {
        type: "object",
        properties: {
            title: { type: "string" },
            content: {
                type: "array",
                items: { type: "string" },
            },
            layout: {
                type: "string",
                enum: ["Title Slide", "Content"],
            },
            imageSpec: IMAGE_SPEC_SCHEMA,
            speakerNotes: { type: "string" },
            sources: {
                type: "array",
                items: { type: "string" },
            },
        },
        required: [
            "title",
            "content",
            "layout",
            "imageSpec",
            "speakerNotes",
        ],
    },
};
