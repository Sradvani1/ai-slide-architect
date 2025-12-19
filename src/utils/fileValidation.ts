import { pdfjsLib } from './pdfSetup';

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
    'image/webp'
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

/**
 * Type guard for AllowedMimeType
 */
export function isAllowedMimeType(type: string): type is AllowedMimeType {
    return ALLOWED_MIME_TYPES.includes(type as AllowedMimeType);
}

// File extensions mapping for browser compatibility
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp'] as const;

// Content validation limits
export const MAX_PDF_PAGES = 100;
export const MAX_IMAGE_DIMENSION = 4096; // pixels (width or height)
export const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024; // 5MB for text files
export const MAX_DOCX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for docx

/**
 * Maps extension to potential MIME types for fallback validation
 */
export const EXTENSION_TO_MIME: Record<string, AllowedMimeType[]> = {
    '.pdf': ['application/pdf'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.txt': ['text/plain'],
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.webp': ['image/webp']
};

/**
 * Magic bytes (file signatures) for MIME type validation
 * Logic: All items in the array for a given MIME type MUST match (AND logic)
 */
export interface SignatureCheck {
    bytes: number[][]; // OR logic within single check (multiple potential valid prefixes)
    offset: number;
}

export const FILE_SIGNATURE_SCHEMA: Record<string, SignatureCheck[]> = {
    'application/pdf': [{ bytes: [[0x25, 0x50, 0x44, 0x46]], offset: 0 }], // %PDF
    'image/png': [{ bytes: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], offset: 0 }], // PNG
    'image/jpeg': [{ bytes: [[0xFF, 0xD8, 0xFF]], offset: 0 }], // JPEG
    'image/webp': [
        { bytes: [[0x52, 0x49, 0x46, 0x46]], offset: 0 }, // RIFF at start
        { bytes: [[0x57, 0x45, 0x42, 0x50]], offset: 8 } // WEBP at offset 8
    ],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        { bytes: [[0x50, 0x4B, 0x03, 0x04]], offset: 0 } // ZIP header
    ]
};

export interface FileValidationResult {
    fileName: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface BatchValidationResult {
    valid: boolean;
    errors: string[];
    fileResults: FileValidationResult[];
}

/**
 * Helper to format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Reads specified bytes of a file to check magic bytes
 */
async function readFileHeader(file: File, bytesToRead: number = 16): Promise<Uint8Array> {
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
 * Validates file MIME type by checking magic bytes
 */
export async function validateMimeTypeByMagicBytes(file: File, expectedMimeType: string): Promise<boolean> {
    const checks = FILE_SIGNATURE_SCHEMA[expectedMimeType];

    if (!checks || checks.length === 0) {
        // text/plain doesn't have a reliable header, but we check for binary content elsewhere
        return expectedMimeType === 'text/plain';
    }

    try {
        const header = await readFileHeader(file, 20); // Read 20 bytes to cover WebP offset 8

        return checks.every(check => {
            return check.bytes.some(sig => {
                if (sig.length + check.offset > header.length) return false;
                return sig.every((byte, index) => header[check.offset + index] === byte);
            });
        });
    } catch (error) {
        console.error('Error validating magic bytes:', error);
        return false;
    }
}

/**
 * Standardized error message generator
 */
function createError(fileName: string, message: string): string {
    return `File "${fileName}": ${message}`;
}

/**
 * Validates individual file size and extension
 */
export function validateFileBasic(file: File): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (file.size > MAX_FILE_SIZE) {
        errors.push(createError(file.name, `Size ${formatBytes(file.size)} exceeds ${formatBytes(MAX_FILE_SIZE)} limit`));
    }
    if (file.size === 0) {
        errors.push(createError(file.name, 'File is empty'));
    }

    const ext = file.name.slice((file.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
    const extension = ext ? `.${ext}` : '';

    if (!ALLOWED_EXTENSIONS.includes(extension as any)) {
        errors.push(createError(file.name, `Extension "${extension || 'none'}" is not supported`));
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates text file content for size and binary markers
 */
export async function validateTextFileContent(file: File): Promise<{ valid: boolean; error?: string }> {
    if (file.size > MAX_TEXT_FILE_SIZE) {
        return { valid: false, error: createError(file.name, `Text file exceeds ${formatBytes(MAX_TEXT_FILE_SIZE)}`) };
    }

    try {
        // Read first 1024 bytes to check for binary/null markers
        const header = await readFileHeader(file, 1024);
        for (let i = 0; i < header.length; i++) {
            if (header[i] === 0) {
                return { valid: false, error: createError(file.name, 'Binary data detected in text file') };
            }
        }
        return { valid: true };
    } catch (err) {
        return { valid: false, error: createError(file.name, 'Failed to validate text content') };
    }
}

/**
 * Content validation for PDF
 */
export async function validatePdfContent(buffer: ArrayBuffer, fileName: string): Promise<{ valid: boolean; error?: string; pageCount?: number }> {
    try {
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const pageCount = pdf.numPages;

        if (pageCount > MAX_PDF_PAGES) {
            return {
                valid: false,
                error: createError(fileName, `Contains ${pageCount} pages, maximum is ${MAX_PDF_PAGES}`)
            };
        }
        return { valid: true, pageCount };
    } catch (error) {
        console.error(`PDF Validation failed for ${fileName}:`, error);
        return { valid: false, error: createError(fileName, 'Invalid or corrupted PDF file') };
    }
}

/**
 * Content validation for Image
 */
export async function validateImageContent(file: File): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            if (img.width > MAX_IMAGE_DIMENSION || img.height > MAX_IMAGE_DIMENSION) {
                resolve({
                    valid: false,
                    error: createError(file.name, `Dimensions (${img.width}x${img.height}) exceed ${MAX_IMAGE_DIMENSION}px limit`)
                });
            } else {
                resolve({ valid: true });
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ valid: false, error: createError(file.name, 'Invalid or corrupted image file') });
        };

        img.src = url;
    });
}

/**
 * Checks for duplicate file names (case-insensitive)
 */
export function checkDuplicateNames(files: File[], existingFiles: { name: string }[]): string[] {
    const allNames = existingFiles.map(f => f.name.toLowerCase());
    const newNames = files.map(f => f.name.toLowerCase());
    const duplicates: string[] = [];

    newNames.forEach((name, index) => {
        // Check against existing
        if (allNames.includes(name)) {
            duplicates.push(files[index].name);
        }
        // Check against others in new batch
        else if (newNames.indexOf(name) !== index) {
            duplicates.push(files[index].name);
        }
    });

    return [...new Set(duplicates)];
}

/**
 * Validates multiple files
 */
export async function validateFiles(
    files: File[],
    existingFiles: { name: string }[] = []
): Promise<BatchValidationResult> {
    const batchErrors: string[] = [];

    // 1. Batch level checks (reject whole batch)
    if (files.length > MAX_FILES) {
        return {
            valid: false,
            errors: [`Maximum of ${MAX_FILES} files allowed per upload.`],
            fileResults: []
        };
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
        return {
            valid: false,
            errors: [`Total size (${formatBytes(totalSize)}) exceeds maximum of ${formatBytes(MAX_TOTAL_SIZE)}`],
            fileResults: []
        };
    }

    // 2. Individual file checks (allow partial success)
    const duplicates = checkDuplicateNames(files, existingFiles);

    const fileResults = await Promise.all(files.map(async (file) => {
        const result: FileValidationResult = {
            fileName: file.name,
            valid: true,
            errors: [],
            warnings: []
        };

        // Extension and size check
        const basicCheck = validateFileBasic(file);
        if (!basicCheck.valid) result.errors.push(...basicCheck.errors);

        // Duplicate check
        if (duplicates.includes(file.name)) {
            result.errors.push(createError(file.name, 'Duplicate file name'));
        }

        // Type check (Handle empty MIME types)
        let mimeType = file.type;
        const parts = file.name.split('.');
        const ext = parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';

        if (!mimeType && ext && EXTENSION_TO_MIME[ext]) {
            mimeType = EXTENSION_TO_MIME[ext][0];
        }

        if (!mimeType || !isAllowedMimeType(mimeType)) {
            result.errors.push(createError(file.name, `File type "${mimeType || 'unknown'}" is not supported`));
        } else {
            // Magic bytes check (Spoof detection)
            const magicValid = await validateMimeTypeByMagicBytes(file, mimeType);
            if (!magicValid) {
                result.errors.push(createError(file.name, 'Content does not match file extension (potential spoofing)'));
            }

            // Content validation for text files
            if (mimeType === 'text/plain') {
                const textCheck = await validateTextFileContent(file);
                if (!textCheck.valid) result.errors.push(textCheck.error!);
            }
        }

        result.valid = result.errors.length === 0;
        return result;
    }));

    return {
        valid: true,
        errors: [],
        fileResults
    };
}
