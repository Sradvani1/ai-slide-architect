
import { formatImageSpec } from '../shared/utils/imageUtils';
import { ImageSpec } from '../shared/types';

const mockSpecBase: ImageSpec = {
    primaryFocal: 'robot',
    conceptualPurpose: 'Show robotics interaction',
    subjects: ['cup', 'spoon'],
    visualizationDynamics: ['pouring', 'collide'],
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
        name: "Elementary Grade (1st Grade)",
        grade: "1st Grade",
        spec: {
            ...mockSpecBase,
            lighting: { quality: 'soft', direction: 'side', colorTemperature: 'warm', mood: 'happy' }
        }
    },
    {
        name: "High School Grade (10th Grade)",
        grade: "10th Grade",
        spec: {
            ...mockSpecBase,
            lighting: { quality: 'soft', direction: 'side', colorTemperature: 'warm', mood: 'happy' }
        }
    },
    {
        name: "Kindergarten Detection",
        grade: "Kindergarten",
        spec: {
            ...mockSpecBase,
            lighting: { colorTemperature: 'cool' } // Should be skipped for elementary
        }
    },
    {
        name: "Whitespace Generous",
        grade: "5th Grade",
        spec: {
            ...mockSpecBase,
            composition: { ...mockSpecBase.composition, whitespace: 'generous' }
        }
    },
    {
        name: "Narrative Flow & Action Grammar",
        grade: "8th Grade",
        spec: {
            ...mockSpecBase,
            primaryFocal: 'volcano',
            subjects: ['lava', 'smoke'],
            visualizationDynamics: ['erupt', 'flow'], // specific test for "erupting", "flowing"
            environment: 'tropical island',
            contextualDetails: ['palm trees', 'ocean']
        }
    },
    {
        name: "Text Policy Diagram",
        grade: "9th Grade",
        spec: {
            ...mockSpecBase,
            textPolicy: 'DIAGRAM_LABELS_WITH_LEGEND',
            allowedLabels: ['Core', 'Mantle', 'Crust'],
            labelPlacement: 'aligned right',
            labelFont: 'Arial'
        } as ImageSpec
    }
];

console.log("=== Image Prompt Generation Verification ===\n");

testCases.forEach(test => {
    console.log(`--- Test Case: ${test.name} ---`);
    console.log(`Input Grade: "${test.grade}"`);
    const result = formatImageSpec(test.spec, { gradeLevel: test.grade, subject: 'Science' });

    // Extract key sections for validation
    const lightingMatch = result.match(/Illuminated by .*?\./);
    const compositionMatch = result.match(/COMPOSITION & CAMERA ANGLE:\n(.*)/s);
    const styleMatch = result.match(/STYLE & MEDIA:\n(.*)/s);
    const visualDescMatch = result.match(/VISUAL SCENE DESCRIPTION:\n(.*)/);
    const textPolicyMatch = result.match(/TEXT POLICY:(.*)/s);

    console.log("Visual Scene:", visualDescMatch ? visualDescMatch[1] : "NOT FOUND");

    if (lightingMatch) console.log("Lighting:", lightingMatch[0]);
    else console.log("Lighting: NOT FOUND (Expected for empty lighting or filtered)");

    if (compositionMatch) {
        // rough extract of first line of composition
        const lines = compositionMatch[1].split('\n');
        console.log("Composition (Line 1):", lines[0]);
        if (lines[0].includes('generous')) console.log("   [PASS] Generous whitespace detected");
    }

    if (styleMatch) {
        const style = styleMatch[1].split('.')[3]; // "Appropriate for..."
        console.log("Style Grade Context:", style ? style.trim() : "NOT FOUND");
        if (style && style.includes(test.grade)) console.log("   [PASS] Grade context correct");
    }

    if (test.name.includes("Elementary") || test.name.includes("Kindergarten")) {
        if (lightingMatch && !lightingMatch[0].includes("color temperature")) {
            console.log("   [PASS] Color temperature correctly omitted for elementary");
        } else if (lightingMatch && lightingMatch[0].includes("color temperature")) {
            console.log("   [FAIL] Color temperature included for elementary!");
        }
    }

    if (test.name.includes("High School")) {
        if (lightingMatch && lightingMatch[0].includes("color temperature")) {
            console.log("   [PASS] Color temperature included for high school");
        }
    }

    if (test.spec.textPolicy === 'DIAGRAM_LABELS_WITH_LEGEND') {
        const textSection = result.split('TEXT POLICY:')[1].split('\n\n')[0];
        console.log("Text Policy Output:\n", textSection.trim());
    }

    console.log("\n");
});
