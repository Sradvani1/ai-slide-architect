import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full border-t border-subtle bg-surface mt-24">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="text-center">
                    <p className="text-sm text-secondary-text">
                        SlidesEdu - Built for educators, grades 6-12
                    </p>
                    <p className="text-xs text-secondary-text mt-2">
                        © {new Date().getFullYear()} SlidesEdu. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
};
