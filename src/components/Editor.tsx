import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from 'firebase/auth';
import { InputForm } from './InputForm';
import { SlideDeck } from './SlideDeck';
import { generateSlidesFromDocument } from '../services/geminiService';
import { createProject, updateProject, getProject } from '../services/projectService';
import type { Slide } from '../types';

interface EditorProps {
    user: User;
}

export const Editor: React.FC<EditorProps> = ({ user }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    const [topic, setTopic] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [subject, setSubject] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string; size: number }[]>([]);
    const [numSlides, setNumSlides] = useState<number>(5);
    const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
    const [creativityLevel, setCreativityLevel] = useState<number>(0.7);
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
                const project = await getProject(user.uid, projectId);
                if (project) {
                    setTopic(project.title);
                    setGradeLevel(project.gradeLevel);
                    setSubject(project.subject);
                    setSlides(project.slides);
                    setCurrentProjectId(project.id!);
                } else {
                    setError("Project not found.");
                }
                setIsLoading(false);
            } else {
                // Reset for new project
                setTopic('');
                setGradeLevel('');
                setSubject('');
                setSlides(null);
                setCurrentProjectId(null);
                setUploadedFiles([]);
            }
        };

        loadProject();
    }, [projectId, user.uid]);

    const handleFilesSelected = (files: { name: string; content: string; size: number }[]) => {
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
            const sourceMaterial = uploadedFiles.map(f => `File: ${f.name}\n---\n${f.content}\n---`).join('\n\n');
            const generatedSlides = await generateSlidesFromDocument(topic, gradeLevel, subject, sourceMaterial, numSlides, useWebSearch, creativityLevel);
            setSlides(generatedSlides);

            if (user) {
                const newProjectId = await createProject(user.uid, {
                    title: topic, // Use topic as initial title
                    topic,
                    gradeLevel,
                    subject,
                    slides: generatedSlides
                });
                setCurrentProjectId(newProjectId);
                // Ideally, update URL to include new ID without reload, but for now we stay on "new" or replace history
                // Doing a replace state might be better to avoid back button issues, 
                // but let's just update the internal state for now.
                // navigate(`/project/${newProjectId}`, { replace: true }); 
            }
        } catch (e) {
            console.error(e);
            setError("Failed to generate slides. Please check your input and try again.");
        } finally {
            setIsLoading(false);
        }
    }, [topic, gradeLevel, subject, uploadedFiles, numSlides, useWebSearch, creativityLevel, user, navigate]);

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
