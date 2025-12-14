import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from 'firebase/auth';
import { InputForm } from './InputForm';
import { SlideDeck } from './SlideDeck';
import { generateSlidesFromDocument } from '../services/geminiService';
import { createProject, updateProject, getProject, uploadFileToStorage } from '../services/projectService';
import { DEFAULT_NUM_SLIDES, DEFAULT_TEMPERATURE, DEFAULT_BULLETS_PER_SLIDE } from '../constants';
import type { Slide, ProjectFile } from '../types';

interface EditorProps {
    user: User;
}

export const Editor: React.FC<EditorProps> = ({ user }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    const [topic, setTopic] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [subject, setSubject] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<{
        file?: File;
        name: string;
        content: string;
        size: number;
        downloadUrl?: string;
        storagePath?: string;
    }[]>([]);
    const [numSlides, setNumSlides] = useState<number>(DEFAULT_NUM_SLIDES);
    const [useWebSearch, setUseWebSearch] = useState<boolean>(true);
    const [creativityLevel, setCreativityLevel] = useState<number>(DEFAULT_TEMPERATURE);
    const [bulletsPerSlide, setBulletsPerSlide] = useState<number>(DEFAULT_BULLETS_PER_SLIDE);
    const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
    const [slides, setSlides] = useState<Slide[] | null>(null);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Initialize state if loading an existing project
    useEffect(() => {
        const loadProject = async () => {
            if (projectId) {
                setIsLoading(true);
                setError(null); // Reset error when loading a different project
                const project = await getProject(user.uid, projectId);
                if (project) {
                    setTopic(project.title);
                    setGradeLevel(project.gradeLevel);
                    setSubject(project.subject);
                    setSlides(project.slides);
                    setCurrentProjectId(project.id!);

                    // Load files if they exist
                    if (project.files && project.files.length > 0) {
                        setUploadedFiles(project.files.map(f => ({
                            name: f.name,
                            content: f.extractedContent || '', // Use stored content if available
                            size: f.size,
                            downloadUrl: f.downloadUrl,
                            storagePath: f.storagePath
                        })));
                    }
                    // Don't reset numSlides, useWebSearch, creativityLevel - they persist as user preferences
                } else {
                    setError("Project not found.");
                }
                setIsLoading(false);
            } else {
                // Reset for new project
                setTopic('');
                setGradeLevel('');
                setSubject('');
                setAdditionalInstructions('');
                setSlides(null);
                setCurrentProjectId(null);
                setUploadedFiles([]);
                setError(null);
            }
        };

        loadProject();
    }, [projectId, user.uid]);

    // Enforce Mutual Exclusivity: Web Search (Researcher Mode) vs. Uploaded Files (Curator Mode)
    useEffect(() => {
        if (uploadedFiles.length > 0) {
            setUseWebSearch(false);
        } else {
            setUseWebSearch(true);
        }
    }, [uploadedFiles.length]);

    const handleFilesSelected = (files: { file?: File; name: string; content: string; size: number }[]) => {
        setUploadedFiles((prev) => [...prev, ...files]);
    };

    const handleRemoveFile = (index: number) => {
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleGenerateSlides = useCallback(async () => {
        if (!topic || !gradeLevel || !subject) {
            setError("Please provide a topic, grade level, and subject for your presentation.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setSlides(null);

        try {
            // Upload files to storage first if they haven't been uploaded yet
            // We need a temp ID for the path if it's a new project, or use a placeholder
            // Strategy: Create project ID first? No, we need slides to create project.
            // Alternative: Use a temporary ID or just use timestamp in path. 
            // Better: If we have currentProjectId, use it. If not, generate a new ID later.
            // For now, let's just upload. Project sorting happens in projectService. 
            // Wait, uploadFileToStorage needs projectId.
            // If new project, we don't have ID yet. 
            // Solution: We'll generate a UUID for the new project structure in generic way or just use 'temp' and move? No.
            // Simplest: Generate the slots content first (AI), then Create Project, then Upload Files, then Update Project with files.

            const sourceMaterial = uploadedFiles.map(f => `File: ${f.name}\n---\n${f.content}\n---`).join('\n\n');
            const generatedSlides = await generateSlidesFromDocument(topic, gradeLevel, subject, sourceMaterial, numSlides, useWebSearch, creativityLevel, bulletsPerSlide, additionalInstructions);
            setSlides(generatedSlides);

            if (user) {
                // 1. Create project with slides first
                const newProjectId = await createProject(user.uid, {
                    title: topic,
                    topic,
                    gradeLevel,
                    subject,
                    slides: generatedSlides
                });

                setCurrentProjectId(newProjectId);

                // 2. Upload files and update project
                const uploadedProjectFiles: ProjectFile[] = [];

                for (const fileData of uploadedFiles) {
                    // If already has storage path (from loaded project), keep it
                    if (fileData.storagePath && fileData.downloadUrl) {
                        uploadedProjectFiles.push({
                            id: crypto.randomUUID(),
                            name: fileData.name,
                            storagePath: fileData.storagePath,
                            downloadUrl: fileData.downloadUrl,
                            mimeType: 'application/octet-stream', // We might lose original type if not stored, but acceptable
                            size: fileData.size,
                            extractedContent: fileData.content
                        });
                    }
                    // If new file (has File object), upload it
                    else if (fileData.file) {
                        const projectFile = await uploadFileToStorage(user.uid, newProjectId, fileData.file);
                        projectFile.extractedContent = fileData.content; // Store extracted text for reuse
                        uploadedProjectFiles.push(projectFile);
                    }
                }

                // 3. Update project with file metadata
                if (uploadedProjectFiles.length > 0) {
                    await updateProject(user.uid, newProjectId, { files: uploadedProjectFiles });

                    // Update local state to reflect uploaded status
                    setUploadedFiles(uploadedProjectFiles.map(f => ({
                        name: f.name,
                        content: f.extractedContent || '',
                        size: f.size,
                        downloadUrl: f.downloadUrl,
                        storagePath: f.storagePath
                    })));
                }

                // Update URL to new project ID, replacing history so back button returns to dashboard
                navigate(`/project/${newProjectId}`, { replace: true });

            }
        } catch (e) {
            console.error(e);
            setError("Failed to generate slides. Please check your input and try again.");
        } finally {
            setIsLoading(false);
        }
    }, [topic, gradeLevel, subject, uploadedFiles, numSlides, useWebSearch, creativityLevel, bulletsPerSlide, additionalInstructions, user, navigate]);

    const handleUpdateSlide = (index: number, updatedSlide: Slide) => {
        if (!slides) return;

        const newSlides = [...slides];
        newSlides[index] = updatedSlide;

        setSlides(newSlides);

        // Debounced Auto-Save
        if (user && currentProjectId) {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(() => {
                updateProject(user.uid, currentProjectId, {
                    slides: newSlides
                }).catch(console.error);
            }, 2000); // 2 second debounce
        }
    };

    return (
        <div className="flex flex-1 overflow-hidden relative z-10 h-full">
            {/* Back to Dashboard Button (Mobile/Desktop) */}
            <div className="absolute top-4 right-4 z-50 md:hidden">
                <button onClick={() => navigate('/')} className="text-xs bg-slate-800 text-white px-3 py-1 rounded-full border border-white/10">Dictation</button>
            </div>

            {/* Sidebar */}
            <aside className="hidden md:flex flex-col w-[400px] border-r border-border-light bg-background h-full relative z-20">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center space-x-2 text-slate-400 hover:text-primary transition-colors group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        <span className="font-semibold text-sm">Dashboard</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <InputForm
                        topic={topic}
                        setTopic={setTopic}
                        gradeLevel={gradeLevel}
                        setGradeLevel={setGradeLevel}
                        subject={subject}
                        setSubject={setSubject}
                        onFilesSelected={handleFilesSelected}
                        uploadedFiles={uploadedFiles}
                        onRemoveFile={handleRemoveFile}
                        numSlides={numSlides}
                        setNumSlides={setNumSlides}
                        useWebSearch={useWebSearch}
                        setUseWebSearch={setUseWebSearch}
                        onSubmit={handleGenerateSlides}
                        isLoading={isLoading}
                        creativityLevel={creativityLevel}
                        setCreativityLevel={setCreativityLevel}
                        bulletsPerSlide={bulletsPerSlide}
                        setBulletsPerSlide={setBulletsPerSlide}
                        additionalInstructions={additionalInstructions}
                        setAdditionalInstructions={setAdditionalInstructions}
                    />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto w-full relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent h-full">
                <div className="container mx-auto p-4 md:p-8 max-w-7xl">
                    <SlideDeck
                        slides={slides}
                        isLoading={isLoading}
                        error={error}
                        onUpdateSlide={handleUpdateSlide}
                        gradeLevel={gradeLevel}
                        subject={subject}
                        creativityLevel={creativityLevel}
                    />
                </div>
            </main>
        </div>
    );
};
