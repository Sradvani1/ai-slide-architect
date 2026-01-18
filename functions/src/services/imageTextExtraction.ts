import { getAiClient } from '../utils/geminiClient';
// #region agent log
try {
    const testConstants = require.resolve('@shared/constants');
    fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageTextExtraction.ts:2',message:'require.resolve @shared/constants',data:{resolved:testConstants},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
} catch (e: any) {
    fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageTextExtraction.ts:2',message:'require.resolve @shared/constants failed',data:{error:e?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
}
// #endregion
import { MODEL_SLIDE_GENERATION } from '@shared/constants';
// #region agent log
fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageTextExtraction.ts:3',message:'After @shared/constants import',data:{MODEL_SLIDE_GENERATION:MODEL_SLIDE_GENERATION},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
// #endregion
// #region agent log
try {
    const testRetry = require.resolve('@shared/utils/retryLogic');
    fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageTextExtraction.ts:4',message:'require.resolve @shared/utils/retryLogic',data:{resolved:testRetry},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
} catch (e: any) {
    fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageTextExtraction.ts:4',message:'require.resolve @shared/utils/retryLogic failed',data:{error:e?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
}
// #endregion
import { retryWithBackoff } from '@shared/utils/retryLogic';
import { GeminiError } from '@shared/errors';
import { recordUsageEvent, UsageEventContext } from './usageEventsService';

export async function extractTextFromImage(
    imageBase64: string,
    mimeType: string,
    trackingContext: UsageEventContext
): Promise<{ text: string, inputTokens: number, outputTokens: number }> {

    const generateFn = async () => {
        const model = MODEL_SLIDE_GENERATION;

        try {
            const result = await getAiClient().models.generateContent({
                model: model,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: "Extract all text from this image." },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: imageBase64
                                }
                            }
                        ]
                    }
                ]
            });

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new GeminiError("No text extracted", 'INVALID_REQUEST', false);
            }
            const inputTokens = result.usageMetadata?.promptTokenCount || 0;
            const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

            await recordUsageEvent({
                ...trackingContext,
                operationKey: 'text-extraction',
                inputTokens,
                outputTokens
            });

            return {
                text: text,
                inputTokens,
                outputTokens
            };

        } catch (error: any) {
            console.error("Text extraction failed:", error);
            throw new GeminiError("Failed to extract text from image", 'API_ERROR', false, error);
        }
    };

    return retryWithBackoff(generateFn);
}
