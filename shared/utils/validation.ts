export function validateSlideStructure(slide: any, idx: number): string[] {
    const errors: string[] = [];
    if (typeof slide !== 'object' || slide === null) {
        return [`Slide ${idx + 1}: Invalid object`];
    }

    // Required keys
    const required = ['title', 'content', 'speakerNotes', 'imageSpec']; // imageSpec IS required now for all slides
    // Strict checking for top-level keys


    required.forEach(key => {
        if (!(key in slide)) errors.push(`Slide ${idx + 1}: Missing '${key}'`);
    });

    // Type checks
    if (typeof slide.title !== 'string') errors.push(`Slide ${idx + 1}: 'title' must be a string`);
    if (!Array.isArray(slide.content)) errors.push(`Slide ${idx + 1}: 'content' must be an array`);
    if (typeof slide.layout !== 'string') errors.push(`Slide ${idx + 1}: 'layout' must be a string`);

    // Enum check
    if (slide.layout && !["Title Slide", "Content"].includes(slide.layout)) {
        errors.push(`Slide ${idx + 1}: Invalid layout '${slide.layout}'`);
    }

    return errors;
}
