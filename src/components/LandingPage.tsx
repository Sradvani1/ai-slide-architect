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
                        className="relative max-w-[500px] w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Auth isModal={true} onClose={handleCloseModal} />
                    </div>
                </div>
            )}
        </div>
    );
};
