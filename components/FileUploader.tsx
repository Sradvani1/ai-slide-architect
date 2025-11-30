import React, { useCallback, useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { extractTextFromImage } from '../services/geminiService';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface FileUploaderProps {
    onFilesSelected: (files: { name: string; content: string; size: number }[]) => void;
    uploadedFiles: { name: string; content: string; size: number }[];
    onRemoveFile: (index: number) => void;
    isLoading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, uploadedFiles, onRemoveFile, isLoading }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    };

    const extractTextFromDocx = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
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
            reader.onerror = (error) => reject(error);
        });
    };

    const processFiles = async (files: FileList | null) => {
        if (!files) return;

        const newFiles: { name: string; content: string; size: number }[] = [];
        setError(null);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
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
                    console.warn(`Unsupported file type: ${file.type}`);
                    continue;
                }

                newFiles.push({ name: file.name, content, size: file.size });
            } catch (err) {
                console.error(`Error processing file ${file.name}:`, err);
                setError(`Failed to process ${file.name}`);
            }
        }

        onFilesSelected(newFiles);
    };

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (isLoading) return;
        await processFiles(e.dataTransfer.files);
    }, [isLoading]);

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLoading) return;
        await processFiles(e.target.files);
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-slate-300 mb-2">
                Source Material (PDF, DOCX, TXT, Images)
            </label>
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-6 transition-colors duration-200 ease-in-out ${isDragging
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isLoading}
                />
                <div className="text-center">
                    <svg
                        className="mx-auto h-12 w-12 text-slate-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                    >
                        <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <p className="mt-1 text-sm text-slate-400">
                        <span className="font-medium text-sky-400">Upload a file</span> or drag and drop
                    </p>
                    <p className="text-xs text-slate-500">PDF, DOCX, TXT, Images up to 10MB</p>
                </div>
            </div>

            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

            {uploadedFiles.length > 0 && (
                <ul className="mt-4 space-y-2">
                    {uploadedFiles.map((file, index) => (
                        <li key={index} className="flex items-center justify-between bg-slate-700/50 p-2 rounded text-sm text-slate-300">
                            <span className="truncate">{file.name}</span>
                            <div className="flex items-center space-x-2">
                                <span className="text-slate-500 text-xs">{(file.size / 1024).toFixed(1)} KB</span>
                                <button
                                    onClick={() => onRemoveFile(index)}
                                    className="text-slate-400 hover:text-red-400 focus:outline-none"
                                    title="Remove file"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
