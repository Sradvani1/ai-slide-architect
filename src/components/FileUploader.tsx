import React, { useCallback, useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { extractTextFromImage } from '../services/geminiService';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface FileUploaderProps {
    onFilesSelected: (files: { file?: File; name: string; content: string; size: number }[]) => void;
    uploadedFiles: { file?: File; name: string; content: string; size: number }[];
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

        const newFiles: { file?: File; name: string; content: string; size: number }[] = [];
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

                newFiles.push({ file, name: file.name, content, size: file.size });
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
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isLoading}
                />
                <div className="text-center">
                    <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragging ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-400 group-hover:text-primary group-hover:bg-slate-800/80'
                        }`}>
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
                    </div>
                    <p className="mt-1 text-sm text-slate-300 font-medium">
                        Click or drag files here
                    </p>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT, Images</p>
                </div>
            </div>

            {error && <p className="mt-2 text-xs text-red-400 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2"></span>{error}</p>}

            {uploadedFiles.length > 0 && (
                <ul className="mt-4 space-y-2">
                    {uploadedFiles.map((file, index) => (
                        <li key={index} className="flex items-center justify-between bg-slate-900/40 p-2.5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
                            <div className="flex items-center flex-1 min-w-0 mr-2">
                                <svg className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="truncate text-sm text-slate-300">{file.name}</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <span className="text-slate-600 text-[10px] uppercase font-bold tracking-wide">{(file.size / 1024).toFixed(0)} KB</span>
                                <button
                                    onClick={() => onRemoveFile(index)}
                                    className="text-slate-500 hover:text-red-400 focus:outline-none transition-colors p-1 hover:bg-red-400/10 rounded"
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
