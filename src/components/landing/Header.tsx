import React from 'react';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';

interface HeaderProps {
    onSignIn: () => void;
    user?: User | null;
    title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onSignIn, user, title }) => {
    return (
        <header className="w-full border-b border-subtle bg-surface sticky top-0 z-40 backdrop-blur-md bg-surface/80">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/" className="text-xl font-semibold text-primary-text hover:opacity-80 transition-opacity">
                        SlidesEdu
                    </Link>
                    {title && (
                        <span className="text-sm font-medium text-secondary-text hidden sm:block">
                            {title}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-6">
                    <Link to="/faq" className="text-sm font-medium text-secondary-text hover:text-primary transition-colors hidden sm:block">
                        FAQ
                    </Link>
                    {user ? (
                        <Link
                            to="/"
                            className="btn-primary text-sm px-4 py-2"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <button
                            onClick={onSignIn}
                            className="btn-primary text-sm px-4 py-2"
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};
