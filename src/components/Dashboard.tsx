import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getUserProjects, ProjectData, deleteProject } from '../services/projectService';
import { PptxIcon } from './icons';

interface DashboardProps {
    user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            const data = await getUserProjects(user.uid);
            setProjects(data);
            setIsLoading(false);
        };
        fetchProjects();
    }, [user.uid]);

    const handleSignOut = async () => {
        await signOut(auth);
    };

    const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation(); // Prevent card click
        if (window.confirm("Are you sure you want to delete this project?")) {
            await deleteProject(user.uid, projectId);
            setProjects(prev => prev.filter(p => p.id !== projectId));
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        // Handle Firestore Timestamp or Date object
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(date);
    };

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden">
            {/* Background - Clean Light Mode is handled by body bg-slate-50 in index.css */}

            {/* Navbar - Minimalist Light */}
            <header className="relative z-10 w-full px-6 py-4 flex justify-between items-center bg-transparent border-b border-[rgba(0,0,0,0.06)]">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center opacity-90 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                        </svg>
                    </div>
                    <span className="font-semibold text-[22px] tracking-tight text-primary-text">SlidesEdu</span>
                </div>

                <div className="flex items-center">
                    <div
                        onClick={handleSignOut}
                        className="group flex items-center space-x-2 cursor-pointer px-[8px] py-[6px] rounded-[20px] bg-[#F5F5F5] border border-[#D1D5D8] transition-all hover:bg-white hover:border-primary hover:shadow-[0_1px_3px_rgba(33,128,234,0.1)]"
                        title="Click to Sign Out"
                    >
                        <div className="w-[30px] h-[30px] rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shadow-sm">
                            {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                        </div>
                        <span className="text-sm font-medium text-secondary-text group-hover:text-primary-text transition-colors">
                            {user.displayName || user.email?.split('@')[0]}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[#627C81] group-hover:text-error transition-colors ml-1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="relative z-10 flex-1 container mx-auto p-8 max-w-7xl animate-fade-in">

                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-primary-text tracking-tight mb-1">Welcome back, {user.displayName ? user.displayName.split(' ')[0] : 'User'}</h1>
                        <p className="text-[15px] text-[#627C81] font-medium">Your projects</p>
                    </div>
                    <button
                        onClick={() => navigate('/new')}
                        className="btn-primary flex items-center space-x-2 px-5 py-2.5 shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/20 transition-all text-sm font-semibold"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span>New Project</span>
                    </button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="h-48 rounded-xl bg-neutral-bg animate-pulse"></div>
                        ))}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                            <PptxIcon className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-primary-text mb-2">No projects yet</h3>
                        <p className="text-secondary-text mb-6">Start your first AI-powered presentation today.</p>
                        <button
                            onClick={() => navigate('/new')}
                            className="text-primary hover:text-primary/80 font-semibold flex items-center"
                        >
                            Create Project &rarr;
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Create New Card (Inline Option) */}
                        <div
                            onClick={() => navigate('/new')}
                            className="group cursor-pointer rounded-xl border-2 border-dashed border-slate-300 hover:border-primary/50 bg-background hover:bg-surface transition-all flex flex-col items-center justify-center p-6 min-h-[140px]"
                        >
                            <div className="w-10 h-10 rounded-full bg-neutral-bg group-hover:bg-primary group-hover:text-white text-slate-400 flex items-center justify-center mb-3 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            </div>
                            <span className="font-semibold text-secondary-text group-hover:text-primary transition-colors text-sm">New Project</span>
                        </div>

                        {projects.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => navigate(`/project/${project.id}`)}
                                className="group/card rounded-xl pt-5 pb-4 px-6 cursor-pointer border border-[rgba(0,0,0,0.06)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] bg-surface hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-150 ease-out relative flex flex-col min-h-[140px]"
                            >
                                {/* Delete Action (Top Right) */}
                                <button
                                    onClick={(e) => handleDeleteProject(e, project.id!)}
                                    className="opacity-0 group-hover/card:opacity-100 text-secondary-text hover:text-error p-3 rounded-md hover:bg-red-50 transition-all absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                    title="Delete Project"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                    </svg>
                                </button>

                                {/* Row 1: Title (Primary Focus) */}
                                <h3 className="font-semibold text-[20px] text-primary-text leading-tight line-clamp-2 pr-6 mb-3 group-hover/card:text-primary transition-colors">
                                    {project.title || "Untitled Project"}
                                </h3>

                                {/* Row 2: Badge Row (Categorical Metadata) */}
                                <div className="flex items-center gap-2 mb-4">
                                    {project.subject && (
                                        <span className="bg-[#E8F4F8] text-[#2180EA] px-2 py-1 rounded-[12px] text-[11px] uppercase tracking-[0.5px] font-bold">
                                            {project.subject}
                                        </span>
                                    )}
                                    <span className="bg-[#F5F5F5] text-[#627C81] px-2 py-1 rounded-[12px] text-[11px] uppercase tracking-[0.5px] font-bold">
                                        {project.gradeLevel || 'N/A'}
                                    </span>
                                </div>

                                {/* Row 3: Metadata Row (Temporal/Quantitative) */}
                                <div className="mt-auto flex items-center text-[13px] text-[#627C81]">
                                    <span className="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 mr-1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                        </svg>
                                        {project.slides?.length || 0}
                                    </span>
                                    <span className="mx-2">•</span>
                                    <span>{formatDate(project.updatedAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};
