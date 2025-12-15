
import { GoogleGenAI } from "@google/genai";
import type { Slide } from '../types';
import { DEFAULT_TEMPERATURE, DEFAULT_BULLETS_PER_SLIDE } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });


/**
 * Standardized Error Surface for Gemini Interactions
 * Distinguishes between retryable failures (network/rate limits) and permanent errors (invalid requests).
 */
export class GeminiError extends Error {
  constructor(
    message: string,
    public code: 'TIMEOUT' | 'RATE_LIMIT' | 'BUSY' | 'CIRCUIT_OPEN' | 'INVALID_REQUEST' | 'API_ERROR' | 'UNKNOWN',
    public isRetryable: boolean,
    public details?: any
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/**
 * Load Limiter & Circuit Breaker
 * Manages concurrency to stay within API limits and fast-fails during outages.
 */
class RateLimiter {
  private concurrentRequests = 0;
  private maxConcurrent = 5; // Simple in-process limit
  private failureCount = 0;
  private lastFailureTime = 0;
  private circuitOpen = false;
  private CHECK_WINDOW_MS = 60000;
  private FAILURE_THRESHOLD = 5;
  private RESET_TIMEOUT_MS = 30000;

  async acquire() {
    if (this.circuitOpen) {
      if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT_MS) {
        this.circuitOpen = false;
        this.failureCount = 0; // Half-open/reset
      } else {
        throw new GeminiError("Service temporarily unavailable (Circuit Breaker Open)", 'CIRCUIT_OPEN', false);
      }
    }

    if (this.concurrentRequests >= this.maxConcurrent) {
      throw new GeminiError("Service busy (Max Concurrency Reached)", 'BUSY', true);
    }
    this.concurrentRequests++;
  }

  release() {
    this.concurrentRequests = Math.max(0, this.concurrentRequests - 1);
  }

  recordFailure(isRetryable: boolean) {
    if (isRetryable) { // Only track retryable errors (load/5xx) for circuit breaking
      const now = Date.now();
      // Reset failure count if outside the check window (sliding window effect)
      if (now - this.lastFailureTime > this.CHECK_WINDOW_MS) {
        this.failureCount = 0;
      }

      this.failureCount++;
      this.lastFailureTime = now;

      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.circuitOpen = true;
        console.warn("Circuit Breaker OPENED due to high failure rate.");
      }
    }
  }

  recordSuccess() {
    this.failureCount = 0;
    this.circuitOpen = false;
  }
}

const rateLimiter = new RateLimiter();

/**
 * Strict Runtime Validator
 * Enforces schema compliance beyond basic JSON parsing.
 */
function validateSlideStructure(slide: any, idx: number): string[] {
  const errors: string[] = [];
  if (typeof slide !== 'object' || slide === null) {
    return [`Slide ${idx + 1}: Invalid object`];
  }

  // Required keys
  const required = ['title', 'content', 'layout', 'imagePrompt', 'speakerNotes'];
  required.forEach(key => {
    if (!(key in slide)) errors.push(`Slide ${idx + 1}: Missing '${key}'`);
  });

  // Type checks
  if (typeof slide.title !== 'string') errors.push(`Slide ${idx + 1}: 'title' must be a string`);
  if (!Array.isArray(slide.content)) errors.push(`Slide ${idx + 1}: 'content' must be an array`);
  if (typeof slide.layout !== 'string') errors.push(`Slide ${idx + 1}: 'layout' must be a string`);

  // Enum check
  if (slide.layout && !["Title Slide", "Content"].includes(slide.layout)) {
    errors.push(`Slide ${idx + 1}: Invalid layout '${slide.layout}'`);
  }

  return errors;
}

// Rate limit / Retrying utilities
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;
const TIMEOUT_MS = 120000; // 2 minutes total timeout

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = INITIAL_DELAY_MS, deadline?: number): Promise<T> {
  // Set deadline on first call
  if (!deadline) {
    deadline = Date.now() + TIMEOUT_MS;
  }

  // Check deadline BEFORE acquire to avoid unnecessary locking
  const now = Date.now();
  if (now > deadline) {
    throw new GeminiError(`Request timed out after ${TIMEOUT_MS}ms`, 'TIMEOUT', false);
  }

  await rateLimiter.acquire();

  let timeoutId: any = null;

  try {
    // Per-attempt timeout: Race the function against the remaining time (clamped to 250ms min)
    const timeRemaining = deadline - now;

    // Safety: If not enough time to make a meaningful attempt, fail fast.
    if (timeRemaining < 250) {
      throw new GeminiError('Global deadline exceeded (insufficient time for attempt)', 'TIMEOUT', false);
    }

    const attemptTimeout = timeRemaining; // Use exact remaining time, do not extend

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new GeminiError('Request timed out', 'TIMEOUT', true)), attemptTimeout);
    });

    const result = await Promise.race([fn(), timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    rateLimiter.recordSuccess();
    rateLimiter.release();
    return result;

  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    // Normalize error message for consistent checks
    const errorMessage = (error?.message || '').toLowerCase();

    // Check for Payload/Context errors - DO NOT RETRY - release and throw
    if (errorMessage.includes('context length') || errorMessage.includes('token limit') || errorMessage.includes('payload too large') || error.status === 400) {
      rateLimiter.recordFailure(false); // Record, but not as "retryable" circuit breaker failure
      rateLimiter.release();
      // Wrap in GeminiError if not already
      if (error instanceof GeminiError) throw error;
      throw new GeminiError(error.message, 'INVALID_REQUEST', false, error);
    }

    // Broaden retryable status checks
    const status = error?.status || error?.response?.status;
    const isRetryable =
      (error instanceof GeminiError && error.isRetryable) || // Respect our own internal flags
      status === 429 ||
      status === 503 ||
      status === 500 ||
      status === 502 ||
      status === 504 ||
      status === 408 ||
      errorMessage.includes('429') ||
      errorMessage.includes('503') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnreset');

    rateLimiter.recordFailure(isRetryable); // Track for circuit breaker
    rateLimiter.release(); // Release slot before waiting/retrying

    if (!isRetryable) {
      if (error instanceof GeminiError) throw error;
      throw new GeminiError(error.message, 'API_ERROR', false, error);
    }

    // Smart Retry Logic (Hints + Deadline Cap)
    let nextDelay: number;

    if (error?.retryDelay) {
      // Authoritative hint: Use it directly + jitter
      nextDelay = error.retryDelay + (Math.random() * 200);
    } else {
      // Exponential Backoff
      nextDelay = Math.min(delay * 2, MAX_DELAY_MS) + (Math.random() * 200);
    }

    // Cap delay to remaining deadline time
    // We already released the limiter, so we can sleep safely without holding a slot.
    const timeNow = Date.now();
    const timeLeft = deadline - timeNow;

    // Safety check: if time left is too small to reasonably retry, fail now
    if (timeLeft < 500) {
      throw new GeminiError("Deadline exceeded/insufficient time for retry", 'TIMEOUT', false);
    }

    // Adjust delay if it exceeds remaining time (minus buffer)
    if (nextDelay > (timeLeft - 500)) {
      nextDelay = timeLeft - 500;
    }

    console.warn(`Retrying Gemini request... Attempts left: ${retries}. Delay: ${Math.round(nextDelay)}ms. Deadline in: ${Math.round(timeLeft)}ms`);
    await new Promise(resolve => setTimeout(resolve, nextDelay));

    return retryWithBackoff(fn, retries - 1, nextDelay, deadline);
  }
}
const IMAGE_STYLE_GUIDE = `
Visual Style Guidelines:
- Art Style: Flat vector-style educational illustration. Supplementary visual aid. Professional, clean lines.
- Background: Clean white background. No scenic backgrounds or visual clutter.
- Color & Contrast: High contrast, distinct colors optimized for classroom presentation.
- Text: usage should be minimal and limited to basic labels and simple words.
`;

// Helper to extract JSON array safely
function extractFirstJsonArray(text: string): any[] {
  // 1. Remove ALL code fences to avoid confusion
  // Note: We do NOT globally strip fences/backticks, as they might appear validly inside JSON strings.
  // The scanner below is robust enough to find the array boundaries.
  const cleanText = text.trim();

  // 2. Scan for top-level JSON array that looks like valid slide data
  // Look for the first '[' that is followed eventually by a '{'
  let firstBracket = -1;
  for (let i = 0; i < cleanText.length; i++) {
    if (cleanText[i] === '[') {
      // Check if there's a '{' before any closing ']' (naive check but effective for this schema)
      const nextOpenBrace = cleanText.indexOf('{', i);
      const nextCloseBracket = cleanText.indexOf(']', i);

      if (nextOpenBrace !== -1 && (nextCloseBracket === -1 || nextOpenBrace < nextCloseBracket)) {
        firstBracket = i;
        break;
      }
    }
  }

  if (firstBracket === -1) {
    // Fallback: Just look for first '[' if the stricter check fails
    firstBracket = cleanText.indexOf('[');
    if (firstBracket === -1) {
      throw new Error("No JSON array found in response");
    }
  }

  // 3. Simple bracket matching to find the end
  let openCount = 0;
  let endIndex = -1;
  let inString = false;
  let escape = false;

  for (let i = firstBracket; i < cleanText.length; i++) {
    const char = cleanText[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '[') {
        openCount++;
      } else if (char === ']') {
        openCount--;
        if (openCount === 0) {
          endIndex = i;
          break;
        }
      }
    }
  }

  if (endIndex === -1) {
    // Attempt parse from start to end of string if matching failed
    try {
      return JSON.parse(cleanText.substring(firstBracket));
    } catch {
      throw new Error("Found start of JSON array but could not find matching end bracket");
    }
  }

  const jsonString = cleanText.substring(firstBracket, endIndex + 1);

  // 4. Attempt parse
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("JSON Parse Error Snippet:", jsonString.substring(0, 300));
    throw new Error("Failed to parse extracted JSON array");
  }
}

export const generateSlidesFromDocument = async (
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string,
  numSlides: number,
  useWebSearch: boolean = false,
  temperature: number = DEFAULT_TEMPERATURE,
  bulletsPerSlide: number = DEFAULT_BULLETS_PER_SLIDE,
  additionalInstructions: string = ''
): Promise<{
  slides: Slide[],
  inputTokens: number,
  outputTokens: number,
  sources: Array<{ uri: string; title?: string }>,
  searchEntryPoint?: string,
  webSearchQueries?: string[],
  warnings: string[]
}> => {
  const totalSlides = numSlides + 1;

  // 1. SYSTEM ROLE & OBJECTIVE
  let prompt = `
    You are an expert educational content creator and curriculum designer.
    Your goal is to generate a professional, engaging slide deck that is perfectly tailored to the specified grade level.
  `;

  // 2. INPUT CONTEXT
  prompt += `
  PRESENTATION CONTEXT
  Topic: "${topic}"
  Subject: ${subject}
  Target Audience: ${gradeLevel}
  Length: ${totalSlides} slides (1 Title + ${numSlides} Content)
  ${additionalInstructions ? `- Additional Instructions: "${additionalInstructions}"` : ''}
  `;

  // 3. SOURCE MATERIAL / RESEARCH (Mutually Exclusive Logic)
  if (sourceMaterial) { // Curator Mode
    prompt += `
    SOURCE MATERIAL (GROUND TRUTH)
      You must derive your content ENTIRELY from the following text. Do not contradict it.
    
    SOURCE BEGIN:
    ${sourceMaterial}
    SOURCE END
  `;
  } else if (useWebSearch) { // Researcher Mode
    prompt += `
    RESEARCH PHASE (REQUIRED)
    Since no source material is provided, you MUST use Google Search to act as the primary content researcher.
    
    INSTRUCTIONS
    1. Find Content: Search for high-quality, age-appropriate information to build the core content of these slides.
    2. Curate Sources: Select the best, most reliable references (URLs) that a teacher would value.
    3. Synthesize: Use these search results as the SOLE source of truth for the presentation.
    `;
  }

  // 4. CONTENT GENERATION STANDARDS
  prompt += `
  CONTENT STANDARDS
    1. Educational Value: Content must be accurate, age-appropriate, and pedagogically sound.
    2. Clarity: Use clear, concise language.
    3. Engagement: Speaker notes should be engaging and conversational (script format).
    4. Citations: You MUST include a "Sources:" section at the very end of the speaker notes. List all used URLs (if Web Search) or filenames (if uploaded text).
  `;

  // 5. STRUCTURE REQUIREMENTS
  prompt += `
  STRUCTURE REQUIREMENTS
    - Slide 1: Title Slide. "title": Presentation Title. "content" array must be: ["<tagline>", "${subject}", "${gradeLevel}"].
    - Slides 2-${totalSlides}: Content Slides (Title, Content, Image Prompt, Speaker Notes, Sources).
  `;

  // 6. FORMATTING CONSTRAINTS (CRITICAL)
  prompt += `
  FORMATTING CONSTRAINTS(CRITICAL)
    - Bullets: Exactly ${bulletsPerSlide} bullet points per content slide.
    - No Markdown: Bullet points must be plain strings. NO bold (**), italics (*), or bullet characters (-) in the string itself.
  `;

  // 7. IMAGE PROMPTING GUIDELINES
  prompt += `
  IMAGE PROMPTING GUIDELINES (JOB: WRITE INPUT FOR AN AI IMAGE GENERATOR)
    0. Role: You are not drawing. You are writing a description for an AI image generator.
    1. Content Alignment: The image must directly illustrate the "Content" provided above.
    2. Visual Description ONLY: Focus strictly on visible objects, actions, and settings.
    3. NO Complex Diagrams: Avoid charts, graphs, and schematics. Describe tangible objects, scenes, or actions.
    4. Target Audience: Ensure visual complexity is appropriate for ${gradeLevel} students.
    5. NO Style Instructions: Do not include words like "photorealistic", "cinematic", "3d render", "cartoon".
    6. Simplicity: Keep the scene uncluttered. Do not describe the background. 
  `;

  // 8. OUTPUT SCHEMA
  // Defined in responseSchema below, but mentioned here for context if needed (though implicit in structured output)

  const slidesSchema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: {
          type: "array",
          items: { type: "string" }
        },
        layout: {
          type: "string",
          enum: ["Title Slide", "Content"]
        },
        imagePrompt: { type: "string" },
        speakerNotes: {
          type: "string",
          description: "Conversational script explaining the slide content. **IMPORTANT:** At the very end, add a section titled 'Sources:'. List full URLs of websites used or filenames of uploaded documents. If only general knowledge is used, omit this section."
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "List of source URLs used for this slide if web search was enabled."
        },
      },
      required: ["title", "content", "layout", "imagePrompt", "speakerNotes"],
    },
  };

  try {
    const tools: any[] = [];
    const isUsingWebSearchTool = useWebSearch && !sourceMaterial;

    if (isUsingWebSearchTool) {
      tools.push({ googleSearch: {} });
    }

    const config: any = {
      temperature: temperature,
      tools: tools.length > 0 ? tools : undefined,
    };

    // Conditional Configuration:
    // If using Web Search tool, DO NOT use responseSchema/json mode to avoid incompatibility.
    // Instead, rely on prompt instructions for JSON.
    if (isUsingWebSearchTool) {
      prompt += `
      OUTPUT FORMAT
      Return a valid JSON array of objects.Do not include markdown code fences(like \`\`\`json).
      JSON Structure:
      [
        {
          "title": "string",
          "content": ["string", "string", ...], 
          "layout": "Title Slide" | "Content",
          "imagePrompt": "string",
          "speakerNotes": "string (Script + 'Sources:' section at the end with URLs/filenames)",
          "sources": ["url1", "url2"]
        }
      ]
      `;
    } else {
      // Use Structured Outputs for non-tool calls
      config.responseMimeType = "application/json";
      config.responseSchema = slidesSchema;
    }

    // Generate Content with Retry
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: config,
    }));

    let slides: Slide[];
    const warnings: string[] = []; // Declare early for use in repair logic

    if (isUsingWebSearchTool) {
      // Use safe extractor for Web Search mode
      try {
        slides = extractFirstJsonArray(response.text) as Slide[];
      } catch (e) {
        console.warn("JSON extraction failed, attempting Repair Pass...", e);

        // Repair Pass: Ask the model to fix the JSON using structured output
        try {
          // We can use a lightweight call here or the same model
          const repairConfig = {
            responseMimeType: "application/json",
            responseSchema: slidesSchema,
            temperature: 0.1 // Low temp for repair
          };

          // Robust Repair Extraction
          // Attempt to locate JSON boundaries even if the model returned conversational text.
          let errorContext = response.text;

          try {
            // Just use the extractor to verify we can parse it, but we actually want the STRING for the repair prompt.
            // We'll trust extractFirstJsonArray to find the boundaries if we use it with a specialized mode,
            // or we can just try to extract the array directly and if it works, GREAT, we don't need repair!
            // But if we are here, strict extraction *failed* (maybe invalid JSON syntax inside).
            // So we will grab a window around the first '[' and last ']' found by scanning.

            // Let's use a simple scanner again to find the outer bounds for the prompt context.
            let start = -1;
            let end = -1;
            let balance = 0;
            const t = response.text;
            for (let i = 0; i < t.length; i++) {
              if (t[i] === '[') {
                if (start === -1) start = i;
                balance++;
              } else if (t[i] === ']') {
                balance--;
                if (balance === 0 && start !== -1) {
                  end = i;
                  // Found a balanced outer array?
                  // Continue scanning to find the *last* one if there are multiple? 
                  // No, usually we want the biggest one or the first one.
                  // Let's stick to "last ']' in the file" idea but refined by balance if possible, 
                  // or just use the window technique which is safer for broken JSON.
                }
              }
            }
            // Simple Window Fallback (Proven robust)
            const firstOpen = response.text.indexOf('[');
            const lastClose = response.text.lastIndexOf(']');
            if (firstOpen !== -1 && lastClose > firstOpen) {
              const buffer = 500;
              errorContext = response.text.substring(Math.max(0, firstOpen - buffer), Math.min(response.text.length, lastClose + buffer));
            }
          } catch (e) {
            // Ignore extraction errors here, just use full text
          }

          // Final safety cap
          if (errorContext.length > 30000) {
            errorContext = errorContext.substring(0, 30000) + "... [Truncated]";
          }

          const repairPrompt = `
            You are a JSON repair expert. The following text contains slide data but is malformed or improperly formatted.
            Extract the slide data and return it as a valid JSON array matching the schema.
            
            RAW TEXT:
            ${errorContext}
            `;

          const repairResponse = await retryWithBackoff(() => ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: repairPrompt,
            config: repairConfig
          }));


          slides = JSON.parse(repairResponse.text);
          console.log("Repair Pass Successful");
          warnings.push("UsedRepairPass: true"); // Signal that repair was used
        } catch (repairError) {
          console.error("Repair Pass Failed"); // Log concisely
          throw new Error("Failed to parse response even after repair.");
        }
      }
    } else {
      // Rigid parse for Structured Output mode (should be clean)
      slides = JSON.parse(response.text);
    }

    // Extract grounding metadata to populate sources if web search was used
    // We trust the SDK types but keep the check safe.
    let globalSources: Array<{ uri: string; title?: string }> = [];
    let searchEntryPoint: string | undefined = undefined;
    let webSearchQueries: string[] | undefined = undefined;

    if (isUsingWebSearchTool && (response as any).candidates?.[0]?.groundingMetadata) {
      const metadata = (response as any).candidates[0].groundingMetadata;

      // Extract Search Entry Point (Required by Google Policy for UI)
      if (metadata.searchEntryPoint?.renderedContent) {
        searchEntryPoint = metadata.searchEntryPoint.renderedContent;
      }

      // Extract Queries for transparency
      if (metadata.webSearchQueries) {
        webSearchQueries = metadata.webSearchQueries;
      }

      if (metadata.groundingChunks) {
        const chunks = metadata.groundingChunks;
        const rawSources = chunks
          .map((chunk: any) => ({
            uri: chunk.web?.uri,
            title: chunk.web?.title // Capture title if available
          }))
          .filter((s: any) => s.uri && (s.uri.startsWith('http://') || s.uri.startsWith('https://'))); // Simple validation for http/https

        // Deduplicate by URI
        const uniqueUris = new Set();
        globalSources = rawSources.filter((s: any) => {
          if (uniqueUris.has(s.uri)) return false;
          uniqueUris.add(s.uri);
          return true;
        });
      }
    }



    // Validate and Fix Structure (Trim Only)
    if (slides.length !== totalSlides) {
      warnings.push(`Expected ${totalSlides} slides, but got ${slides.length}.`);
      console.warn(`Expected ${totalSlides} slides, got ${slides.length}. Adjusting...`);
      if (slides.length > totalSlides) {
        slides.length = totalSlides;
      }
    }

    // Validation & Sanitization Pass
    // Single pass to validate structure, sanitize markdown, and enforce constraints.

    slides.forEach((slide, idx) => {
      // 1. Strict Structure Validation
      const structureErrors = validateSlideStructure(slide, idx);
      if (structureErrors.length > 0) {
        warnings.push(...structureErrors);
        // We continue processing, attempting to "fix" via coercion below if possible, or just accept the mess.
      }

      // 2. Coercion & Fixes
      if (!slide.content || !Array.isArray(slide.content)) {
        slide.content = [];
      }

      if (slide.layout === "Content") {
        // Strict Markdown Sanitization for Bullets (Edges only)
        const originalLen = slide.content.length; // Capture length before trimming

        slide.content = slide.content.map(bullet => {
          // Regex Cleaner: Removes leading bullets (- * •) and whitespace
          let cleaned = bullet.replace(/^[-*•]\s*/, "").trim();

          // Strip wrapping bold/italics
          if (cleaned.startsWith('**') && cleaned.endsWith('**') && cleaned.length > 4) {
            cleaned = cleaned.substring(2, cleaned.length - 2);
          }
          else if (cleaned.startsWith('*') && cleaned.endsWith('*') && cleaned.length > 2) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
          }
          return cleaned;
        });

        if (slide.content.length > bulletsPerSlide) {
          slide.content = slide.content.slice(0, bulletsPerSlide);
          warnings.push(`Slide ${idx + 1}: Trimmed bullets from ${originalLen} to ${bulletsPerSlide}.`);
        } else if (slide.content.length < bulletsPerSlide) {
          warnings.push(`Slide ${idx + 1}: Has ${slide.content.length} bullets (expected ${bulletsPerSlide}).`);
        }
      }

      // 3. Speaker Notes
      if (!slide.speakerNotes) {
        slide.speakerNotes = "Speaker notes were not generated for this slide.";
      }

      // 4. Invariant Check: Slide 1
      if (idx === 0) {
        if (slide.layout === 'Title Slide') {
          if (slide.content.length !== 3) {
            warnings.push(`Slide 1 (Title Slide) malformed: Expected 3 items (Tagline, Subject, Grade), got ${slide.content.length}.`);
          }
        } else {
          warnings.push(`Slide 1 expected to be 'Title Slide', got '${slide.layout}'`);
        }
      }

      // 5. Layout Check
      if (!slide.layout) {
        warnings.push(`Slide ${idx + 1}: Missing layout property.`);
      }
    });

    // Safe token usage
    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      slides,
      inputTokens,
      outputTokens,
      sources: globalSources, // Return deck-level sources
      searchEntryPoint,       // Return Google Search Entry Point (HTML) for UI compliance
      webSearchQueries,       // Return queries for transparency
      warnings                // Return validation warnings
    };

  } catch (error) {
    console.error("Error generating slides with Gemini API:", error);
    throw new Error("The AI model failed to generate a valid response.");
  }
};

export const generateImage = async (prompt: string, gradeLevel: string, temperature: number = 0.3, aspectRatio: '16:9' | '1:1' = '16:9'): Promise<Blob> => {
  try {
    // Inject centralized style guidelines into the prompt
    const enhancedPrompt = `
    IMAGE SUBJECT
    ${prompt}

    TARGET AUDIENCE
    ${gradeLevel} Grade Students

    ${IMAGE_STYLE_GUIDE}`;

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: enhancedPrompt,
      config: {
        temperature: temperature,
        aspectRatio: aspectRatio,
      } as any,
    }));

    // Extract image data from response
    // Ensure parts exist before usage
    const candidatesParts = (response as any).candidates?.[0]?.content?.parts;
    const parts = candidatesParts || (response as any).parts || [];

    if (parts && parts.length > 0) {
      // Find the first part that actually has inlineData
      const validPart = parts.find((p: any) => p.inlineData || p.inline_data);

      if (validPart) {
        // Try both camelCase and snake_case property names
        const inlineData = validPart.inlineData || validPart.inline_data;
        if (inlineData) {
          // Convert base64 to blob
          const base64Data = inlineData.data;
          const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';

          if (!mimeType.startsWith('image/')) {
            throw new Error(`Invalid image mimeType received: ${mimeType}`);
          }

          // Convert base64 to binary (Isomorphic: Node.js Buffer or Browser atob)
          let bytes: Uint8Array;
          if (typeof (globalThis as any).Buffer !== 'undefined') {
            bytes = (globalThis as any).Buffer.from(base64Data, 'base64');
          } else {
            const binaryString = atob(base64Data);
            bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
          }
          return new Blob([bytes as any], { type: mimeType });
        }
      }
    }

    // Log response structure for debugging if image not found
    console.error("Response structure:", JSON.stringify(response, null, 2));
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image with Gemini API:", error);
    throw new Error("Failed to generate image. Please try again.");
  }
};

export const regenerateImagePrompt = async (
  slideTitle: string,
  slideContent: string[],
  gradeLevel: string,
  subject: string,
  temperature: number = 0.7
): Promise<string> => {
  // IMPORTANT: These instructions mirror the semantic constraints of the main generator
  const prompt = `
    You are an expert educational content creator.
    Generate a clear, descriptive image prompt for an educational illustration that visually explains the specific content of this slide.
    
    SLIDE CONTEXT
    Title: "${slideTitle}"
    Content: ${slideContent.join('; ')}
    Target Audience: ${gradeLevel} Grade Students
    Subject: "${subject}"
    
    IMAGE PROMPTING GUIDELINES
    0. You are writing a description for an AI image generator.
    1. Content Alignment: The image must directly illustrate the "Content" provided above.
    2. Visual Description ONLY: Focus strictly on visible objects, actions, and settings.
    3. NO Complex Diagrams: Avoid charts, graphs, and schematics. Describe tangible objects, scenes, or actions.
    4. Target Audience: Ensure visual descriptions are appropriate for ${gradeLevel} students.
    5. NO Style Instructions: Do not include words like "photorealistic", "cinematic", "3d render", "cartoon".
    6. Simplicity: Keep the scene uncluttered. Do not describe the background.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        temperature: temperature,
      },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error regenerating image prompt:", error);
    throw new Error("Failed to regenerate image prompt.");
  }
};

export const extractTextFromImage = async (base64Data: string, mimeType: string): Promise<string> => {
  const prompt = `
    Analyze this educational image and extract all visible text, including labels, captions, and annotations.
    Also describe any diagrams, charts, equations, or visual elements that convey educational information.
    Format the output as a coherent text block suitable for use as source material for creating presentation slides.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error extracting text from image:", error);
    throw new Error("Failed to process image content.");
  }
};
