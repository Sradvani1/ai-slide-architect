import React from 'react';
import { Link } from 'react-router-dom';

interface HeroProps {
    onCreateOwn: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onCreateOwn }) => {
    return (
        <section className="w-full max-w-6xl mx-auto px-4 pt-20 pb-12 md:pt-32 md:pb-16 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-primary-text mb-6 leading-tight tracking-tight">
                Free slide decks for teachers — create, share, remix
            </h1>
            <p className="text-lg md:text-xl text-secondary-text max-w-2xl mx-auto mb-10 leading-relaxed">
                Browse classroom-ready presentations or build your own with AI-assisted research and speaker notes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                    to="/explore"
                    className="btn-primary text-lg px-8 py-4 inline-flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 min-h-[44px]"
                >
                    Explore public decks
                </Link>
                <button
                    onClick={onCreateOwn}
                    className="text-primary border border-primary/30 rounded-lg hover:bg-primary/5 px-6 py-2.5 text-sm font-semibold min-h-[44px] transition-colors"
                >
                    Create your own
                </button>
            </div>
        </section>
    );
};
