import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full border-t border-subtle bg-surface mt-24">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-center md:text-left">
                        <p className="text-sm text-secondary-text font-medium">
                            SlidesEdu - Built for educators, grades 6-12
                        </p>
                        <p className="text-xs text-secondary-text mt-1">
                            © {new Date().getFullYear()} SlidesEdu. All rights reserved.
                        </p>
                    </div>
                    <div className="flex gap-6">
                        <Link to="/faq" className="text-sm text-secondary-text hover:text-primary transition-colors">
                            FAQ
                        </Link>
                        <Link to="/" className="text-sm text-secondary-text hover:text-primary transition-colors">
                            Home
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};
