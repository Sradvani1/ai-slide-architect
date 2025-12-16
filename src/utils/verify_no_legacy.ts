
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../../src');

const FORBIDDEN_TERMS = [
    { term: 'imagePrompt', exclude: ['verify_no_legacy.ts', 'constants.ts'] }, // Allow in constants if just mapping keys, but strict elsewhere
    { term: 'Legacy format', exclude: ['verify_no_legacy.ts'] },
    { term: 'slide.prompts', exclude: ['verify_no_legacy.ts'] },
    { term: 'interface ImagePrompt {', exclude: ['verify_no_legacy.ts'] } // The old interface definition
];

// Files to skip completely
const IGNORE_FILES = [
    'verify_no_legacy.ts',
    '.DS_Store'
];

let foundLegacy = false;

function scanDirectory(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else {
            if (IGNORE_FILES.includes(file) || !file.match(/\.(ts|tsx)$/)) continue;

            const content = fs.readFileSync(fullPath, 'utf-8');

            FORBIDDEN_TERMS.forEach(({ term, exclude }) => {
                if (exclude && exclude.includes(file)) return;

                if (content.includes(term)) {
                    // Double check it's not a comment? simpler to just forbid it entirely.
                    // We want strict zero compat.
                    console.error(`[FAIL] Found forbidden term "${term}" in ${fullPath}`);
                    foundLegacy = true;
                }
            });
        }
    }
}

console.log("🔒 Scanning for legacy code artifacts...");
scanDirectory(ROOT_DIR);

if (foundLegacy) {
    console.error("\n❌ Legacy code detected! The build is strictly zero-backward-compatible.");
    process.exit(1);
} else {
    console.log("✅ No legacy code found. Pipeline clean.");
    process.exit(0);
}
