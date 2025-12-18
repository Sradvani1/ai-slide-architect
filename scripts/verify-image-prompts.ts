
import { formatImageSpec } from '../shared/utils/imageUtils';
import { ImageSpec } from '../shared/types';

const mockSpecBase: ImageSpec = {
    primaryFocal: 'robot',
    conceptualPurpose: 'Show robotics interaction',
    subjects: ['cup', 'spoon'],
    visualizationDynamics: ['pouring', 'colliding'], // Using gerunds as instructed
    mustInclude: ['LED eyes'],
    avoid: ['blurry'],
    composition: {
        layout: 'single-focal-subject-centered',
        viewpoint: 'front',
        whitespace: 'moderate'
    },
    textPolicy: 'NO_LABELS',
    colors: ['red', 'blue'],
    negativePrompt: ['darkness']
};

const testCases = [
    {
        name: "Elementary Grade (1st Grade) - Allowed Color Temp",
        grade: "1st Grade",
        spec: {
            ...mockSpecBase,
            lighting: { quality: 'soft', direction: 'side', colorTemperature: 'warm', mood: 'happy' }
        }
    },
    {
        name: "Pedagogical Framing & Generous Whitespace",
        grade: "5th Grade",
        spec: {
            ...mockSpecBase,
            composition: {
                ...mockSpecBase.composition,
                whitespace: 'generous',
                framingRationale: 'This angle best shows the pouring mechanism clearly to students.'
            }
        }
    },
    {
        name: "Narrative Flow & 'Featuring'",
        grade: "8th Grade",
        spec: {
            ...mockSpecBase,
            primaryFocal: 'volcano',
            subjects: ['lava', 'smoke'],
            visualizationDynamics: ['erupting', 'flowing'],
            environment: 'tropical island',
            contextualDetails: ['palm trees', 'ocean']
        }
    }
] as { name: string; grade: string; spec: ImageSpec }[];

console.log("=== Image Prompt Generation Verification (Phase 2) ===\n");

testCases.forEach(test => {
    console.log(`--- Test Case: ${test.name} ---`);
    console.log(`Input Grade: "${test.grade}"`);
    const result = formatImageSpec(test.spec, { gradeLevel: test.grade, subject: 'Science' });

    // Check for Separators
    if (result.includes('\n\n---\n\n')) {
        console.log("   [PASS] Section separators (---) detected");
    } else {
        console.log("   [FAIL] Section separators missing");
    }

    // Check for Safety Terms in Negative Prompt
    const negPromptMatch = result.match(/NEGATIVE PROMPT:\n(.*)/s);
    if (negPromptMatch) {
        if (negPromptMatch[1].includes('blurry') && negPromptMatch[1].includes('low-resolution')) {
            console.log("   [PASS] Educational safety terms detected in Negative Prompt");
        } else {
            console.log("   [FAIL] Educational safety terms missing");
        }
    } else {
        console.log("   [FAIL] Negative Prompt block missing");
    }

    // Extract key sections for validation
    const visualDescMatch = result.match(/VISUAL SCENE DESCRIPTION:\n(.*)/);
    const lightingMatch = result.match(/Illuminated by .*?\./);
    const compositionMatch = result.match(/COMPOSITION & CAMERA ANGLE:\n(.*?)(?=\n\n---\n\n|$)/s);

    console.log("Visual Scene:", visualDescMatch ? visualDescMatch[1] : "NOT FOUND");

    if (lightingMatch) {
        console.log("Lighting:", lightingMatch[0]);
        if (test.name.includes("Elementary") && lightingMatch[0].includes("color temperature")) {
            console.log("   [PASS] Color temperature correctly included (allowed for all grades)");
        }
    }

    if (compositionMatch) {
        const compText = compositionMatch[1].trim();
        console.log("Composition Section (excerpt):", compText.split('\n')[0] + "...");

        if (test.spec.composition.whitespace === 'generous') {
            if (compText.includes('generous negative space')) console.log("   [PASS] Generous whitespace detected");
            else console.log("   [FAIL] Generous whitespace text missing");
        }

        if (test.spec.composition.framingRationale) {
            if (compText.includes('PEDAGOGICAL FRAMING') && compText.includes(test.spec.composition.framingRationale)) {
                console.log("   [PASS] Pedagogical Framing detected and matches rationale");
            } else {
                console.log("   [FAIL] Pedagogical Framing missing or incorrect");
                console.log("   Actual:", compText);
            }
        }
    }

    // Check for "featuring" in location (if relevant)
    if (test.spec.contextualDetails && test.spec.contextualDetails.length > 0) {
        if (visualDescMatch && visualDescMatch[1].includes('featuring')) {
            console.log("   [PASS] 'featuring' keyword used for contextual details");
        } else {
            console.log("   [FAIL] 'featuring' keyword missing");
        }
    }

    console.log("\n");
});
