import React from 'react';

export const HowRemixWorks: React.FC = () => {
    const steps = [
        {
            number: '1',
            title: 'View',
            description: 'Browse public decks on Explore or open a shared link.',
        },
        {
            number: '2',
            title: 'Sign in',
            description: 'Create a free account to save your copy.',
        },
        {
            number: '3',
            title: 'Copy',
            description: 'Remix adds the deck to your dashboard.',
        },
        {
            number: '4',
            title: 'Edit',
            description: 'Customize slides, notes, and images.',
        },
        {
            number: '5',
            title: 'Export',
            description: 'Download PowerPoint or speaker notes.',
        },
    ];

    return (
        <section className="w-full max-w-6xl mx-auto px-4 py-10 md:py-16 bg-neutral-bg/30">
            <h2 className="text-2xl md:text-3xl font-bold text-primary-text text-center mb-16">
                How remixing works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-6">
                {steps.map((step) => (
                    <div key={step.number} className="text-center">
                        <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-semibold mx-auto mb-4">
                            {step.number}
                        </div>
                        <h3 className="text-lg font-semibold text-primary-text mb-2">
                            {step.title}
                        </h3>
                        <p className="text-sm text-secondary-text leading-relaxed">
                            {step.description}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
};
