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
}

export function Auth({ isModal = false }: AuthProps) {
    const [isEmailSending, setIsEmailSending] = useState(false);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const googleButtonRef = useRef<HTMLDivElement | null>(null);

    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    const EMAIL_LINK_CONTINUE_URL = 'https://www.slidesedu.org';
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
            google.accounts.id.renderButton(googleButtonRef.current, {
                theme: 'outline',
                size: 'large',
                shape: 'pill',
                text: 'signin_with'
            });
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
        <div className={`flex flex-col items-center justify-center ${isModal ? 'p-0' : 'min-h-screen bg-slate-900'} text-slate-200 p-4`}>
            <div className="w-full max-w-md bg-slate-800 p-8 rounded-lg shadow-lg border border-slate-700">
                <h1 className="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
                    Welcome Back
                </h1>
                <p className="text-slate-400 text-center mb-8">
                    Sign in to start creating slides
                </p>

                {message && (
                    <div className={`p-4 mb-6 rounded ${message.type === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/50' : 'bg-green-500/20 text-green-200 border border-green-500/50'}`}>
                        {message.text}
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    <div ref={googleButtonRef} className="w-full" />

                    <div className="flex items-center gap-3 text-slate-500 text-sm">
                        <div className="h-px flex-1 bg-slate-700" />
                        <span>or</span>
                        <div className="h-px flex-1 bg-slate-700" />
                    </div>

                    <form onSubmit={handleEmailLink} className="flex flex-col gap-3">
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="Email address"
                            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isEmailSending}
                        >
                            {isEmailSending ? 'Sending link...' : 'Continue with Email'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
