---
name: Enable TypeScript Strict Mode
overview: Enable TypeScript strict mode in the frontend codebase and fix all resulting type errors by replacing `any` types with proper types, adding type guards, and improving null/undefined handling for better type safety.
todos:
  - id: enable-strict-mode
    content: "Enable strict mode in tsconfig.json by adding \"strict\": true to compilerOptions"
    status: pending
  - id: create-type-guards
    content: Create src/utils/typeGuards.ts with utility type guard functions (isError, isRetryableError, isFirestoreTimestamp)
    status: pending
  - id: fix-error-handler-types
    content: "Fix error types in src/utils/errorHandler.ts - change error: any to error: unknown and add type guards"
    status: pending
  - id: fix-editor-error-types
    content: "Fix error handling in src/components/Editor.tsx - change err: any to err: unknown with proper type guards"
    status: pending
  - id: fix-auth-error-types
    content: "Fix error handling in src/components/Auth.tsx - change error: any to error: unknown with type guard"
    status: pending
  - id: fix-project-service-types
    content: Fix error types and remove as any casts in src/services/projectService.ts (lines 202, 233, 285)
    status: pending
  - id: fix-dashboard-types
    content: "Fix error and timestamp types in src/components/Dashboard.tsx - change error: any and timestamp: any to proper types"
    status: pending
  - id: fix-gemini-service-types
    content: "Fix API request body types in src/services/geminiService.ts - replace body: any with proper interfaces and fix return types"
    status: pending
  - id: fix-slidecard-error-types
    content: Fix error type guard in src/components/SlideCard.tsx - replace (error as any).isRetryable with proper type guard
    status: pending
  - id: fix-file-validation-types
    content: Fix type assertion in src/utils/fileValidation.ts - remove as any cast on line 165
    status: pending
  - id: fix-fileuploader-types
    content: "Fix PDF text item type in src/components/FileUploader.tsx - replace item: any with proper TextItem type from pdfjs-dist"
    status: pending
  - id: fix-error-boundary-types
    content: Fix resetKeys type in src/components/ErrorBoundary.tsx - replace Array<any> with proper generic type
    status: pending
  - id: fix-validation-types
    content: "Fix slide parameter type in shared/utils/validation.ts - replace slide: any with proper type and type guards"
    status: pending
  - id: verify-build
    content: Run npm run build and fix any remaining type errors
    status: pending
  - id: test-runtime
    content: Test critical user flows to ensure no runtime regressions
    status: pending
---

# TypeScript Strict Mode Implementation Plan

## Overview

Enable TypeScript strict mode in the frontend to improve type safety, catch errors at compile time, and align with industry best practices. This involves enabling strict mode in `tsconfig.json` and systematically fixing all type errors that result.

## Current State Analysis

**Backend:** Already has `"strict": true` enabled in `functions/tsconfig.json`**Frontend:** Strict mode disabled in `tsconfig.json`**Type Issues Found:**

- ~19 instances of `any` type usage
- Multiple `as any` type assertions
- Error handling using `error: any` instead of `error: unknown`
- Unhandled null/undefined cases
- Missing type definitions for API responses

## Implementation Strategy

Enable strict mode incrementally by fixing errors as they appear, starting with the most critical files.

## Implementation Steps

### Step 1: Enable Strict Mode in tsconfig.json

**File:** `tsconfig.json`**Changes:**

- Add `"strict": true` to `compilerOptions`
- This enables all strict type checking options:
- `noImplicitAny`
- `strictNullChecks`
- `strictFunctionTypes`
- `strictBindCallApply`
- `strictPropertyInitialization`
- `noImplicitThis`
- `alwaysStrict`

**Code:**

```json
{
  "compilerOptions": {
    "strict": true,
    // ... existing options
  }
}
```



### Step 2: Fix Error Handling Types

**Files to modify:**

- `src/utils/errorHandler.ts`
- `src/components/Editor.tsx`
- `src/components/Auth.tsx`
- `src/services/projectService.ts`
- `src/components/Dashboard.tsx`

**Changes:**

- Replace `error: any` with `error: unknown` in catch blocks
- Add proper type guards to check error types
- Use `instanceof Error` checks before accessing error properties

**Example pattern:**

```typescript
// Before:
catch (error: any) {
  console.error(error.message);
}

// After:
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
}
```

**Specific fixes:**

1. **src/utils/errorHandler.ts** (line 50):

- Change `error: any` to `error: unknown`
- Add type guard: `const actualError = error instanceof Error ? error : new Error(String(error));`

2. **src/components/Editor.tsx** (line 343):

- Change `err: any` to `err: unknown`
- Add proper error handling

3. **src/components/Auth.tsx** (line 20):

- Change `error: any` to `error: unknown`
- Add type guard before accessing `error.message`

4. **src/services/projectService.ts** (line 285):

- Change `error: any` to `error: unknown`
- Add type guard for index error checking

5. **src/components/Dashboard.tsx** (line 52):

- Change `error: any` to `error: unknown`
- Add type guard for error code checking

### Step 3: Fix API Request Body Types

**File:** `src/services/geminiService.ts`**Changes:**

- Replace `body: any` with proper type definition
- Create interface for request body types

**Code:**

```typescript
// Create types for request bodies
interface GenerateSlidesRequestBody {
  topic: string;
  gradeLevel: string;
  subject: string;
  sourceMaterial: string;
  numSlides: number;
  useWebSearch: boolean;
  additionalInstructions?: string;
  temperature?: number;
  bulletsPerSlide?: number;
  uploadedFileNames?: string[];
  projectId?: string;
}

interface GenerateImageRequestBody {
  imagePrompt: string;
  options: { aspectRatio?: '16:9' | '1:1', temperature?: number };
}

interface ExtractTextRequestBody {
  imageBase64: string;
  mimeType: string;
}

// Update function signature
async function authenticatedRequest<T>(
  endpoint: string, 
  body: GenerateSlidesRequestBody | GenerateImageRequestBody | ExtractTextRequestBody
): Promise<T>
```

**Line 23:** Update `authenticatedRequest` function signature**Line 89:** Remove `any` from `authenticatedRequest<any>`**Line 160:** Update return type from `Promise<any>` to proper type

### Step 4: Fix Timestamp Type Handling

**File:** `src/components/Dashboard.tsx`**Changes:**

- Replace `timestamp: any` with proper `Timestamp | Date | null | undefined` type
- Add proper type guards

**Code:**

```typescript
// Import Timestamp type
import { Timestamp } from 'firebase/firestore';

// Update function signature
const formatDate = (timestamp: Timestamp | Date | null | undefined): string => {
  if (!timestamp) return '';
  
  // Type guard for Firestore Timestamp
  if (timestamp instanceof Timestamp || (timestamp as any).toDate) {
    const date = timestamp instanceof Timestamp 
      ? timestamp.toDate() 
      : (timestamp as { toDate: () => Date }).toDate();
    // ... rest of formatting
  } else if (timestamp instanceof Date) {
    // Handle Date object
  }
  // ...
}
```

**Line 103:** Update `formatDate` function signature and implementation

### Step 5: Fix Type Assertions

**Files to modify:**

- `src/services/projectService.ts`
- `src/components/SlideCard.tsx`
- `src/utils/fileValidation.ts`
- `src/components/FileUploader.tsx`

**Changes:**

1. **src/services/projectService.ts** (line 202):

- Remove `as any` cast
- Use proper type narrowing:
   ```typescript
         // Before:
         const { slides, ...safeData } = data as any;
         
         // After:
         const { slides, ...safeData } = data;
         // TypeScript will infer correctly if Partial<ProjectData> is properly typed
   ```




2. **src/services/projectService.ts** (line 233):

- Remove `as any` cast
- Fix underlying type mismatch by ensuring `updateDoc` accepts the correct type
- May need to create a proper type for Firestore update data

3. **src/components/SlideCard.tsx** (line 136):

- Replace `(error as any).isRetryable` with proper type guard
- Check if error has `isRetryable` property using `in` operator or type guard

4. **src/utils/fileValidation.ts** (line 165):

- Remove `as any` cast
- Use proper type: `extension as string` or type guard

5. **src/components/FileUploader.tsx** (line 79):

- Replace `item: any` with proper type from pdfjs-dist
- Import proper types: `import { TextItem } from 'pdfjs-dist/types/src/display/api';`
- Use: `textContent.items.map((item: TextItem) => item.str).join(' ')`

### Step 6: Fix Function Parameter Types

**File:** `src/components/ErrorBoundary.tsx`**Changes:**

- Replace `Array<any>` with proper generic type

**Code:**

```typescript
// Line 101:
resetKeys?: Array<string | number | boolean>; // or use a union type based on actual usage
```



### Step 7: Fix Validation Function Types

**File:** `shared/utils/validation.ts`**Changes:**

- Replace `slide: any` with proper type
- Import `Slide` type from shared types

**Code:**

```typescript
import type { Slide } from '@shared/types';

export function validateSlideStructure(slide: unknown, idx: number): string[] {
  const errors: string[] = [];
  
  // Type guard
  if (typeof slide !== 'object' || slide === null) {
    return [`Slide ${idx + 1}: Invalid object`];
  }
  
  // Now TypeScript knows slide is an object
  const slideObj = slide as Record<string, unknown>;
  
  // Continue with validation...
}
```

**Line 1:** Update function signature

### Step 8: Add Type Guards Utility

**File:** Create `src/utils/typeGuards.ts` (new file)**Purpose:** Centralized type guard functions for common patterns**Code:**

```typescript
/**
    * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
    * Type guard to check if error has isRetryable property
 */
export function isRetryableError(error: unknown): error is Error & { isRetryable: boolean } {
  return isError(error) && 'isRetryable' in error && typeof (error as any).isRetryable === 'boolean';
}

/**
    * Type guard for Firestore Timestamp
 */
export function isFirestoreTimestamp(value: unknown): value is { toDate: () => Date } {
  return typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function';
}
```



### Step 9: Fix Null/Undefined Handling

**Files to review:**

- All files that access optional properties
- Add null checks where needed
- Use optional chaining (`?.`) and nullish coalescing (`??`)

**Common patterns to fix:**

- `project.updatedAt?.toMillis()` - already using optional chaining (good)
- Add checks for potentially undefined values
- Ensure all function returns handle null/undefined cases

### Step 10: Verify Build and Fix Remaining Errors

**Steps:**

1. Run `npm run build` to check for type errors
2. Fix any remaining type errors that appear
3. Run `npm run dev` to verify runtime behavior unchanged
4. Test critical user flows to ensure no runtime regressions

## Files to Modify

1. **tsconfig.json** - Enable strict mode
2. **src/utils/errorHandler.ts** - Fix error type
3. **src/components/Editor.tsx** - Fix error handling
4. **src/components/Auth.tsx** - Fix error handling
5. **src/services/projectService.ts** - Fix error handling and type assertions
6. **src/components/Dashboard.tsx** - Fix error handling and timestamp type
7. **src/services/geminiService.ts** - Fix API request body types
8. **src/components/SlideCard.tsx** - Fix error type guard
9. **src/utils/fileValidation.ts** - Fix type assertion
10. **src/components/FileUploader.tsx** - Fix PDF text item type
11. **src/components/ErrorBoundary.tsx** - Fix resetKeys type
12. **shared/utils/validation.ts** - Fix slide parameter type
13. **src/utils/typeGuards.ts** - New file with type guard utilities

## Testing Requirements

1. **Type Checking:**

- Run `tsc --noEmit` to verify no type errors
- Run `npm run build` to ensure build succeeds

2. **Runtime Testing:**

- Test error handling (try invalid operations)
- Test API calls (verify request bodies work)
- Test date formatting (verify timestamps display correctly)
- Test file uploads (verify PDF parsing works)
- Test project operations (create, update, delete)

3. **Edge Cases:**

- Test with null/undefined values
- Test error scenarios
- Test with missing data

## Migration Notes

- Start by enabling strict mode and fixing errors incrementally
- Fix one file at a time to avoid overwhelming changes
- Test after each major change to ensure functionality preserved
- Some `as any` casts may need to remain temporarily if fixing requires larger refactoring (document with TODO comments)

## Expected Outcomes

- All `any` types replaced with proper types
- Better IDE autocomplete and type checking
- Compile-time error detection for potential runtime bugs