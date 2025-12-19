import React from 'react';

export const HowItWorks: React.FC = () => {
    const steps = [
        {
            number: '1',
            title: 'Input',
            description: 'Upload lesson materials or describe your topic and grade level.',
        },
        {
            number: '2',
            title: 'Customize',
            description: 'Adjust grade level, subject, creativity, and slide count.',
        },
        {
            number: '3',
            title: 'Download',
            description: 'Get your finished deck with speaker notes in seconds.',
        },
    ];

    return (
        <section className="w-full max-w-6xl mx-auto px-4 py-10 md:py-16 bg-neutral-bg/30">
            <h2 className="text-2xl md:text-3xl font-bold text-primary-text text-center mb-16">
                How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {steps.map((step, index) => (
                    <div key={index} className="text-center">
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
