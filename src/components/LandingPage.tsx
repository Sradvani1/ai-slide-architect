import React, { useState } from 'react';
import { Hero } from './landing/Hero';
import { Features } from './landing/Features';
import { HowItWorks } from './landing/HowItWorks';
import { UseCases } from './landing/UseCases';
import { Footer } from './landing/Footer';
import { Auth } from './Auth';
import { Modal } from './Modal';
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

            <main id="main-content">
                <Hero onGetStarted={handleGetStarted} />
                <Features />
                <HowItWorks />
                <UseCases />
            </main>

            <Footer />

            <Modal
                open={showAuthModal}
                onClose={handleCloseModal}
                closeButton={false}
                ariaLabelledby="auth-dialog-title"
                panelClassName="max-w-[500px] p-0"
            >
                <Auth isModal={true} onClose={handleCloseModal} />
            </Modal>
        </div>
    );
};
