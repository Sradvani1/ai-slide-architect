export function validateSlideStructure(slide: unknown, idx: number): string[] {
    const errors: string[] = [];
    if (typeof slide !== 'object' || slide === null) {
        return [`Slide ${idx + 1}: Invalid object`];
    }

    const slideObj = slide as Record<string, unknown>;

    // Required keys
    const required = ['title', 'content', 'speakerNotes'];

    required.forEach(key => {
        if (!(key in slideObj)) errors.push(`Slide ${idx + 1}: Missing '${key}'`);
    });

    // Type checks
    if (typeof slideObj.title !== 'string') errors.push(`Slide ${idx + 1}: 'title' must be a string`);
    if (!Array.isArray(slideObj.content)) errors.push(`Slide ${idx + 1}: 'content' must be an array`);
    if (slideObj.layout && typeof slideObj.layout !== 'string') errors.push(`Slide ${idx + 1}: 'layout' must be a string`);

    // Enum check
    if (typeof slideObj.layout === 'string' && !["Title Slide", "Content"].includes(slideObj.layout)) {
        errors.push(`Slide ${idx + 1}: Invalid layout '${slideObj.layout}'`);
    }

    return errors;
}
