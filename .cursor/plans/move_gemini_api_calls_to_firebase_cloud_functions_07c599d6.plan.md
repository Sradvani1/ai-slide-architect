---
name: Move Gemini API Calls to Firebase Cloud Functions
overview: Detailed implementation plan to move all Gemini API calls from client-side code to Firebase Cloud Functions, ensuring API keys remain secure on the server while maintaining all existing functionality including retry logic, error handling, and circuit breakers.
todos:
  - id: init-firebase-functions
    content: "Step 1: Initialize Firebase Functions - Run firebase init functions, select TypeScript, set up functions/ directory structure"
    status: pending
  - id: install-dependencies
    content: "Step 2: Install dependencies in functions/ - Install @google/genai, firebase-admin, firebase-functions, and dev dependencies"
    status: pending
  - id: setup-env-vars
    content: "Step 3: Set up environment variables - Configure GEMINI_API_KEY in Firebase Console secrets and create .env for local dev"
    status: pending
  - id: create-shared-directory
    content: "Step 4: Create shared code directory - Create shared/ directory, move error classes, constants, prompt builders, schemas, and retry logic from geminiService.ts to shared/"
    status: pending
  - id: create-auth-middleware
    content: "Step 5: Create authentication middleware - Create auth.ts middleware to verify Firebase ID tokens from requests"
    status: pending
  - id: create-generate-slides
    content: "Step 6: Create generateSlides function - Move generateSlidesFromDocument from client to functions, import shared utilities"
    status: pending
  - id: create-generate-image
    content: "Step 7: Create generateImage function - Move generateImageFromSpec from client to functions, import shared utilities"
    status: pending
  - id: create-regenerate-spec
    content: "Step 8: Create regenerateImageSpec function - Move regenerateImageSpec from client to functions, import shared utilities"
    status: pending
  - id: create-extract-text
    content: "Step 9: Create extractTextFromImage function - Move extractTextFromImage from client to functions, import shared utilities"
    status: pending
  - id: update-client-service
    content: "Step 10: Update client-side service - Refactor geminiService.ts to HTTP calls only, import error classes from shared/"
    status: pending
  - id: update-firebase-config
    content: "Step 11: Update Firebase config - Export functions instance from firebaseConfig.ts"
    status: pending
  - id: update-vite-config
    content: "Step 12: Update Vite config - Remove API key from client bundle in vite.config.ts"
    status: pending
  - id: add-rate-limiting
    content: "Step 13: Add rate limiting - Create server-side rate limiter using Firestore and add to Express middleware"
    status: pending
  - id: configure-typescript-paths
    content: "Step 14: Configure TypeScript paths - Update tsconfig.json files to support @shared/ imports"
    status: pending
  - id: deploy-functions
    content: "Step 15: Deploy functions - Build and deploy Firebase Functions, note function URLs"
    status: pending
  - id: update-client-urls
    content: "Step 16: Update client to use function URLs - Configure correct function URLs in client service"
    status: pending
  - id: test-all-functions
    content: "Step 17: Test all functions - Test authentication, all 4 functions, error handling, and rate limiting"
    status: pending
  - id: update-env-vars
    content: "Step 18: Update environment variables - Remove GEMINI_API_KEY from Vercel/client env, ensure it is only in Firebase Functions config"
    status: pending
---

# Move Gemini API Calls to Firebase Cloud Functions

## Overview

This plan permanently migrates all Gemini API calls from the client-side (`src/services/geminiService.ts`) to Firebase Cloud Functions. This is a one-way migration with zero code duplication - all shared logic lives in a `shared/` directory used by both client and server.

**Benefits**:

- API keys remain secure on the server
- Rate limiting enforced server-side
- Better error handling and monitoring
- Reduced client bundle size
- DRY principle: shared code in one place, no duplication

## Architecture

```
Current Flow:
Client → Direct Gemini API Call (API key exposed)

New Flow:
Client → Firebase Function → Gemini API (API key secure)
```

## Functions to Create

Four Firebase Cloud Functions will replace the four exported functions:

1. **generateSlides** - Replaces `generateSlidesFromDocument()`
2. **generateImage** - Replaces `generateImageFromSpec()`
3. **regenerateImageSpec** - Replaces `regenerateImageSpec()`
4. **extractTextFromImage** - Replaces `extractTextFromImage()`

## Implementation Steps

### Step 1: Initialize Firebase Functions

**Location**: Root directory

**Actions**:

1. Install Firebase CLI globally (if not already):
   ```bash
   npm install -g firebase-tools
   ```

2. Initialize Firebase Functions:
   ```bash
   firebase init functions
   ```


   - Select TypeScript
   - Use ESLint: Yes
   - Install dependencies: Yes

3. Verify structure created:
   ```
   functions/
     ├── src/
     │   └── index.ts
     ├── package.json
     ├── tsconfig.json
     └── .gitignore
   ```


**Files Created**:

- `functions/` directory structure
- `functions/package.json`
- `functions/tsconfig.json`
- `functions/src/index.ts`

---

### Step 2: Install Dependencies in Functions

**Location**: `functions/package.json`

**Actions**:

1. Install required packages:
   ```bash
   cd functions
   npm install @google/genai firebase-admin firebase-functions
   npm install --save-dev @types/node
   ```

2. Update `functions/package.json` dependencies:
   ```json
   {
     "dependencies": {
       "@google/genai": "^1.29.0",
       "firebase-admin": "^12.0.0",
       "firebase-functions": "^5.0.0"
     }
   }
   ```


**Files Modified**:

- `functions/package.json`

---

### Step 3: Set Up Environment Variables

**Location**: Firebase Console and `functions/.env` (for local development)

**Actions**:

1. Set environment variable in Firebase Console:

   - Go to Firebase Console → Functions → Configuration
   - Add secret: `GEMINI_API_KEY` with your API key value

2. For local development, create `functions/.env`:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```


(Add to `.gitignore`)

3. Update `functions/src/index.ts` to load environment:
   ```typescript
   import * as functions from 'firebase-functions';
   
   // Load from Firebase config or .env for local dev
   const GEMINI_API_KEY = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
   ```


**Files Created**:

- `functions/.env` (local dev only, gitignored)

**Files Modified**:

- `functions/src/index.ts`

**Configuration**:

- Firebase Console: Functions Configuration

---

### Step 4: Create Shared Code Directory

**Location**: Root directory

**Actions**:

1. Create `shared/` directory at project root for code used by both client and server:
   ```
   shared/
   ├── types.ts                    # Shared TypeScript types
   ├── constants.ts                # Model constants, defaults
   ├── errors.ts                   # Error classes (GeminiError, ImageGenError)
   ├── promptBuilders.ts           # All build*Section functions
   ├── schemas.ts                  # IMAGE_SPEC_SCHEMA and other schemas
   └── utils/
       ├── retryLogic.ts           # Retry with backoff
       └── validation.ts           # Validation utilities
   ```

2. Move shared code from `src/services/geminiService.ts`:

   - Move error classes to `shared/errors.ts`
   - Move model constants to `shared/constants.ts`
   - Move all `build*Section()` functions to `shared/promptBuilders.ts`
   - Move `IMAGE_SPEC_SCHEMA` to `shared/schemas.ts`
   - Move `retryWithBackoff` to `shared/utils/retryLogic.ts`
   - Move `extractFirstJsonArray` to `shared/utils/`

3. Update `src/types.ts` to export from `shared/types.ts` (or move types to shared)

**Files Created**:

- `shared/` directory structure
- `shared/types.ts`
- `shared/constants.ts`
- `shared/errors.ts`
- `shared/promptBuilders.ts`
- `shared/schemas.ts`
- `shared/utils/retryLogic.ts`
- `shared/utils/validation.ts`

**Files Modified**:

- `src/services/geminiService.ts` - Remove moved code, import from shared
- `src/types.ts` - Reference shared types or move to shared

**Code Structure**:

```typescript
// shared/constants.ts
export const MODEL_SLIDE_GENERATION = "gemini-2.5-pro";
export const MODEL_IMAGE_GENERATION = "gemini-3-pro-image-preview";
export const MODEL_SPEC_REGENERATION = "gemini-2.5-pro";
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_BULLETS_PER_SLIDE = 4;
```
```typescript
// shared/errors.ts
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

export class ImageGenError extends Error {
  constructor(
    message: string,
    public code: 'NO_IMAGE_DATA' | 'INVALID_MIME_TYPE' | 'NETWORK' | 'TIMEOUT' | 'UNKNOWN',
    public isRetryable: boolean,
    public context?: any
  ) {
    super(message);
    this.name = 'ImageGenError';
  }
}
```
```typescript
// functions/src/utils/geminiClient.ts
import { GoogleGenAI } from "@google/genai";
import * as functions from 'firebase-functions';

const GEMINI_API_KEY = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY not configured");
}

export const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
```

**Note**: Functions import from `shared/` directory. Client also imports from `shared/` for types, constants, and error classes.

---

### Step 5: Create Authentication Middleware

**Location**: `functions/src/middleware/auth.ts`

**Actions**:

1. Create authentication middleware to verify Firebase ID tokens:
```typescript
// functions/src/middleware/auth.ts
import * as admin from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';

// Initialize Firebase Admin (done once in index.ts)
// admin.initializeApp();

export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

export async function verifyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}
```


**Files Created**:

- `functions/src/middleware/auth.ts`

---

### Step 6: Create generateSlides Function

**Location**: `functions/src/index.ts`

**Actions**:

1. Create HTTP callable function for slide generation:
```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { verifyAuth } from './middleware/auth';
import { generateSlidesFromDocument } from './services/slideGeneration';

// Initialize Firebase Admin
admin.initializeApp();

// Create Express app for HTTP functions
import * as express from 'express';
const app = express();

// Apply auth middleware to all routes
app.use(express.json());
app.use(verifyAuth);

// Generate Slides Function
app.post('/generateSlides', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      topic,
      gradeLevel,
      subject,
      sourceMaterial,
      numSlides,
      useWebSearch,
      temperature,
      bulletsPerSlide,
      additionalInstructions
    } = req.body;

    // Validate required fields
    if (!topic || !gradeLevel || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Call the generation logic (moved from client)
    const result = await generateSlidesFromDocument(
      topic,
      gradeLevel,
      subject,
      sourceMaterial || '',
      numSlides || 5,
      useWebSearch || false,
      temperature || 0.7,
      bulletsPerSlide || 4,
      additionalInstructions || ''
    );

    res.json(result);
  } catch (error: any) {
    console.error('generateSlides error:', error);
    
    // Return structured error
    const statusCode = error.isRetryable ? 503 : 400;
    res.status(statusCode).json({
      error: error.message,
      code: error.code,
      isRetryable: error.isRetryable
    });
  }
});

export const api = functions.https.onRequest(app);
```

2. Create the service function:

   - `functions/src/services/slideGeneration.ts` - Contains the actual `generateSlidesFromDocument` logic

**Files Created**:

- `functions/src/services/slideGeneration.ts`
- Update `functions/src/index.ts`

**Implementation**:

- Move `generateSlidesFromDocument` function from `src/services/geminiService.ts` to `functions/src/services/slideGeneration.ts`
- Import shared utilities: `retryWithBackoff` from `shared/utils/retryLogic.ts`, `buildSlideGenerationPrompt` from `shared/promptBuilders.ts`, `IMAGE_SPEC_SCHEMA` from `shared/schemas.ts`
- Import error classes from `shared/errors.ts`
- Import constants from `shared/constants.ts`
- Import types from `shared/types.ts`

---

### Step 8: Create generateImage Function

**Location**: `functions/src/index.ts` and `functions/src/services/`

**Actions**:

1. Add route to Express app:
```typescript
app.post('/generateImage', async (req: AuthenticatedRequest, res) => {
  try {
    const { spec, gradeLevel, subject, options } = req.body;

    if (!spec || !gradeLevel || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await generateImageFromSpec(spec, gradeLevel, subject, options || {});
    
    // Convert Blob to base64 for JSON response
    const arrayBuffer = await result.blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    res.json({
      imageData: base64,
      mimeType: result.blob.type,
      renderedPrompt: result.renderedPrompt
    });
  } catch (error: any) {
    console.error('generateImage error:', error);
    const statusCode = error.isRetryable ? 503 : 400;
    res.status(statusCode).json({
      error: error.message,
      code: error.code,
      isRetryable: error.isRetryable
    });
  }
});
```

2. Create service function:

   - `functions/src/services/imageGeneration.ts` - Contains `generateImageFromSpec` logic
   - Import `formatImageSpec` from `src/utils/imageUtils.ts` (or move to shared if used elsewhere)
   - Import error classes from `shared/errors.ts`
   - Import constants from `shared/constants.ts`

**Files Created**:

- `functions/src/services/imageGeneration.ts`
- Update `functions/src/index.ts`

**Note**: Blob needs to be converted to base64 for JSON response, then converted back to Blob on client. Move `generateImageFromSpec` from `src/services/geminiService.ts` to this file.

---

### Step 8: Create regenerateImageSpec Function

**Location**: `functions/src/index.ts` and `functions/src/services/`

**Actions**:

1. Add route:
```typescript
app.post('/regenerateImageSpec', async (req: AuthenticatedRequest, res) => {
  try {
    const { slideTitle, slideContent, gradeLevel, subject, creativityLevel } = req.body;

    if (!slideTitle || !slideContent || !gradeLevel || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const spec = await regenerateImageSpec(
      slideTitle,
      slideContent,
      gradeLevel,
      subject,
      creativityLevel || 0.7
    );

    res.json({ spec });
  } catch (error: any) {
    console.error('regenerateImageSpec error:', error);
    res.status(400).json({
      error: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
});
```

2. Create service function:

   - `functions/src/services/specRegeneration.ts`
   - Move `regenerateImageSpec` from `src/services/geminiService.ts` to this file
   - Import `normalizeImageSpec` from `src/utils/imageUtils.ts` (or move to shared)
   - Import `IMAGE_SPEC_SCHEMA` from `shared/schemas.ts`
   - Import constants from `shared/constants.ts`

**Files Created**:

- `functions/src/services/specRegeneration.ts`
- Update `functions/src/index.ts`

---

### Step 9: Create extractTextFromImage Function

**Location**: `functions/src/index.ts` and `functions/src/services/`

**Actions**:

1. Add route:
```typescript
app.post('/extractTextFromImage', async (req: AuthenticatedRequest, res) => {
  try {
    const { base64Data, mimeType } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Missing base64Data or mimeType' });
    }

    const text = await extractTextFromImage(base64Data, mimeType);
    res.json({ text });
  } catch (error: any) {
    console.error('extractTextFromImage error:', error);
    res.status(400).json({
      error: error.message
    });
  }
});
```

2. Create service function:

   - `functions/src/services/imageTextExtraction.ts`
   - Move `extractTextFromImage` from `src/services/geminiService.ts` to this file
   - Import constants from `shared/constants.ts`

**Files Created**:

- `functions/src/services/imageTextExtraction.ts`
- Update `functions/src/index.ts`

---

### Step 10: Update Client-Side Service

**Location**: `src/services/geminiService.ts`

**Actions**:

1. Remove API key initialization:

   - Delete `const API_KEY = ...`
   - Delete `const ai = new GoogleGenAI(...)`

2. Replace function implementations with HTTP calls:
```typescript
// src/services/geminiService.ts
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';

const functionsInstance = getFunctions();

// Helper to get auth token and make authenticated request
async function callFunction(endpoint: string, data: any) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const token = await user.getIdToken();
  const functionUrl = `https://${functionsInstance.region}-${functionsInstance.app.options.projectId}.cloudfunctions.net/api${endpoint}`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new GeminiError(
      error.error || 'Request failed',
      error.code || 'UNKNOWN',
      error.isRetryable || false,
      error
    );
  }

  return response.json();
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
) => {
  return callFunction('/generateSlides', {
    topic,
    gradeLevel,
    subject,
    sourceMaterial,
    numSlides,
    useWebSearch,
    temperature,
    bulletsPerSlide,
    additionalInstructions
  });
};

export const generateImageFromSpec = async (
  spec: ImageSpec,
  gradeLevel: string,
  subject: string,
  options: ImageGenOptions = {}
) => {
  const result = await callFunction('/generateImage', {
    spec,
    gradeLevel,
    subject,
    options
  });

  // Convert base64 back to Blob
  const binaryString = atob(result.imageData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    blob: new Blob([bytes], { type: result.mimeType }),
    renderedPrompt: result.renderedPrompt
  };
};

export const regenerateImageSpec = async (
  slideTitle: string,
  slideContent: string[],
  gradeLevel: string,
  subject: string,
  creativityLevel: number
): Promise<ImageSpec> => {
  const result = await callFunction('/regenerateImageSpec', {
    slideTitle,
    slideContent,
    gradeLevel,
    subject,
    creativityLevel
  });
  return result.spec;
};

export const extractTextFromImage = async (
  base64Data: string,
  mimeType: string
): Promise<string> => {
  const result = await callFunction('/extractTextFromImage', {
    base64Data,
    mimeType
  });
  return result.text;
};
```

3. Import error classes from shared:

   - Import `GeminiError` and `ImageGenError` from `shared/errors.ts`

**Files Modified**:

- `src/services/geminiService.ts` - Complete refactor to HTTP calls only, import errors from shared

---

### Step 11: Update Firebase Config

**Location**: `src/firebaseConfig.ts`

**Actions**:

1. Export functions instance:
```typescript
import { getFunctions } from 'firebase/functions';

export const functions = getFunctions();
```


**Files Modified**:

- `src/firebaseConfig.ts`

---

### Step 12: Update Vite Config

**Location**: `vite.config.ts`

**Actions**:

1. Remove API key from client bundle:
```typescript
// Remove these lines:
'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
```


**Files Modified**:

- `vite.config.ts`

---

### Step 13: Add Rate Limiting (Server-Side)

**Location**: `functions/src/middleware/rateLimiter.ts`

**Actions**:

1. Create server-side rate limiter using Firestore:
```typescript
import * as admin from 'firebase-admin';

export async function checkRateLimit(userId: string): Promise<boolean> {
  const rateLimitRef = admin.firestore()
    .collection('rateLimits')
    .doc(userId);

  const doc = await rateLimitRef.get();
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 10;

  if (!doc.exists) {
    await rateLimitRef.set({
      count: 1,
      windowStart: now
    });
    return true;
  }

  const data = doc.data()!;
  if (now - data.windowStart > windowMs) {
    // New window
    await rateLimitRef.set({
      count: 1,
      windowStart: now
    });
    return true;
  }

  if (data.count >= maxRequests) {
    return false; // Rate limited
  }

  await rateLimitRef.update({
    count: admin.firestore.FieldValue.increment(1)
  });

  return true;
}
```

2. Add to Express middleware:
```typescript
app.use(async (req: AuthenticatedRequest, res, next) => {
  if (!req.user) return next();
  
  const allowed = await checkRateLimit(req.user.uid);
  if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
});
```


**Files Created**:

- `functions/src/middleware/rateLimiter.ts`
- Update `functions/src/index.ts`

---

### Step 14: Configure TypeScript Paths for Shared Imports

**Location**: `functions/tsconfig.json` and root `tsconfig.json`

**Actions**:

1. Update `functions/tsconfig.json` to include shared directory:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"]
}
```

2. Update root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  }
}
```

3. Update imports in functions to use `@shared/`:
```typescript
// In functions code
import { GeminiError } from '@shared/errors';
import { MODEL_SLIDE_GENERATION } from '@shared/constants';
import { buildSlideGenerationPrompt } from '@shared/promptBuilders';
```

4. Update imports in client to use `@shared/`:
```typescript
// In client code
import { GeminiError, ImageGenError } from '@shared/errors';
```


**Files Modified**:

- `functions/tsconfig.json`
- `tsconfig.json`
- All files importing shared code

---

### Step 15: Deploy Functions

**Location**: Root directory

**Actions**:

1. Build functions:
   ```bash
   cd functions
   npm run build
   ```

2. Deploy to Firebase:
   ```bash
   firebase deploy --only functions
   ```

3. Note the function URLs (will be displayed after deployment)

**Commands**:

- `cd functions && npm run build`
- `firebase deploy --only functions`

---

### Step 16: Update Client to Use Function URLs

**Location**: `src/services/geminiService.ts`

**Actions**:

1. Get function URL from Firebase config or hardcode region:
```typescript
// Get from Firebase config
const functionsInstance = getFunctions();
const region = functionsInstance.region || 'us-central1';
const projectId = functionsInstance.app.options.projectId;
const baseUrl = `https://${region}-${projectId}.cloudfunctions.net/api`;
```

2. Update `callFunction` helper to use correct URL

**Files Modified**:

- `src/services/geminiService.ts`

---

### Step 17: Testing

**Test Cases**:

1. **Authentication**:

   - Test with valid token
   - Test with invalid token
   - Test with no token

2. **generateSlides**:

   - Test with all parameters
   - Test with web search enabled
   - Test with source material
   - Test error handling

3. **generateImage**:

   - Test image generation
   - Test blob conversion
   - Test error handling

4. **regenerateImageSpec**:

   - Test spec regeneration
   - Test validation

5. **extractTextFromImage**:

   - Test text extraction
   - Test with different image types

6. **Rate Limiting**:

   - Test rate limit enforcement
   - Test rate limit reset

**Files to Test**:

- All client components using geminiService
- All Firebase Functions

---

### Step 18: Update Environment Variables

**Location**: Firebase Console, Vercel (if deployed)

**Actions**:

1. Remove `GEMINI_API_KEY` from Vercel environment variables (client-side)
2. Add `GEMINI_API_KEY` to Firebase Functions configuration
3. Update `.env.local` to remove `GEMINI_API_KEY` (if present)

**Configuration**:

- Firebase Console: Functions → Configuration → Secrets
- Vercel: Remove from environment variables

---

## File Structure After Migration

```
ai-slide-architect/
├── shared/                             # Shared code (DRY - no duplication)
│   ├── types.ts                        # Shared TypeScript types
│   ├── constants.ts                    # Model constants, defaults
│   ├── errors.ts                       # GeminiError, ImageGenError
│   ├── promptBuilders.ts               # All build*Section functions
│   ├── schemas.ts                      # IMAGE_SPEC_SCHEMA
│   └── utils/
│       ├── retryLogic.ts               # retryWithBackoff, extractFirstJsonArray
│       └── validation.ts               # Validation utilities (if shared)
├── functions/
│   ├── src/
│   │   ├── index.ts                    # Main Express app + routes
│   │   ├── middleware/
│   │   │   ├── auth.ts                 # Auth verification
│   │   │   └── rateLimiter.ts          # Server-side rate limiting
│   │   ├── services/
│   │   │   ├── slideGeneration.ts      # generateSlidesFromDocument (moved from client)
│   │   │   ├── imageGeneration.ts      # generateImageFromSpec (moved from client)
│   │   │   ├── specRegeneration.ts     # regenerateImageSpec (moved from client)
│   │   │   └── imageTextExtraction.ts   # extractTextFromImage (moved from client)
│   │   └── utils/
│   │       └── geminiClient.ts         # Gemini client init (server-only)
│   ├── package.json
│   ├── tsconfig.json                   # Configured to import from ../shared
│   └── .env                            # Local dev only
├── src/
│   ├── services/
│   │   └── geminiService.ts            # HTTP client wrapper (calls functions)
│   └── ... (rest of client code)
└── ... (rest of project)
```

**Key Points**:

- All business logic (prompt builders, schemas, retry logic) lives in `shared/`
- Functions import from `shared/` - no code duplication
- Client imports error classes and types from `shared/` - no code duplication
- Only server-specific code (Gemini client init, auth middleware) lives in `functions/`
- Only client-specific code (HTTP fetch wrapper) lives in `src/services/geminiService.ts`

## Migration Checklist

- [ ] Step 1: Initialize Firebase Functions
- [ ] Step 2: Install dependencies
- [ ] Step 3: Set up environment variables
- [ ] Step 4: Create shared code directory (move all shared code from geminiService.ts)
- [ ] Step 6: Create auth middleware
- [ ] Step 5: Create auth middleware
- [ ] Step 6: Create generateSlides function (move from client, import from shared)
- [ ] Step 7: Create generateImage function (move from client, import from shared)
- [ ] Step 8: Create regenerateImageSpec function (move from client, import from shared)
- [ ] Step 9: Create extractTextFromImage function (move from client, import from shared)
- [ ] Step 10: Update client-side service (refactor to HTTP calls only, import errors from shared)
- [ ] Step 12: Update Firebase config
- [ ] Step 13: Update Vite config
- [ ] Step 14: Add rate limiting
- [ ] Step 15: Deploy functions
- [ ] Step 16: Update client URLs
- [ ] Step 17: Test all functions
- [ ] Step 18: Update environment variables

## Important Notes

1. **Blob Handling**: Images are converted to base64 for JSON transport, then back to Blob on client
2. **Error Handling**: Error classes are shared from `shared/errors.ts` - same structure everywhere
3. **Retry Logic**: Lives in `shared/utils/retryLogic.ts` - used by server-side functions
4. **Rate Limiting**: Enforced server-side per user using Firestore
5. **Code Reuse**: All business logic (prompts, schemas, validation) is in `shared/` - zero duplication
6. **TypeScript Config**: Both `functions/tsconfig.json` and `tsconfig.json` must include `shared/` in paths
7. **Costs**: Firebase Functions have free tier, then pay-per-use
8. **Cold Starts**: First request may be slower (~1-2s), subsequent requests are fast

## TypeScript Configuration

**Update `functions/tsconfig.json`**:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"]
}
```

**Update root `tsconfig.json`**:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  }
}
```

## Next Steps After Migration

1. Monitor function execution in Firebase Console
2. Set up alerts for function errors
3. Monitor costs
4. Optimize cold start times if needed
5. Consider caching for frequently used prompts