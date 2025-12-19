import React, { useCallback, useState } from 'react';
import { pdfjsLib } from '../utils/pdfSetup';

import mammoth from 'mammoth';
import { extractTextFromImage } from '../services/geminiService';
import {
    validateFiles,
    validatePdfContent,
    validateImageContent,
    formatBytes,
    ALLOWED_EXTENSIONS,
    type FileValidationResult
} from '../utils/fileValidation';

interface FileUploaderProps {
    onFilesSelected: (files: { file?: File; name: string; content: string; size: number }[]) => void;
    uploadedFiles: { file?: File; name: string; content: string; size: number }[];
    onRemoveFile: (index: number) => void;
    isLoading: boolean;
}

interface FileProgress {
    progress: number;
    stage: 'validating' | 'reading' | 'extracting' | 'error' | 'done';
    error?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, uploadedFiles, onRemoveFile, isLoading }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [batchError, setBatchError] = useState<string | null>(null);
    const [fileResults, setFileResults] = useState<Record<string, FileValidationResult>>({});
    const [fileProgress, setFileProgress] = useState<Record<string, FileProgress>>({});
    const [isValidating, setIsValidating] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const readFileAsArrayBuffer = (file: File, onProgress: (p: number) => void): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            };
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsArrayBuffer(file);
        });
    };

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = reader.result as string;
                // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64Content = base64String.split(',')[1];
                resolve(base64Content);
            };
            reader.onerror = () => reject(new Error(`Failed to convert ${file.name} to base64`));
        });
    };

    const extractTextFromPdf = async (buffer: ArrayBuffer): Promise<string> => {
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    };

    const processFiles = async (files: FileList | null) => {
        if (!files) return;

        setIsValidating(true);
        setBatchError(null);
        setFileResults({});

        const fileArray = Array.from(files);
        const batchResult = await validateFiles(fileArray, uploadedFiles);

        if (!batchResult.valid) {
            setBatchError(batchResult.errors[0]);
            setIsValidating(false);
            return;
        }

        // Store validation results for feedback
        const resultsMap: Record<string, FileValidationResult> = {};
        batchResult.fileResults.forEach(r => resultsMap[r.fileName] = r);
        setFileResults(resultsMap);
        setIsValidating(false);

        const newFiles: { file?: File; name: string; content: string; size: number }[] = [];
        const validFiles = fileArray.filter(f => resultsMap[f.name]?.valid);

        for (const file of validFiles) {
            try {
                setFileProgress(prev => ({
                    ...prev,
                    [file.name]: { progress: 0, stage: 'reading' }
                }));

                const buffer = await readFileAsArrayBuffer(file, (p) => {
                    setFileProgress(prev => ({
                        ...prev,
                        [file.name]: { ...prev[file.name], progress: p }
                    }));
                });

                setFileProgress(prev => ({
                    ...prev,
                    [file.name]: { progress: 100, stage: 'extracting' }
                }));

                let content = '';
                const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;

                if (file.type === 'application/pdf' || ext === '.pdf') {
                    const pdfCheck = await validatePdfContent(buffer, file.name);
                    if (!pdfCheck.valid) throw new Error(pdfCheck.error);
                    content = await extractTextFromPdf(buffer);
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
                    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                    content = result.value;
                } else if (file.type === 'text/plain' || ext === '.txt') {
                    content = new TextDecoder().decode(buffer);
                } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
                    const imgCheck = await validateImageContent(file);
                    if (!imgCheck.valid) throw new Error(imgCheck.error);

                    const base64Content = await convertFileToBase64(file);
                    content = await extractTextFromImage(base64Content, file.type || 'image/jpeg');
                }

                newFiles.push({ file, name: file.name, content, size: file.size });
                setFileProgress(prev => ({
                    ...prev,
                    [file.name]: { progress: 100, stage: 'done' }
                }));
            } catch (err) {
                console.error(`Error processing file ${file.name}:`, err);
                setFileProgress(prev => ({
                    ...prev,
                    [file.name]: { progress: 100, stage: 'error', error: err instanceof Error ? err.message : 'Processing failed' }
                }));
            }
        }

        if (newFiles.length > 0) {
            onFilesSelected(newFiles);
        }

        // Only clear progress for successful files
        setTimeout(() => {
            setFileProgress(prev => {
                const next = { ...prev };
                newFiles.forEach(f => {
                    if (next[f.name]?.stage === 'done') {
                        delete next[f.name];
                    }
                });
                return next;
            });
        }, 5000);
    };

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (isLoading || isValidating) return;
        await processFiles(e.dataTransfer.files);
    }, [isLoading, isValidating]);

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLoading || isValidating) return;
        await processFiles(e.target.files);
    };


    return (
        <div className="w-full" aria-busy={(isLoading || isValidating)}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Reference Material
            </label>
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 group ${isDragging
                    ? 'border-primary bg-primary/10'
                    : 'border-slate-300 hover:border-primary/50 bg-[#FAFAF8] hover:bg-[rgba(33,128,234,0.02)]'
                    } ${(isLoading || isValidating) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <input
                    type="file"
                    multiple
                    accept={ALLOWED_EXTENSIONS.join(',')}
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isLoading || isValidating}
                    aria-label="Upload reference files"
                />
                <div className="text-center">
                    <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragging ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-400 group-hover:text-primary group-hover:bg-slate-800/80'
                        }`}>
                        {isValidating || isLoading ? (
                            <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg
                                className="h-6 w-6"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-slate-300 font-medium">
                        {isValidating ? 'Validating files...' : isLoading ? 'Processing...' : 'Click or drag files here'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT, Images (Max 10MB per file)</p>
                </div>
            </div>

            {/* Batch & Individual Errors */}
            <div className="mt-2 space-y-1" aria-live="polite">
                {batchError && (
                    <div role="alert" className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center text-xs text-red-400">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {batchError}
                    </div>
                )}

                {(Object.values(fileResults) as FileValidationResult[]).filter(r => !r.valid).map((r, i) => (
                    <div key={i} role="alert" className="p-2 bg-red-500/5 border border-red-500/30 rounded text-xs text-red-400 flex items-start">
                        <svg className="w-3.5 h-3.5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="flex-1">{r.errors.join(', ')}</span>
                    </div>
                ))}

                {(Object.values(fileResults) as FileValidationResult[]).filter(r => r.valid && r.warnings.length > 0).map((r, i) => (
                    <div key={i} className="p-2 bg-yellow-500/5 border border-yellow-500/30 rounded text-xs text-yellow-400 flex items-start">
                        <svg className="w-3.5 h-3.5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="flex-1">{r.warnings.join(', ')}</span>
                    </div>
                ))}
            </div>

            {uploadedFiles.length > 0 && (
                <ul className="mt-4 space-y-2">
                    {uploadedFiles.map((file, index) => (
                        <li key={index} className="flex flex-col bg-slate-900/40 p-2.5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center flex-1 min-w-0 mr-2">
                                    <svg className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="truncate text-sm text-slate-300">{file.name}</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <span className="text-slate-600 text-[10px] uppercase font-bold tracking-wide">{formatBytes(file.size)}</span>
                                    <button
                                        onClick={() => onRemoveFile(index)}
                                        className="text-slate-500 hover:text-red-400 focus:outline-none transition-colors p-1 hover:bg-red-400/10 rounded"
                                        title="Remove file"
                                        aria-label={`Remove ${file.name}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Processing Status for active files */}
                            {fileProgress[file.name] && (
                                <div className="mt-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[10px] uppercase font-bold ${fileProgress[file.name].stage === 'error' ? 'text-red-400' : 'text-primary'}`}>
                                            {fileProgress[file.name].stage === 'error'
                                                ? `Error: ${fileProgress[file.name].error}`
                                                : fileProgress[file.name].stage === 'done'
                                                    ? 'Ready'
                                                    : `${fileProgress[file.name].stage}...`
                                            }
                                        </span>
                                        <span className="text-[10px] text-slate-500">{fileProgress[file.name].progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-1">
                                        <div
                                            className={`h-1 rounded-full transition-all duration-300 ease-in-out ${fileProgress[file.name].stage === 'error' ? 'bg-red-500' : 'bg-primary'}`}
                                            role="progressbar"
                                            aria-valuenow={fileProgress[file.name].progress}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-label={`${file.name} processing progress`}
                                            style={{ width: `${fileProgress[file.name].progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

