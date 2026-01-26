import React from 'react';

export const Features: React.FC = () => {
    const features = [
        {
            title: 'Curriculum-Aligned Content',
            description: 'Generate slides tailored to specific grade levels and subjects—from 1st grade math to 12th grade literature.',
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            title: 'Teacher Tools',
            description: 'Automatic speaker notes, image search, customizable content, and web-grounded research for accuracy.',
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
        },
        {
            title: 'Student-Friendly',
            description: 'Turn research papers and notes into polished presentations. Export to PowerPoint instantly.',
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
            ),
        },
    ];

    return (
        <section className="w-full max-w-6xl mx-auto px-4 py-10 md:py-16">
            <h2 className="text-2xl md:text-3xl font-bold text-primary-text text-center mb-12">
                Key Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                    <div
                        key={index}
                        className="bg-surface border border-subtle rounded-lg p-6 shadow-card hover:shadow-card-hover hover:-translate-y-[2px] transition-all duration-300"
                    >
                        <div className="mb-4">{feature.icon}</div>
                        <h3 className="text-lg font-semibold text-primary-text mb-2">
                            {feature.title}
                        </h3>
                        <p className="text-sm text-secondary-text leading-relaxed">
                            {feature.description}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
};
