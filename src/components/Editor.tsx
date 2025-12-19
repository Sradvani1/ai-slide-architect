import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from 'firebase/auth';
import { InputForm } from './InputForm';
import { SlideDeck } from './SlideDeck';
import { generateSlidesFromDocument } from '../services/geminiService';
import { createProject, updateProject, updateSlide, getProject, uploadFileToStorage } from '../services/projectService';
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
    const [sources, setSources] = useState<string[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Close sidebar automatically when slides are generated on mobile
    useEffect(() => {
        if (slides && window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    }, [slides]);

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
                    setAdditionalInstructions(project.additionalInstructions || '');
                    setSlides(project.slides);
                    setSources(project.sources || []);
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
            const uploadedFileNames = uploadedFiles.map(f => f.name);

            const { slides: generatedSlides, sources: generatedSources, inputTokens, outputTokens, warnings, webSearchQueries } = await generateSlidesFromDocument(topic, gradeLevel, subject, sourceMaterial, numSlides, useWebSearch, creativityLevel, bulletsPerSlide, additionalInstructions, uploadedFileNames);
            setSlides(generatedSlides);
            setSources(generatedSources);

            // Grounding UI data is no longer displayed here, as it's stored in slides directly now.

            if (warnings && warnings.length > 0) {
                console.warn("Generation Warnings:", warnings);
            }

            if (webSearchQueries) {
                console.log("Web Search Queries Used:", webSearchQueries);
            }

            if (user) {
                // 1. Create project with slides first
                const newProjectId = await createProject(user.uid, {
                    title: topic,
                    topic,
                    gradeLevel,
                    subject,
                    additionalInstructions,
                    slides: generatedSlides,
                    sources: generatedSources,
                    inputTokens,
                    outputTokens
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

    const handleUpdateSlide = (index: number, patch: Partial<Slide>) => {
        setSlides(prevSlides => {
            if (!prevSlides) return prevSlides;
            const newSlides = [...prevSlides]; // Shallow copy array
            const oldSlide = newSlides[index];
            if (!oldSlide) return prevSlides; // Safety check

            // Merge patch into local state
            newSlides[index] = { ...oldSlide, ...patch };

            // Immediate Atomic Update (Debounce can be handled by UI if needed, but Firestore handles rapid writes well on different docs)
            if (user && currentProjectId && oldSlide.id) {
                // Fire and forget (or track pending state if robust)
                // We pass ONLY the patch to the service
                updateSlide(user.uid, currentProjectId, oldSlide.id, patch).catch(console.error);
            }

            return newSlides;
        });
    };

    return (
        <div className="flex flex-1 overflow-hidden relative z-10 h-full bg-background">
            {/* Mobile Header / Toggle */}
            <div className="fixed top-4 left-4 z-[60] md:hidden flex items-center gap-2">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="flex items-center justify-center p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 border border-white/20 active:scale-95 transition-all"
                    title="Open Settings"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-9.75 0h9.75" />
                    </svg>
                    {(!slides || slides.length === 0) && <span className="ml-2 text-sm font-bold">Configure</span>}
                </button>
            </div>

            {/* Back to Dashboard Button (Desktop) */}
            <div className="absolute top-4 right-4 z-50 hidden md:block">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center space-x-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-border-light rounded-full text-secondary-text hover:text-primary hover:border-primary transition-all shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    <span className="text-sm font-semibold">Dashboard</span>
                </button>
            </div>

            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] md:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-[80] w-[85%] max-w-[400px] bg-white shadow-2xl transform transition-transform duration-300 ease-out flex flex-col h-full
                    md:relative md:translate-x-0 md:w-[400px] md:shadow-none md:border-r md:border-border-light md:z-20
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="p-6 border-b border-border-light flex justify-between items-center bg-white sticky top-0 z-10">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center space-x-2 text-secondary-text hover:text-primary transition-colors group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        <span className="font-bold text-sm">Dashboard</span>
                    </button>

                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="md:hidden p-2 text-secondary-text hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
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
            <main className="flex-1 overflow-y-auto w-full relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent h-full">
                <div className="container mx-auto px-4 py-8 md:p-8 max-w-7xl pt-20 md:pt-8">
                    <SlideDeck
                        slides={slides}
                        sources={sources}
                        isLoading={isLoading}
                        error={error}
                        onUpdateSlide={handleUpdateSlide}
                        creativityLevel={creativityLevel}
                        userId={user.uid}
                        projectId={currentProjectId}
                    />
                </div>
            </main>
        </div>
    );
};
