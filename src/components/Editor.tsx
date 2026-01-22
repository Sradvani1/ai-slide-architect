import React, { useState, useCallback, useEffect } from 'react';
import { doc, onSnapshot, serverTimestamp, getDoc, updateDoc, deleteField, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Added db
import { useNavigate, useParams } from 'react-router-dom';
import { User } from 'firebase/auth';
import { InputForm } from './InputForm';
import { SlideDeck } from './SlideDeck';
import { generateSlidesFromDocument } from '../services/geminiService';
import { createProject, updateProject, updateSlide, getProject, uploadFileToStorage, ProjectData } from '../services/projectService';
import { DEFAULT_NUM_SLIDES, DEFAULT_BULLETS_PER_SLIDE } from '../constants';
import type { Slide, ProjectFile } from '../types';

interface EditorProps {
    user: User;
}



export const Editor: React.FC<EditorProps> = ({ user }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    const [topic, setTopic] = useState('');
    const [projectTitle, setProjectTitle] = useState('');
    const [projectTopic, setProjectTopic] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [subject, setSubject] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<{
        file?: File;
        name: string;
        content: string;
        size: number;
        downloadUrl?: string;
        storagePath?: string;
        inputTokens?: number;
        outputTokens?: number;
    }[]>([]);
    const [numSlides, setNumSlides] = useState<number>(DEFAULT_NUM_SLIDES);
    const [useWebSearch, setUseWebSearch] = useState<boolean>(true);
    const [bulletsPerSlide, setBulletsPerSlide] = useState<number>(DEFAULT_BULLETS_PER_SLIDE);
    const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
    const [slides, setSlides] = useState<Slide[] | null>(null);
    const [sources, setSources] = useState<string[]>([]);
    const [researchContent, setResearchContent] = useState<string>('');
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null);
    const [isLoading, setIsLoading] = useState<boolean>(!!projectId);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [generationProgress, setGenerationProgress] = useState<number | undefined>(undefined);
    const [isRetrying, setIsRetrying] = useState<boolean>(false);

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
                    setProjectTitle(project.title || '');
                    setProjectTopic(project.topic || '');
                    setGradeLevel(project.gradeLevel);
                    setSubject(project.subject);
                    setAdditionalInstructions(project.additionalInstructions || '');
                    setSlides(project.slides || null);
                    setSources(project.sources || []);
                    setResearchContent(project.researchContent || '');
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
                    // Only set isLoading(false) if project is NOT generating
                    // The Firestore listener will handle status updates for generating projects
                    if (project.status !== 'generating') {
                        setIsLoading(false);
                    }
                    // If status is 'generating', keep isLoading=true and let the listener handle it
                } else {
                    setError("Project not found.");
                    setIsLoading(false);
                }
            } else {
                // Reset for new project
                setTopic('');
                setProjectTitle('');
                setProjectTopic('');
                setGradeLevel('');
                setSubject('');
                setAdditionalInstructions('');
                setSlides(null);
                setCurrentProjectId(null);
                setUploadedFiles([]);
                setResearchContent('');
                setError(null);
                setIsLoading(false);
            }
        };

        loadProject();
    }, [projectId, user.uid]);

    // Firestore listener for real-time updates when a project is generating
    useEffect(() => {
        if (!projectId || !user) return;

        let isMounted = true;
        const projectRef = doc(db, 'users', user.uid, 'projects', projectId);
        const unsubscribe = onSnapshot(projectRef, (snapshot) => {
            if (!snapshot.exists()) {
                if (isMounted) {
                    setError("Project was deleted");
                    setIsLoading(false);
                    navigate('/');
                }
                return;
            }

            if (!isMounted) return;

            const projectData = snapshot.data() as ProjectData;
            setProjectTitle(projectData.title || '');
            setProjectTopic(projectData.topic || '');
            setResearchContent(projectData.researchContent || '');

            // Handle timeout detection (10 mins)
            if (projectData.status === 'generating' && projectData.generationStartedAt) {
                const startTime = typeof projectData.generationStartedAt.toMillis === 'function'
                    ? projectData.generationStartedAt.toMillis()
                    : new Date(projectData.generationStartedAt as any).getTime();
                const elapsed = Date.now() - startTime;
                if (elapsed > 10 * 60 * 1000) {
                    console.warn("Generation taking longer than expected for project:", projectId);
                }
            }

            // Update loading state and slides based on status
            if (projectData.status === 'generating') {
                setIsLoading(true);
                setGenerationProgress(projectData.generationProgress);
            } else if (projectData.status === 'completed') {
                setIsLoading(false);
                setGenerationProgress(100);
                if (projectData.sources) {
                    setSources(projectData.sources);
                }
            } else if (projectData.status === 'failed') {
                setIsLoading(false);
                setError(projectData.generationError || "Generation failed. Please try again.");
            }
        }, (error: unknown) => {
            console.error("Firestore listener error:", error);
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [projectId, user, navigate]);

    // Firestore listener for real-time updates to slides subcollection
    useEffect(() => {
        if (!projectId || !user) return;

        const slidesRef = collection(db, 'users', user.uid, 'projects', projectId, 'slides');
        const q = query(slidesRef, orderBy('sortOrder', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const updatedSlides = snapshot.docs.map(doc => doc.data() as Slide);
            setSlides(updatedSlides);
        }, (error: unknown) => {
            console.error("Slides listener error:", error);
        });

        return () => unsubscribe();
    }, [projectId, user]);

    // Ensure Web Search is forced ON if no files are uploaded
    useEffect(() => {
        if (uploadedFiles.length === 0) {
            setUseWebSearch(true);
        }
    }, [uploadedFiles.length]);

    const handleFilesSelected = (files: { file?: File; name: string; content: string; size: number; inputTokens?: number; outputTokens?: number }[]) => {
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
        setGenerationProgress(0);

        let newProjectId: string | null = null;
        try {
            // Filter out files with empty content and build sourceMaterial
            const sourceMaterial = uploadedFiles
                .filter(f => f.content && f.content.trim().length > 0)
                .map(f => `File: ${f.name}\n---\n${f.content}\n---`)
                .join('\n\n');
            const uploadedFileNames = uploadedFiles.map(f => f.name);

            if (user) {
                // 1. Create project IMMEDIATELY with generating status
                newProjectId = await createProject(user.uid, {
                    title: topic,
                    topic,
                    gradeLevel,
                    subject,
                    additionalInstructions,
                    slides: [], // Empty initially
                    sources: [],
                    status: 'generating',
                    generationProgress: 0,
                    // generationStartedAt removed, backend sets it
                });

                setCurrentProjectId(newProjectId);

                // 2. Upload files first (if any)
                const uploadedProjectFiles: ProjectFile[] = [];
                for (const fileData of uploadedFiles) {
                    if (fileData.storagePath && fileData.downloadUrl) {
                        uploadedProjectFiles.push({
                            id: crypto.randomUUID(),
                            name: fileData.name,
                            storagePath: fileData.storagePath,
                            downloadUrl: fileData.downloadUrl,
                            mimeType: 'application/octet-stream',
                            size: fileData.size,
                            extractedContent: fileData.content
                        });
                    } else if (fileData.file) {
                        const projectFile = await uploadFileToStorage(user.uid, newProjectId, fileData.file);
                        projectFile.extractedContent = fileData.content;
                        uploadedProjectFiles.push(projectFile);
                    }
                }

                if (uploadedProjectFiles.length > 0) {
                    await updateProject(user.uid, newProjectId, { files: uploadedProjectFiles });
                }

                // 3. Navigate to project page immediately (this triggers the Firestore listener)
                navigate(`/project/${newProjectId}`, { replace: true });

                // 4. Start generation (fire and forget - updates Firestore directly)
                try {
                    await generateSlidesFromDocument(
                        topic,
                        gradeLevel,
                        subject,
                        sourceMaterial,
                        numSlides,
                        useWebSearch,
                        bulletsPerSlide,
                        additionalInstructions,
                        newProjectId,
                        uploadedFileNames
                    );
                } catch (genError) {
                    console.error("Generation start error:", genError);
                    // If project was created but generation failed to start
                    if (newProjectId) {
                        await updateProject(user.uid, newProjectId, {
                            status: 'failed',
                            generationError: "Failed to start generation. Please try again."
                        });
                    }
                    setError("Failed to start generation. Please try again.");
                    setIsLoading(false);
                }
            }
        } catch (e) {
            console.error(e);
            setError("Failed to start generation. Please try again.");
            setIsLoading(false);
        }
    }, [topic, gradeLevel, subject, uploadedFiles, numSlides, useWebSearch, bulletsPerSlide, additionalInstructions, user, navigate]);

    const handleRetry = async () => {
        if (!projectId || !user || isRetrying) return;

        try {
            setIsRetrying(true);
            setError(null);
            setIsLoading(true);
            setGenerationProgress(0);

            // 1. Get current project data to get parameters
            const projectRef = doc(db, 'users', user.uid, 'projects', projectId);
            const projectDoc = await getDoc(projectRef);

            if (!projectDoc.exists()) {
                setError("Project not found");
                setIsLoading(false);
                return;
            }

            const projectData = projectDoc.data() as ProjectData;

            // Validation: Ensure project is in failed state
            if (projectData.status !== 'failed') {
                setError("Project is not in a failed state");
                setIsLoading(false);
                return;
            }

            // 2. Reset status to generating
            await updateDoc(projectRef, {
                status: 'generating',
                generationProgress: 0,
                generationError: deleteField(),
                updatedAt: serverTimestamp()
            });

            // 3. Reconstruct source material from project files (filter empty content)
            const projectFiles = projectData.files || [];
            const sourceMaterial = projectFiles.length > 0
                ? projectFiles
                    .filter((f: ProjectFile) => f.extractedContent && f.extractedContent.trim().length > 0)
                    .map((f: ProjectFile) => `File: ${f.name}\n---\n${f.extractedContent}\n---`)
                    .join('\n\n')
                : "";

            const uploadedFileNames = projectFiles.map((f: ProjectFile) => f.name);

            // 4. Trigger generation
            await generateSlidesFromDocument(
                projectData.topic,
                projectData.gradeLevel,
                projectData.subject,
                sourceMaterial,
                numSlides,
                useWebSearch,
                bulletsPerSlide,
                projectData.additionalInstructions || "",
                projectId,
                uploadedFileNames
            ).catch(async (err) => {
                console.error("Retry generation call failed:", err);
                await updateDoc(projectRef, {
                    status: 'failed',
                    generationError: err.message || "Failed to start generation",
                    updatedAt: serverTimestamp()
                });
            });

        } catch (err: unknown) {
            console.error("Error retrying generation:", err);
            const message = err instanceof Error ? err.message : "Failed to retry generation";
            setError(message);
            setIsLoading(false);
        } finally {
            setIsRetrying(false);
        }
    };

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
                        projectId={currentProjectId}
                        onFilesSelected={handleFilesSelected}
                        uploadedFiles={uploadedFiles}
                        onRemoveFile={handleRemoveFile}
                        numSlides={numSlides}
                        setNumSlides={setNumSlides}
                        useWebSearch={useWebSearch}
                        setUseWebSearch={setUseWebSearch}
                        onSubmit={handleGenerateSlides}
                        isLoading={isLoading}
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
                        researchContent={researchContent}
                        projectTitle={projectTitle || topic}
                        projectTopic={projectTopic || topic}
                        projectGradeLevel={gradeLevel}
                        projectSubject={subject}
                        isLoading={isLoading}
                        error={error}
                        onUpdateSlide={handleUpdateSlide}
                        userId={user.uid}
                        projectId={currentProjectId}
                        generationProgress={generationProgress}
                        onRetry={handleRetry}
                    />
                </div>
            </main>
        </div>
    );
};
