import React, { useState } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { Auth } from '../Auth';

interface FAQItemProps {
    question: string;
    answer: React.ReactNode;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="glass-card mb-4 overflow-hidden border border-subtle">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
            >
                <h3 className="text-lg font-semibold text-primary-text pr-8">{question}</h3>
                <span className={`transform transition-transform duration-300 text-primary ${isOpen ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </button>
            <div
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    } overflow-hidden`}
            >
                <div className="px-6 pb-6 text-secondary-text leading-relaxed">
                    {answer}
                </div>
            </div>
        </div>
    );
};

export const FAQ: React.FC = () => {
    const [showAuthModal, setShowAuthModal] = useState(false);

    const handleSignIn = () => {
        setShowAuthModal(true);
    };

    const categories = [
        {
            title: "General",
            items: [
                {
                    question: "What is SlidesEdu?",
                    answer: "SlidesEdu is an AI-powered slide builder designed specifically for students and teachers. It helps you research topics, organize your thoughts, and create professional-looking presentations in seconds, so you can focus on mastering your content and delivery."
                },
                {
                    question: "Is it free to use?",
                    answer: "Yes! SlidesEdu is completely free and tailored for the educational environment."
                },
                {
                    question: "Do I need an account?",
                    answer: "Yes, you'll need to sign in with Google to save your projects and access them later. This ensures your work is always backed up and secure."
                }
            ]
        },
        {
            title: "Features & Workflow",
            items: [
                {
                    question: "Can I export to Google Slides?",
                    answer: "Absolutely. You can export your presentation as a PowerPoint file (.pptx), which can then be easily uploaded and opened in Google Slides, Microsoft PowerPoint, or Keynote."
                },
                {
                    question: "Does it generate speaker notes?",
                    answer: "Yes, SlidesEdu acts as a presentation coach by generating conversational speaker notes for every slide. These notes help you present confidently and explain the concepts in your own words."
                },
                {
                    question: "Where do the images come from?",
                    answer: "Our AI generates unique, copyright-free images based specifically on the content of your slides. These are tailored to be age-appropriate and visually clear for the classroom."
                }
            ]
        },
        {
            title: "Research & Organization",
            items: [
                {
                    question: "How does the research tool work?",
                    answer: "SlidesEdu uses Google Search to find reliable, age-appropriate information to build a solid factual foundation for your presentation. You can also upload your own documents (PDFs, Word files) to use as the source material."
                },
                {
                    question: "Does it cite sources?",
                    answer: "Yes! Academic integrity is key. Every presentation includes a 'Sources' section in the speaker notes, listing the websites or documents used. This allows you to verify facts and dig deeper into the subject."
                },
                {
                    question: "Why use this instead of starting from scratch?",
                    answer: "Think of SlidesEdu as your research assistant and structure builder. It handles the formatting, layout, and initial organization, giving you a high-quality starting point. This allows you to spend your time critical thinking, refining the narrative, and practicing your speech—the skills that matter most."
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-background font-sans text-primary-text">
            <Header onSignIn={handleSignIn} />

            <main className="max-w-4xl mx-auto px-4 py-16">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-primary-text">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-xl text-secondary-text max-w-2xl mx-auto">
                        Everything you need to know about using SlidesEdu for your classroom projects.
                    </p>
                </div>

                <div className="space-y-12">
                    {categories.map((category, idx) => (
                        <section key={idx}>
                            <h2 className="text-2xl font-semibold mb-6 flex items-center text-primary-text">
                                {category.title}
                                <div className="h-px bg-subtle flex-1 ml-6"></div>
                            </h2>
                            <div className="space-y-4">
                                {category.items.map((item, i) => (
                                    <FAQItem key={i} question={item.question} answer={item.answer} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="mt-20 text-center p-12 glass-panel">
                    <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
                    <p className="text-secondary-text mb-8">
                        We're here to help you build better presentations.
                    </p>
                    <button onClick={handleSignIn} className="btn-primary text-lg px-8 py-3">
                        Start Building Now
                    </button>
                </div>
            </main>

            <Footer />

            {/* Auth Modal Reuse */}
            {showAuthModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                    onClick={() => setShowAuthModal(false)}
                >
                    <div
                        className="relative max-w-[500px] w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Auth isModal={true} onClose={() => setShowAuthModal(false)} />
                    </div>
                </div>
            )}
        </div>
    );
};
