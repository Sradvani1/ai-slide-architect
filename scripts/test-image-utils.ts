
import { validateImageSpec, sanitizeImageSpec, formatImageSpec, parseGradeLevel } from '../shared/utils/imageUtils';
import { ImageSpec } from '../src/types';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

console.log("Running Image Utils Tests...\n");

// --- 1. Validate ImageSpec ---
console.log("--- validateImageSpec ---");

const validSpec: ImageSpec = {
    primaryFocal: "A happy cat",
    conceptualPurpose: "To show happiness",
    subjects: ["cat"],
    mustInclude: ["smile", "grass"],
    avoid: ["people", "text"],
    composition: {
        layout: "single-focal-subject-centered",
        viewpoint: "front",
        whitespace: "generous"
    },
    textPolicy: "NO_LABELS",
    negativePrompt: ["blur"]
};

const errors1 = validateImageSpec(validSpec);
assert(errors1.length === 0, "Valid spec should have no errors");

const invalidSpec = { ...validSpec, primaryFocal: "" };
const errors2 = validateImageSpec(invalidSpec);
assert(errors2.length > 0, "Empty primaryFocal should return error");
assert(errors2.includes("imageSpec.primaryFocal is required"), "Error message match");

// --- 2. Sanitize & Defaults ---
console.log("\n--- sanitizeImageSpec ---");

const sparseSpec: any = {
    primaryFocal: "Cat",
    // Missing composition
    // Missing textPolicy
};
const sanitized = sanitizeImageSpec(sparseSpec, "2nd Grade");

assert(sanitized.composition !== undefined, "Composition should be defaulted");
assert(sanitized.composition.layout === "single-focal-subject-centered", "Default layout");
assert(sanitized.composition.viewpoint === "child-eye-level", "2nd grade should default to child-eye-level");
assert(sanitized.textPolicy === "NO_LABELS", "Default text policy");
assert(sanitized.negativePrompt.length > 0, "Default negative prompt populated");

// --- 3. Format ---
console.log("\n--- formatImageSpec ---");

const formatted = formatImageSpec(sanitized, { gradeLevel: "2nd", subject: "Science" });
console.log("Formatted Prompt Snippet:\n", formatted.substring(0, 100) + "...");

assert(formatted.includes("Audience: 2nd grade"), "Includes audience");
assert(formatted.includes("Subject: Science"), "Includes subject");
assert(formatted.includes("Primary focus:\nCat"), "Includes focal");
assert(formatted.includes("Show:"), "Includes Show section");

// --- 4. Grade Parsing ---
console.log("\n--- parseGradeLevel ---");
assert(parseGradeLevel("Kindergarten") === 0, "Kindergarten -> 0");
assert(parseGradeLevel("10th Grade") === 10, "10th -> 10");
assert(parseGradeLevel("Sophomore") === 10, "Sophomore -> 10");
assert(parseGradeLevel("University") === 3, "Unknown -> 3 (Default)");

console.log("\nALL TESTS PASSED");
