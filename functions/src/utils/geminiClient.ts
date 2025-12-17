import { GoogleGenAI } from "@google/genai";
import * as functions from 'firebase-functions';

const GEMINI_API_KEY = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
}

export const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
