import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface AuthProps {
    isModal?: boolean;
}

export function Auth({ isModal = false }: AuthProps) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    const handleGoogleLogin = async () => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Auth.tsx:13',message:'Button clicked - handleGoogleLogin entry',data:{isModal,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const clickTimestamp = Date.now();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Auth.tsx:16',message:'Before state updates',data:{clickTimestamp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setLoading(true);
        setMessage(null);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Auth.tsx:20',message:'After state updates, before provider creation',data:{timeSinceClick:Date.now()-clickTimestamp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        try {
            const provider = new GoogleAuthProvider();
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Auth.tsx:24',message:'Before signInWithPopup call',data:{timeSinceClick:Date.now()-clickTimestamp,isModal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            await signInWithPopup(auth, provider);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Auth.tsx:27',message:'signInWithPopup succeeded',data:{timeSinceClick:Date.now()-clickTimestamp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            // Successful sign-in is handled by onAuthStateChanged in App.tsx
        } catch (error: unknown) {
            // #region agent log
            const errorCode = (error as any)?.code;
            const errorMessage = error instanceof Error ? error.message : "Authentication failed";
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Auth.tsx:31',message:'signInWithPopup error caught',data:{errorCode,errorMessage,timeSinceClick:Date.now()-clickTimestamp,isModal,errorString:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            const message = error instanceof Error ? error.message : "Authentication failed";
            setMessage({ type: 'error', text: message });
            setLoading(false);
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
                    <div className={`p - 4 mb - 6 rounded ${message.type === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/50' : 'bg-green-500/20 text-green-200 border border-green-500/50'} `}>
                        {message.text}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 px-4 rounded flex items-center justify-center transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                >
                    {loading ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Connecting...
                        </span>
                    ) : (
                        <>
                            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Sign in with Google
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
