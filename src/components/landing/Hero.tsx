import React from 'react';

interface HeroProps {
    onGetStarted: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onGetStarted }) => {
    return (
        <section className="w-full max-w-6xl mx-auto px-4 pt-20 pb-12 md:pt-32 md:pb-16 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-primary-text mb-6 leading-tight tracking-tight">
                Create Classroom Slides in Seconds
            </h1>
            <p className="text-lg md:text-xl text-secondary-text max-w-2xl mx-auto mb-10 leading-relaxed">
                Turn any topic or document into a slide presentation with grounded research, notes and images.
            </p>
            <button
                onClick={onGetStarted}
                className="btn-primary text-lg px-8 py-4 inline-flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
            >
                Start Creating
            </button>
        </section>
    );
};
