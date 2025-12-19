---
name: File Upload Validation Implementation
overview: Comprehensive implementation plan for adding file upload validation including size limits, MIME type validation with magic bytes, file count limits, content validation, and progress indicators to prevent DoS attacks and security issues.
todos:
  - id: create-validation-constants
    content: "Step 1: Create file validation constants - Define MAX_FILE_SIZE, MAX_TOTAL_SIZE, MAX_FILES, ALLOWED_MIME_TYPES, FILE_SIGNATURES in src/utils/fileValidation.ts"
    status: pending
  - id: implement-magic-bytes
    content: "Step 2: Implement magic bytes validation - Create readFileHeader and validateMimeTypeByMagicBytes functions to prevent MIME type spoofing"
    status: pending
  - id: implement-size-validation
    content: "Step 3: Implement file size validation - Create validateFileSize, validateTotalSize, validateFileCount, and checkDuplicateNames functions"
    status: pending
  - id: implement-content-validation
    content: "Step 4: Implement content validation - Create validatePdfContent, validateImageContent, and validateTextFileContent functions"
    status: pending
  - id: create-comprehensive-validation
    content: "Step 5: Create comprehensive validation function - Create validateFile and validateFiles functions that orchestrate all checks"
    status: pending
  - id: update-fileuploader-validation
    content: "Step 6: Update FileUploader component - Add validation calls in processFiles, add validation state management"
    status: pending
  - id: add-error-display-ui
    content: "Step 7: Add validation error display UI - Create error and warning display components with proper styling"
    status: pending
  - id: add-progress-indicators
    content: "Step 8: Add progress indicators - Add upload progress tracking and progress bar UI for file processing"
    status: pending
  - id: add-server-validation
    content: "Step 9: Add server-side validation - Add validation check in uploadFileToStorage function (optional but recommended)"
    status: pending
  - id: update-file-input
    content: "Step 10: Update file input accept attribute - Ensure accept attribute matches all allowed MIME types and extensions"
    status: pending
---

# File Upload Validation Implementation Plan

## Overview

This plan implements comprehensive file upload validation to prevent DoS attacks, security vulnerabilities, and performance issues. The validation includes size limits, MIME type verification using magic bytes, file count limits, content validation, and user-friendly progress indicators.

## Current State Analysis

**Current Issues:**

- No file size limits (users can upload 1GB+ files)
- MIME type validation relies only on `file.type` (can be spoofed)
- No file count limits
- No content validation (dimensions, page counts)
- No progress indicators for large files
- No duplicate file name detection

**Files to Modify:**

- `src/components/FileUploader.tsx` - Add validation logic
- `src/services/projectService.ts` - Add server-side validation (optional but recommended)
- `src/utils/fileValidation.ts` - New utility file for validation functions

## Implementation Steps

### Step 1: Create File Validation Constants

**Location**: `src/utils/fileValidation.ts`**Actions**:

1. Create new file with validation constants and configuration:
```typescript
// src/utils/fileValidation.ts

// File size limits (in bytes)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total for all files
export const MAX_FILES = 10; // Maximum number of files per upload

// Allowed MIME types
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
] as const;

// File extensions mapping (for fallback validation)
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp'] as const;

// Content validation limits
export const MAX_PDF_PAGES = 100;
export const MAX_IMAGE_DIMENSION = 4096; // pixels (width or height)
export const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024; // 5MB for text files

// Magic bytes (file signatures) for MIME type validation
export const FILE_SIGNATURES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG
  'image/jpeg': [[0xFF, 0xD8, 0xFF]], // JPEG
  'image/webp': [[0x52, 0x49, 0x46, 0x46], [0x57, 0x45, 0x42, 0x50]], // RIFF...WEBP
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00] // ZIP header (DOCX is a ZIP)
  ],
  'text/plain': [] // No signature, validate by extension and content
};
```


**Files Created**:

- `src/utils/fileValidation.ts`

---

### Step 2: Implement Magic Bytes Validation

**Location**: `src/utils/fileValidation.ts`**Actions**:

1. Add function to read file header (first bytes):
```typescript
/**
    * Reads the first N bytes of a file to check magic bytes
 */
async function readFileHeader(file: File, bytesToRead: number = 8): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const blob = file.slice(0, bytesToRead);
    
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(e.target.result));
      } else {
        reject(new Error('Failed to read file header'));
      }
    };
    
    reader.onerror = () => reject(new Error('Error reading file header'));
    reader.readAsArrayBuffer(blob);
  });
}

/**
    * Validates file MIME type by checking magic bytes (file signature)
    * This prevents MIME type spoofing attacks
 */
export async function validateMimeTypeByMagicBytes(file: File, expectedMimeType: string): Promise<boolean> {
  const signatures = FILE_SIGNATURES[expectedMimeType];
  
  // If no signature defined (e.g., text/plain), fall back to extension check
  if (!signatures || signatures.length === 0) {
    return validateByExtension(file, expectedMimeType);
  }
  
  try {
    const header = await readFileHeader(file, 12); // Read first 12 bytes (enough for most signatures)
    
    // Check if any of the expected signatures match
    return signatures.some(signature => {
      if (signature.length > header.length) return false;
      
      return signature.every((byte, index) => header[index] === byte);
    });
  } catch (error) {
    console.error('Error validating magic bytes:', error);
    return false;
  }
}

/**
    * Fallback validation by file extension
 */
function validateByExtension(file: File, expectedMimeType: string): boolean {
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  
  // Map MIME types to extensions
  const mimeToExtension: Record<string, string[]> = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp']
  };
  
  const allowedExtensions = mimeToExtension[expectedMimeType];
  return allowedExtensions ? allowedExtensions.includes(extension) : false;
}
```


**Files Modified**:

- `src/utils/fileValidation.ts`

---

### Step 3: Implement File Size Validation

**Location**: `src/utils/fileValidation.ts`**Actions**:

1. Add file size validation functions:
```typescript
/**
    * Validates individual file size
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds the maximum size of ${formatBytes(MAX_FILE_SIZE)}. Current size: ${formatBytes(file.size)}`
    };
  }
  
  if (file.size === 0) {
    return {
      valid: false,
      error: `File "${file.name}" is empty`
    };
  }
  
  return { valid: true };
}

/**
    * Validates total size of multiple files
 */
export function validateTotalSize(files: File[]): { valid: boolean; error?: string } {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `Total file size (${formatBytes(totalSize)}) exceeds the maximum of ${formatBytes(MAX_TOTAL_SIZE)}`
    };
  }
  
  return { valid: true };
}

/**
    * Validates file count
 */
export function validateFileCount(files: File[]): { valid: boolean; error?: string } {
  if (files.length > MAX_FILES) {
    return {
      valid: false,
      error: `Maximum ${MAX_FILES} files allowed. You selected ${files.length} files.`
    };
  }
  
  return { valid: true };
}

/**
    * Checks for duplicate file names
 */
export function checkDuplicateNames(files: File[], existingFiles: { name: string }[]): { valid: boolean; error?: string } {
  const allNames = [...files.map(f => f.name), ...existingFiles.map(f => f.name)];
  const duplicates = allNames.filter((name, index) => allNames.indexOf(name) !== index);
  
  if (duplicates.length > 0) {
    return {
      valid: false,
      error: `Duplicate file names detected: ${[...new Set(duplicates)].join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
    * Helper to format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
```


**Files Modified**:

- `src/utils/fileValidation.ts`

---

### Step 4: Implement Content Validation

**Location**: `src/utils/fileValidation.ts`**Actions**:

1. Add content validation functions for different file types:
```typescript
/**
    * Validates PDF file content (page count)
 */
export async function validatePdfContent(file: File): Promise<{ valid: boolean; error?: string; pageCount?: number }> {
  try {
    // Import pdfjs dynamically to avoid loading in non-PDF contexts
    const pdfjsLib = await import('pdfjs-dist');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    
    if (pageCount > MAX_PDF_PAGES) {
      return {
        valid: false,
        error: `PDF "${file.name}" has ${pageCount} pages, which exceeds the maximum of ${MAX_PDF_PAGES} pages`,
        pageCount
      };
    }
    
    return { valid: true, pageCount };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate PDF "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
    * Validates image file content (dimensions)
 */
export async function validateImageContent(file: File): Promise<{ valid: boolean; error?: string; dimensions?: { width: number; height: number } }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        resolve({
          valid: false,
          error: `Image "${file.name}" dimensions (${width}x${height}) exceed the maximum of ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels`,
          dimensions: { width, height }
        });
      } else {
        resolve({ valid: true, dimensions: { width, height } });
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        valid: false,
        error: `Failed to load image "${file.name}" for validation`
      });
    };
    
    img.src = url;
  });
}

/**
    * Validates text file content (size and encoding)
 */
export async function validateTextFileContent(file: File): Promise<{ valid: boolean; error?: string }> {
  if (file.size > MAX_TEXT_FILE_SIZE) {
    return {
      valid: false,
      error: `Text file "${file.name}" exceeds the maximum size of ${formatBytes(MAX_TEXT_FILE_SIZE)}`
    };
  }
  
  try {
    // Try to read as text to validate encoding
    const text = await file.text();
    
    // Check for suspicious content (very basic check)
    if (text.length === 0) {
      return {
        valid: false,
        error: `Text file "${file.name}" is empty`
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to read text file "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
```


**Files Modified**:

- `src/utils/fileValidation.ts`

---

### Step 5: Create Comprehensive Validation Function

**Location**: `src/utils/fileValidation.ts`**Actions**:

1. Create main validation function that orchestrates all checks:
```typescript
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
    * Comprehensive file validation
    * Performs all validation checks in order and returns aggregated results
 */
export async function validateFile(
  file: File,
  existingFiles: { name: string }[] = []
): Promise<FileValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Check file size
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    errors.push(sizeCheck.error!);
    return { valid: false, errors, warnings };
  }
  
  // 2. Check MIME type is allowed
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    errors.push(`File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
    return { valid: false, errors, warnings };
  }
  
  // 3. Validate MIME type with magic bytes (prevent spoofing)
  const mimeValid = await validateMimeTypeByMagicBytes(file, file.type);
  if (!mimeValid) {
    errors.push(`File "${file.name}" MIME type does not match file content. The file may be corrupted or malicious.`);
    return { valid: false, errors, warnings };
  }
  
  // 4. Check for duplicate names
  const duplicateCheck = checkDuplicateNames([file], existingFiles);
  if (!duplicateCheck.valid) {
    errors.push(duplicateCheck.error!);
    return { valid: false, errors, warnings };
  }
  
  // 5. Content-specific validation
  if (file.type === 'application/pdf') {
    const pdfCheck = await validatePdfContent(file);
    if (!pdfCheck.valid) {
      errors.push(pdfCheck.error!);
      return { valid: false, errors, warnings };
    }
    if (pdfCheck.pageCount && pdfCheck.pageCount > 50) {
      warnings.push(`PDF "${file.name}" has ${pdfCheck.pageCount} pages, which may take longer to process`);
    }
  } else if (file.type.startsWith('image/')) {
    const imageCheck = await validateImageContent(file);
    if (!imageCheck.valid) {
      errors.push(imageCheck.error!);
      return { valid: false, errors, warnings };
    }
  } else if (file.type === 'text/plain') {
    const textCheck = await validateTextFileContent(file);
    if (!textCheck.valid) {
      errors.push(textCheck.error!);
      return { valid: false, errors, warnings };
    }
  }
  
  return { valid: true, errors, warnings };
}

/**
    * Validates multiple files
 */
export async function validateFiles(
  files: File[],
  existingFiles: { name: string }[] = []
): Promise<FileValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Check file count
  const countCheck = validateFileCount(files);
  if (!countCheck.valid) {
    errors.push(countCheck.error!);
    return { valid: false, errors, warnings };
  }
  
  // 2. Check total size
  const totalSizeCheck = validateTotalSize(files);
  if (!totalSizeCheck.valid) {
    errors.push(totalSizeCheck.error!);
    return { valid: false, errors, warnings };
  }
  
  // 3. Check for duplicates within the new batch
  const duplicateCheck = checkDuplicateNames(files, existingFiles);
  if (!duplicateCheck.valid) {
    errors.push(duplicateCheck.error!);
    return { valid: false, errors, warnings };
  }
  
  // 4. Validate each file individually
  const validationResults = await Promise.all(
    files.map(file => validateFile(file, existingFiles))
  );
  
  // Aggregate results
  validationResults.forEach((result, index) => {
    if (!result.valid) {
      errors.push(...result.errors);
    }
    warnings.push(...result.warnings);
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```


**Files Modified**:

- `src/utils/fileValidation.ts`

---

### Step 6: Update FileUploader Component - Add Validation

**Location**: `src/components/FileUploader.tsx`**Actions**:

1. Import validation utilities:
```typescript
import { validateFiles, type FileValidationResult } from '../utils/fileValidation';
```




2. Update state to track validation errors and warnings:
```typescript
const [error, setError] = useState<string | null>(null);
const [validationErrors, setValidationErrors] = useState<string[]>([]);
const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
const [isValidating, setIsValidating] = useState(false);
```




3. Update `processFiles` function to validate before processing:
```typescript
const processFiles = async (files: FileList | null) => {
  if (!files) return;

  setIsValidating(true);
  setError(null);
  setValidationErrors([]);
  setValidationWarnings([]);

  // Convert FileList to Array
  const fileArray = Array.from(files);
  
  // Get existing file names for duplicate checking
  const existingFileNames = uploadedFiles.map(f => ({ name: f.name }));

  // Validate all files
  const validationResult = await validateFiles(fileArray, existingFileNames);

  if (!validationResult.valid) {
    setValidationErrors(validationResult.errors);
    setIsValidating(false);
    return; // Stop processing if validation fails
  }

  // Show warnings if any
  if (validationResult.warnings.length > 0) {
    setValidationWarnings(validationResult.warnings);
  }

  // Process files if validation passes
  const newFiles: { file?: File; name: string; content: string; size: number }[] = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    try {
      let content = '';
      if (file.type === 'application/pdf') {
        content = await extractTextFromPdf(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        content = await extractTextFromDocx(file);
      } else if (file.type === 'text/plain') {
        content = await file.text();
      } else if (file.type.startsWith('image/')) {
        const base64Data = await convertFileToBase64(file);
        content = await extractTextFromImage(base64Data, file.type);
      } else {
        // This should not happen due to validation, but keep as safety
        console.warn(`Unsupported file type: ${file.type}`);
        continue;
      }

      newFiles.push({ file, name: file.name, content, size: file.size });
    } catch (err) {
      console.error(`Error processing file ${file.name}:`, err);
      setValidationErrors(prev => [...prev, `Failed to process ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    }
  }

  if (newFiles.length > 0) {
    onFilesSelected(newFiles);
  }

  setIsValidating(false);
};
```


**Files Modified**:

- `src/components/FileUploader.tsx`

---

### Step 7: Add Validation Error Display UI

**Location**: `src/components/FileUploader.tsx`**Actions**:

1. Add UI components to display validation errors and warnings:
```typescript
// Add after the existing error display
{validationErrors.length > 0 && (
  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
    <div className="flex items-start">
      <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-400 mb-1">Validation Errors</p>
        <ul className="text-xs text-red-300 space-y-1">
          {validationErrors.map((error, index) => (
            <li key={index} className="flex items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2 mt-1.5 flex-shrink-0"></span>
              <span>{error}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)}

{validationWarnings.length > 0 && (
  <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
    <div className="flex items-start">
      <svg className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-semibold text-yellow-400 mb-1">Warnings</p>
        <ul className="text-xs text-yellow-300 space-y-1">
          {validationWarnings.map((warning, index) => (
            <li key={index} className="flex items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-2 mt-1.5 flex-shrink-0"></span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)}

{isValidating && (
  <div className="mt-2 flex items-center text-sm text-slate-400">
    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Validating files...
  </div>
)}
```




2. Update the file input to show validation state:
```typescript
<input
  type="file"
  multiple
  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
  onChange={handleFileInput}
  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
  disabled={isLoading || isValidating}
/>
```


**Files Modified**:

- `src/components/FileUploader.tsx`

---

### Step 8: Add Progress Indicators

**Location**: `src/components/FileUploader.tsx`**Actions**:

1. Add state for tracking upload progress:
```typescript
const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
```




2. Update `processFiles` to track progress:
```typescript
// Inside processFiles, after validation passes
for (let i = 0; i < fileArray.length; i++) {
  const file = fileArray[i];
  setProcessingFiles(prev => new Set(prev).add(file.name));
  
  try {
    // Simulate progress for large files
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: Math.min((prev[file.name] || 0) + 10, 90)
      }));
    }, 200);
    
    let content = '';
    // ... existing content extraction logic ...
    
    clearInterval(progressInterval);
    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
    
    newFiles.push({ file, name: file.name, content, size: file.size });
  } catch (err) {
    // ... error handling ...
  } finally {
    setProcessingFiles(prev => {
      const next = new Set(prev);
      next.delete(file.name);
      return next;
    });
    setUploadProgress(prev => {
      const next = { ...prev };
      delete next[file.name];
      return next;
    });
  }
}
```




3. Add progress bar UI in file list:
```typescript
{uploadedFiles.map((file, index) => (
  <li key={index} className="flex items-center justify-between bg-slate-900/40 p-2.5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
    <div className="flex items-center flex-1 min-w-0 mr-2">
      <svg className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <div className="flex-1 min-w-0">
        <span className="truncate text-sm text-slate-300 block">{file.name}</span>
        {processingFiles.has(file.name) && uploadProgress[file.name] !== undefined && (
          <div className="mt-1 w-full bg-slate-700 rounded-full h-1">
            <div
              className="bg-primary h-1 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress[file.name]}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
    {/* ... rest of file item UI ... */}
  </li>
))}
```


**Files Modified**:

- `src/components/FileUploader.tsx`

---

### Step 9: Add Server-Side Validation (Optional but Recommended)

**Location**: `src/services/projectService.ts`**Actions**:

1. Add validation before upload in `uploadFileToStorage`:
```typescript
import { validateFile } from '../utils/fileValidation';

export const uploadFileToStorage = async (userId: string, projectId: string, file: File): Promise<ProjectFile> => {
  try {
    // Validate file before upload
    const validation = await validateFile(file);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Continue with existing upload logic...
    const storagePath = `users/${userId}/projects/${projectId}/files/${Date.now()}_${file.name}`;
    // ... rest of function
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};
```


**Files Modified**:

- `src/services/projectService.ts`

---

### Step 10: Update File Input Accept Attribute

**Location**: `src/components/FileUploader.tsx`**Actions**:

1. Ensure accept attribute matches allowed types:
```typescript
<input
  type="file"
  multiple
  accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt,image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp"
  onChange={handleFileInput}
  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
  disabled={isLoading || isValidating}
/>
```


**Files Modified**:

- `src/components/FileUploader.tsx`

---

## Testing Requirements

### Test Cases

1. **File Size Validation**:

- Test with file > 10MB (should fail)
- Test with file = 10MB (should pass)
- Test with empty file (should fail)
- Test with total size > 50MB (should fail)

2. **MIME Type Validation**:

- Test with valid MIME type matching content (should pass)
- Test with spoofed MIME type (e.g., rename .exe to .pdf) (should fail)
- Test with unsupported MIME type (should fail)
- Test with missing MIME type (should use extension fallback)

3. **File Count Validation**:

- Test with 11 files (should fail)
- Test with 10 files (should pass)
- Test with 0 files (should pass - no validation needed)

4. **Content Validation**:

- Test PDF with 101 pages (should fail)
- Test PDF with 100 pages (should pass)
- Test image with 5000x5000 dimensions (should fail)
- Test image with 4096x4096 dimensions (should pass)
- Test text file > 5MB (should fail)

5. **Duplicate Detection**:

- Test uploading same file twice (should fail)
- Test uploading file with same name as existing (should fail)

6. **Progress Indicators**:

- Test with large files (should show progress)
- Test with multiple files (should show progress for each)

7. **Error Display**:

- Test with multiple validation errors (should show all)
- Test with warnings (should show warnings but allow upload)

## Implementation Checklist

- [ ] Step 1: Create file validation constants
- [ ] Step 2: Implement magic bytes validation
- [ ] Step 3: Implement file size validation
- [ ] Step 4: Implement content validation
- [ ] Step 5: Create comprehensive validation function
- [ ] Step 6: Update FileUploader component - add validation
- [ ] Step 7: Add validation error display UI
- [ ] Step 8: Add progress indicators
- [ ] Step 9: Add server-side validation (optional)
- [ ] Step 10: Update file input accept attribute
- [ ] Test all validation scenarios
- [ ] Verify error messages are user-friendly
- [ ] Verify progress indicators work correctly

## File Structure After Implementation

```javascript
src/
├── utils/
│   └── fileValidation.ts          # All validation logic
├── components/
│   └── FileUploader.tsx            # Updated with validation
└── services/
    └── projectService.ts           # Optional server-side validation
```



## Important Notes

1. **Magic Bytes**: Critical for security - prevents MIME type spoofing attacks
2. **Performance**: Validation happens before processing, preventing wasted resources
3. **User Experience**: Clear error messages help users understand what went wrong