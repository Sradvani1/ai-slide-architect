import React, { useEffect, useRef, useState } from 'react';
import { auth } from '../firebaseConfig';
import { GoogleAuthProvider, signInWithCredential, sendSignInLinkToEmail } from 'firebase/auth';

declare global {
    interface Window {
        google?: {
            accounts?: {
                id?: {
                    initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
                    renderButton: (parent: HTMLElement, options?: Record<string, unknown>) => void;
                };
            };
        };
    }
}

interface AuthProps {
    isModal?: boolean;
    onClose?: () => void;
    continueUrl?: string;
}

export function Auth({ isModal = false, onClose, continueUrl }: AuthProps) {
    const [isEmailSending, setIsEmailSending] = useState(false);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const googleButtonRef = useRef<HTMLDivElement | null>(null);
    const googleButtonWrapperRef = useRef<HTMLDivElement | null>(null);

    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    const EMAIL_LINK_CONTINUE_URL = continueUrl || 'https://www.slidesedu.org';
    const EMAIL_STORAGE_KEY = 'emailForSignIn';

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) {
            setMessage({ type: 'error', text: 'Missing Google client ID configuration.' });
            return;
        }

        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 20;
        const intervalId = window.setInterval(() => {
            if (cancelled) return;
            attempts += 1;

            const google = window.google;
            if (!google?.accounts?.id || !googleButtonRef.current) {
                if (attempts >= maxAttempts) {
                    window.clearInterval(intervalId);
                    setMessage({ type: 'error', text: 'Google sign-in failed to initialize.' });
                }
                return;
            }

            window.clearInterval(intervalId);
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response: { credential?: string }) => {
                    try {
                        setMessage(null);
                        if (!response.credential) {
                            throw new Error('No credential received from Google.');
                        }
                        const credential = GoogleAuthProvider.credential(response.credential);
                        await signInWithCredential(auth, credential);
                    } catch (error: unknown) {
                        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
                        setMessage({ type: 'error', text: errorMessage });
                    }
                }
            });

            googleButtonRef.current.innerHTML = '';
            const targetWidth = Math.min(
                320,
                googleButtonWrapperRef.current?.clientWidth || 320
            );

            google.accounts.id.renderButton(googleButtonRef.current, {
                theme: 'outline',
                size: 'large',
                width: targetWidth,
                shape: 'pill',
                text: 'signin_with'
            });
            setIsGoogleReady(true);
        }, 250);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [GOOGLE_CLIENT_ID]);

    const handleEmailLink = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email) {
            setMessage({ type: 'error', text: 'Please enter a valid email address.' });
            return;
        }

        setIsEmailSending(true);
        setMessage(null);

        try {
            await sendSignInLinkToEmail(auth, email, {
                url: EMAIL_LINK_CONTINUE_URL,
                handleCodeInApp: true
            });
            window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
            setMessage({ type: 'success', text: 'Check your email for a sign-in link.' });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send sign-in link.';
            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setIsEmailSending(false);
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center ${isModal ? 'p-0' : 'min-h-screen bg-[#1F2121]'} text-[#F5F5F5] p-4`}>
            <div className="relative w-full max-w-[500px] bg-[#262828] p-5 sm:p-6 rounded-[12px] shadow-lg border border-white/10">
                {isModal && onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 rounded-full p-3 text-[#A7A9A9] hover:text-[#F5F5F5] hover:bg-white/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32B8C6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#262828]"
                        aria-label="Close modal"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                <h1
                    id={isModal ? 'auth-dialog-title' : undefined}
                    className="text-2xl sm:text-3xl font-semibold text-center mb-4 sm:mb-6 text-[#32B8C6]"
                >
                    Welcome Back
                </h1>
                <p className="text-[#A7A9A9] text-center mb-6 sm:mb-8">
                    Sign in to start creating slides
                </p>

                {message && (
                    <div
                        className={`p-4 mb-6 rounded border ${message.type === 'error'
                            ? 'bg-[#3A1D1D] text-[#FF5453] border-[#FF5453]'
                            : 'bg-[#14322A] text-[#22C55E] border-[#22C55E]'}`}
                        aria-live="polite"
                    >
                        {message.text}
                    </div>
                )}

                <div className="flex flex-col gap-3 sm:gap-4">
                    <div
                        ref={googleButtonWrapperRef}
                        className="relative w-full max-w-[320px] mx-auto h-[44px]"
                    >
                        <div
                            aria-hidden="true"
                            className={`absolute inset-0 rounded-full border border-[#3A3C3C] bg-[#262828] transition-opacity ${isGoogleReady ? 'opacity-0' : 'opacity-100 animate-pulse'}`}
                        />
                        <div
                            ref={googleButtonRef}
                            className={`absolute inset-0 w-full transition-opacity ${isGoogleReady ? 'opacity-100' : 'opacity-0'}`}
                        />
                    </div>

                    <div className="flex items-center gap-3 text-[#A7A9A9] text-sm">
                        <div className="h-px flex-1 bg-[#3A3C3C]" />
                        <span>or</span>
                        <div className="h-px flex-1 bg-[#3A3C3C]" />
                    </div>

                    <form onSubmit={handleEmailLink} className="flex flex-col gap-3">
                        <label htmlFor="auth-email" className="text-xs font-semibold text-[#A7A9A9]">
                            Email address
                        </label>
                        <input
                            id="auth-email"
                            name="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="name@example.com…"
                            autoComplete="email"
                            spellCheck={false}
                            className="w-full rounded border border-[#3A3C3C] bg-[#262828] px-3 py-2 text-[#F5F5F5] placeholder:text-[#A7A9A9] focus:border-[#32B8C6] focus:outline-none focus:ring-2 focus:ring-[#32B8C6]/30"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full bg-[#32B8C6] hover:bg-[#2CA3B0] text-[#1F2121] font-semibold py-2 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32B8C6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#262828] disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isEmailSending}
                        >
                            {isEmailSending ? 'Sending link…' : 'Continue with Email'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
