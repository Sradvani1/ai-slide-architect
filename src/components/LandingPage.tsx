import React, { useState } from 'react';
import { Hero } from './landing/Hero';
import { Features } from './landing/Features';
import { HowItWorks } from './landing/HowItWorks';
import { UseCases } from './landing/UseCases';
import { Footer } from './landing/Footer';
import { Auth } from './Auth';
import { Header } from './landing/Header';

export const LandingPage: React.FC = () => {
    const [showAuthModal, setShowAuthModal] = useState(false);

    const handleGetStarted = () => {
        setShowAuthModal(true);
    };

    const handleCloseModal = () => {
        setShowAuthModal(false);
    };

    return (
        <div className="min-h-screen bg-background">
            <Header onSignIn={handleGetStarted} />

            <main>
                <Hero onGetStarted={handleGetStarted} />
                <Features />
                <HowItWorks />
                <UseCases />
            </main>

            <Footer />

            {showAuthModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={handleCloseModal}
                >
                    <div
                        className="relative max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={handleCloseModal}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
                            aria-label="Close modal"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <Auth isModal={true} />
                    </div>
                </div>
            )}
        </div>
    );
};
