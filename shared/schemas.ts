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
            imagePrompt: { type: "string" },
            speakerNotes: { type: "string" },
        },
        required: [
            "title",
            "content",
            "layout",
            "speakerNotes",
        ],
    },
};
