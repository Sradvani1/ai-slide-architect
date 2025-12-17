import { GoogleGenAI } from "@google/genai";
import { defineSecret } from 'firebase-functions/params';

const apiKey = defineSecret('GEMINI_API_KEY');

let aiInstance: GoogleGenAI | null = null;

export const getAiClient = () => {
    if (aiInstance) return aiInstance;

    const key = apiKey.value();

    if (!key) {
        throw new Error("GEMINI_API_KEY secret not configured or available");
    }

    aiInstance = new GoogleGenAI({ apiKey: key });
    return aiInstance;
};

export { apiKey };
