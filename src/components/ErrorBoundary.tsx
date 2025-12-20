import React, { Component, ErrorInfo, ReactNode } from 'react';
import { reportError } from '../utils/errorHandler';

interface ErrorFallbackProps {
    error: Error | null;
    resetErrorBoundary: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
    const [showDetails, setShowDetails] = React.useState(false);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden animate-fade-in">
                {/* Header Decor */}
                <div className="h-2 bg-gradient-to-r from-red-400 to-red-600"></div>

                <div className="p-8 sm:p-12">
                    {/* Icon and Title */}
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Something went wrong</h1>
                        <p className="text-slate-600 text-lg leading-relaxed max-w-md">
                            We've encountered an unexpected error. Don't worry, your progress is likely safe.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                        <button
                            onClick={resetErrorBoundary}
                            className="px-8 py-3.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all shadow-md shadow-primary/20 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="px-8 py-3.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-xl transition-all hover:bg-slate-50 flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                            Go to Dashboard
                        </button>
                    </div>

                    {/* Technical Details (Collapsible) */}
                    <div className="border-t border-slate-100 pt-6">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="text-slate-400 hover:text-slate-600 text-sm font-medium flex items-center mx-auto transition-colors"
                        >
                            {showDetails ? 'Hide' : 'Show'} technical details
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ml-1.5 transition-transform ${showDetails ? 'rotate-180' : ''}`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                        </button>

                        {showDetails && (
                            <div className="mt-4 p-4 bg-slate-900 rounded-lg overflow-auto max-h-48 animate-slide-down">
                                <code className="text-red-400 text-xs font-mono block mb-2">
                                    {error?.name}: {error?.message}
                                </code>
                                <pre className="text-slate-400 text-[10px] font-mono leading-relaxed">
                                    {error?.stack}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-slate-400 text-xs">Error ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                    <button
                        onClick={() => {
                            const text = `Error: ${error?.message}\nStack: ${error?.stack}`;
                            navigator.clipboard.writeText(text);
                            alert('Error details copied to clipboard');
                        }}
                        className="text-sm text-primary font-medium hover:underline"
                    >
                        Report Issue
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: React.ComponentType<ErrorFallbackProps>;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    resetKeys?: Array<unknown>;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}


export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Record the error info in state
        this.setState({ errorInfo });

        // Record the error in our utility
        reportError(error, {
            componentStack: errorInfo.componentStack || undefined,
            errorBoundary: 'MainErrorBoundary',
        });

        // Optional callback
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        // Reset the error state if resetKeys change
        if (this.state.hasError && this.props.resetKeys) {
            const keysChanged = this.props.resetKeys.some(
                (key, i) => key !== prevProps.resetKeys?.[i]
            );
            if (keysChanged) {
                this.resetErrorBoundary();
            }
        }
    }

    resetErrorBoundary = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            const FallbackComponent = this.props.fallback || ErrorFallback;
            return (
                <FallbackComponent
                    error={this.state.error}
                    resetErrorBoundary={this.resetErrorBoundary}
                />
            );
        }

        return this.props.children;
    }
}
