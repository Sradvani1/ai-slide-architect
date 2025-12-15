import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderProps {
    onSignIn: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSignIn }) => {
    return (
        <header className="w-full border-b border-subtle bg-surface sticky top-0 z-40 backdrop-blur-md bg-surface/80">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                <Link to="/" className="text-xl font-semibold text-primary-text hover:opacity-80 transition-opacity">
                    SlidesEdu
                </Link>
                <div className="flex items-center gap-6">
                    <Link to="/faq" className="text-sm font-medium text-secondary-text hover:text-primary transition-colors hidden sm:block">
                        FAQ
                    </Link>
                    <button
                        onClick={onSignIn}
                        className="btn-primary text-sm px-4 py-2"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        </header>
    );
};
