import React, { useState } from 'react';
import { Hero } from './landing/Hero';
import { Features } from './landing/Features';
import { FeaturedDecks } from './landing/FeaturedDecks';
import { HowRemixWorks } from './landing/HowRemixWorks';
import { UseCases } from './landing/UseCases';
import { Footer } from './landing/Footer';
import { Auth } from './Auth';
import { Modal } from './Modal';
import { Header } from './landing/Header';
import { usePageMeta } from '../hooks/usePageMeta';

export const LandingPage: React.FC = () => {
    const [showAuthModal, setShowAuthModal] = useState(false);

    usePageMeta({
        title: 'Free Slide Decks for Teachers | SlidesEdu',
        description: 'Create, share, and remix free classroom slide decks. Browse public presentations by grade and subject, or build your own in minutes.',
        canonical: 'https://www.slidesedu.org/',
    });

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
                <Hero onCreateOwn={handleGetStarted} />
                <FeaturedDecks onCreateDeck={handleGetStarted} />
                <HowRemixWorks />
                <Features />
                <UseCases />
            </main>

            <Footer />

            <Modal
                open={showAuthModal}
                onClose={handleCloseModal}
                closeButton={false}
                keepMounted={true}
                ariaLabelledby="auth-dialog-title"
                panelClassName="max-w-[500px] p-0"
            >
                <Auth isModal={true} onClose={handleCloseModal} />
            </Modal>
        </div>
    );
};
