
import { Buffer } from 'node:buffer';

async function verifyBlobLogic() {
    console.log("Verifying Base64 -> Blob logic...");

    const mockBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg=="; // 1x1 pixel text
    const mimeType = "image/png";

    try {
        let bytes: Uint8Array;

        // Logic from geminiService.ts
        if (typeof globalThis.Buffer !== 'undefined') {
            console.log("Environment: Node (Buffer available)");
            bytes = globalThis.Buffer.from(mockBase64, 'base64');
        } else {
            console.log("Environment: Browser (using atob fallback - mocked)");
            const binaryString = atob(mockBase64); // This might fail in pure Node without polyfill if not globally available
            bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
        }

        console.log(`Bytes length: ${bytes.length}`);
        if (bytes.length !== 68) { // Known length of that 1px png
            throw new Error(`Expected 68 bytes, got ${bytes.length}`);
        }

        // Blob check (Node 18+ has Blob)
        const blob = new Blob([bytes], { type: mimeType });
        console.log(`Blob created: size=${blob.size}, type=${blob.type}`);

        if (blob.size !== 68 || blob.type !== mimeType) {
            throw new Error("Blob creation failed integrity check");
        }

        console.log("✅ Blob logic verified.");

    } catch (e) {
        console.error("❌ Verification failed:", e);
        process.exit(1);
    }
}

verifyBlobLogic();
