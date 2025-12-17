import { GoogleGenAI } from "@google/genai";
import * as functions from 'firebase-functions';

let aiInstance: GoogleGenAI | null = null;

export const getAiClient = () => {
    if (aiInstance) return aiInstance;

    const GEMINI_API_KEY = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    aiInstance = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    return aiInstance;
};
