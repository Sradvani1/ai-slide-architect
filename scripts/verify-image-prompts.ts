import { formatImageSpec } from '../shared/utils/imageUtils';
import { ImageSpec } from '../shared/types';

const mockSpecBase: ImageSpec = {
    primaryFocal: 'robot',
    conceptualPurpose: 'Show robotics interaction',
    subjects: ['cup', 'spoon'],
    visualizationDynamics: ['pouring', 'colliding'],
    mustInclude: ['LED eyes'],
    avoid: ['blurry'],
    composition: {
        layout: 'single-focal-subject-centered',
        viewpoint: 'front-on',
        whitespace: 'generous',
        depthOfField: 'sharp-throughout'
    },
    textPolicy: 'NO_LABELS',
    colors: ['red', 'blue'],
    negativePrompt: ['darkness'],
    isEducationalDiagram: true,
    illustrationStyle: 'flat-vector',
    background: { style: 'pure-white', texture: 'flat' },
    lighting: { approach: 'technical-neutral' }
};

const testCases = [
    {
        name: "Standard Educational Diagram (History)",
        grade: "5th Grade",
        spec: {
            ...mockSpecBase,
            illustrationStyle: 'clean-line-diagram',
            composition: {
                ...mockSpecBase.composition,
                viewpoint: 'isometric-3d',
                framingRationale: 'Shows 3D structure clearly.'
            }
        },
        subject: 'History' // Should NOT have Scientific Accuracy
    },
    {
        name: "Biological Diagram (Science Subject)",
        grade: "10th Grade",
        spec: {
            ...mockSpecBase,
            primaryFocal: 'cell',
            subjects: ['nucleus', 'mitochondria'],
            illustrationStyle: 'technical-diagram',
            composition: {
                ...mockSpecBase.composition,
                viewpoint: 'cross-section-side',
                layout: 'diagram-with-flow'
            },
            lighting: { approach: 'even-flat' }
        },
        subject: 'Biology' // Trigger Scientific Accuracy
    }
] as { name: string; grade: string; spec: ImageSpec; subject?: string }[];

console.log("=== Image Prompt Generation Verification (Phase 4) ===\n");

testCases.forEach(test => {
    console.log(`--- Test Case: ${test.name} ---`);
    console.log(`Input Grade: "${test.grade}"`);
    const result = formatImageSpec(test.spec, { gradeLevel: test.grade, subject: test.subject || 'History' });

    // Check for INSTRUCTION STYLE
    if (result.includes('INSTRUCTION STYLE') && result.includes('FACTUAL DIAGRAM')) {
        console.log("   [PASS] INSTRUCTION STYLE (Factual Diagram) detected");
    } else {
        console.log("   [FAIL] INSTRUCTION STYLE missing");
    }

    // Check Background
    if (result.includes('BACKGROUND:') && result.includes('Pure white background')) {
        console.log("   [PASS] Pure white background enforcement detected");
    } else {
        console.log("   [FAIL] Background section missing or incorrect");
    }

    // Check Scientific Accuracy (Conditional)
    if (test.subject === 'Biology') {
        if (result.includes('SCIENTIFIC ACCURACY')) {
            console.log("   [PASS] Scientific Accuracy section detected for Science subject");
        } else {
            console.log("   [FAIL] Scientific Accuracy section missing for Science subject");
        }
    } else {
        if (!result.includes('SCIENTIFIC ACCURACY')) {
            console.log("   [PASS] Scientific Accuracy correctly omitted for non-science subject");
        } else {
            console.log("   [FAIL] Scientific Accuracy present for non-science subject");
        }
    }

    // Check Illustration Style
    if (result.includes('STYLE:')) {
        let styleMatch = false;
        const styleKey = test.spec.illustrationStyle;

        if (styleKey === 'flat-vector' && result.includes('Flat Vector Illustration')) styleMatch = true;
        if (styleKey === 'clean-line-diagram' && result.includes('Technical Line Diagram')) styleMatch = true;
        if (styleKey === 'infographic' && result.includes('Educational Infographic')) styleMatch = true;
        if (styleKey === 'technical-diagram' && result.includes('Scientific Technical Diagram')) styleMatch = true;

        if (styleMatch) {
            console.log(`   [PASS] Style "${styleKey}" description detected`);
        } else {
            console.log(`   [FAIL] Style description mismatch for "${styleKey}"`);
        }
    } else {
        console.log("   [FAIL] Style section missing");
    }

    // Check Lighting (Simplified)
    // Should be a single line, no complex description
    if (result.includes('LIGHTING:') && result.includes('Lighting:')) {
        console.log("   [PASS] Simplified Lighting instructions detected");
    }

    // Check Composition for "Strictness"
    if (result.includes('Composition is SIMPLE and DIRECT')) {
        console.log("   [PASS] Composition Strictness detected");
    } else {
        console.log("   [FAIL] Composition Strictness missing");
    }

    // Check Colors (Strict)
    if (result.includes('COLORS (Restricted Palette - STRICT)')) {
        console.log("   [PASS] Strict Color Constraints detected");
    } else {
        console.log("   [FAIL] Strict Color Constraints missing");
    }

    // Check Negative Prompt for Artistic Suppressors
    if (result.includes('artistic rendering') && result.includes('creative interpretation')) {
        console.log("   [PASS] Artistic Interpretation suppressors detected");
    } else {
        console.log("   [FAIL] Artistic Interpretation suppressors missing");
    }

    console.log("\n");
});
