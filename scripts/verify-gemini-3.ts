
import { GoogleGenAI } from "@google/genai";

// Standard prompt for a simple image
const PROMPT = "A cute blue robot bird sitting on a tree branch, vector art style, white background";
const MODEL = "gemini-3-pro-image-preview";

async function main() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("Error: API_KEY environment variable is not set.");
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });

    console.log(`Calling ${MODEL} with responseModalities: ['TEXT', 'IMAGE']...`);

    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: PROMPT,
            config: {
                temperature: 0.3,
                responseModalities: ["TEXT", "IMAGE"],
                imageConfig: {
                    aspectRatio: "16:9",
                    imageSize: "2K",
                } as any, // Cast to any if types are not perfectly aligned yet
            },
        });

        console.log("\n--- API Call Successful ---\n");
        console.log("Full Raw Response Structure (Depth 4):");

        // safe log function
        const printSafe = (obj: any, depth = 0) => {
            if (depth > 4) return "[Deep Object]";
            if (typeof obj !== 'object' || obj === null) return obj;

            if (Array.isArray(obj)) {
                return obj.map(item => printSafe(item, depth + 1));
            }

            const res: any = {};
            for (const key of Object.keys(obj)) {
                // Don't log huge base64 strings
                if (key === 'data' && typeof obj[key] === 'string' && obj[key].length > 100) {
                    res[key] = `[Base64 Data: ${obj[key].length} chars]`;
                } else if (key === 'inlineData' || key === 'inline_data') {
                    res[key] = printSafe(obj[key], depth + 1);
                } else {
                    res[key] = printSafe(obj[key], depth + 1);
                }
            }
            return res;
        }

        console.log(JSON.stringify(printSafe(response), null, 2));

        // Check specific extraction paths
        const candidates = (response as any).candidates;
        const firstPart = candidates?.[0]?.content?.parts?.[0];

        console.log("\n--- Extraction Check ---");
        if (firstPart) {
            console.log("Has inlineData:", !!firstPart.inlineData);
            console.log("Has inline_data:", !!firstPart.inline_data);
            console.log("MimeType:", firstPart.inlineData?.mimeType || firstPart.inline_data?.mime_type || "N/A");
        } else {
            console.error("Could not find parts in first candidate");
        }

    } catch (error: any) {
        console.error("\n--- API Call Failed ---");
        console.error(error);
    }
}

main();
