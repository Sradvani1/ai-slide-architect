import React from 'react';

export const UseCases: React.FC = () => {
    const useCases = [
        {
            title: 'For Teachers',
            description: 'Create lesson decks, review materials, and visual aids for any subject—Science, History, English, Math, and more.',
            examples: [
                'Lesson plan presentations',
                'Review session slides',
                'Visual learning aids',
                'Curriculum-aligned content',
            ],
        },
        {
            title: 'For Students',
            description: 'Transform research into professional presentations for class projects, book reports, and science fairs.',
            examples: [
                'Class project presentations',
                'Book report slides',
                'Science fair displays',
                'Research summaries',
            ],
        },
    ];

    return (
        <section className="w-full max-w-6xl mx-auto px-4 py-10 md:py-16">
            <h2 className="text-2xl md:text-3xl font-bold text-primary-text text-center mb-16">
                Built for Education
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {useCases.map((useCase, index) => (
                    <div
                        key={index}
                        className="bg-surface border border-subtle rounded-lg p-6 shadow-card"
                    >
                        <h3 className="text-xl font-semibold text-primary-text mb-3">
                            {useCase.title}
                        </h3>
                        <p className="text-sm text-secondary-text mb-4 leading-relaxed">
                            {useCase.description}
                        </p>
                        <ul className="space-y-2">
                            {useCase.examples.map((example, idx) => (
                                <li key={idx} className="flex items-start text-sm text-secondary-text">
                                    <svg className="w-5 h-5 text-primary mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {example}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
};
