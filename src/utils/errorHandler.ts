/**
 * Error Handler Utility
 *
 * Centralized infrastructure for logging and reporting errors.
 * Prepared for future Sentry integration.
 */

export interface ErrorContext {
    componentStack?: string;
    errorBoundary?: string;
    userAction?: string;
    timestamp: number;
    userAgent: string;
    url: string;
    breadcrumbs?: string[];
    [key: string]: any;
}

export interface ErrorReport {
    error: Error;
    context: ErrorContext;
    severity: 'error' | 'warning' | 'info';
    isReactError: boolean;
}

// Store basic breadcrumbs in memory for context
const breadcrumbs: string[] = [];
const MAX_BREADCRUMBS = 20;

/**
 * Capture a user action or system event to provide context for errors
 */
export const captureUserAction = (action: string) => {
    const timestamp = new Date().toLocaleTimeString();
    breadcrumbs.push(`[${timestamp}] ${action}`);
    if (breadcrumbs.length > MAX_BREADCRUMBS) {
        breadcrumbs.shift();
    }

    // In development, we can log these to console if needed
    if (import.meta.env.DEV) {
        // console.log(`[Action] ${action}`);
    }
};

import { isError } from './typeGuards';

/**
 * Report an error to the dashboard/console and future tracking services
 */
export const reportError = (
    error: unknown,
    context: Partial<ErrorContext> = {},
    severity: 'error' | 'warning' | 'info' = 'error'
) => {
    const actualError = isError(error) ? error : new Error(String(error));

    const errorReport: ErrorReport = {
        error: actualError,
        severity,
        isReactError: !!context.componentStack,
        context: {
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            breadcrumbs: [...breadcrumbs],
            ...context,
        },
    };

    // 1. Log to console
    if (import.meta.env.DEV) {
        const color = severity === 'error' ? 'color: #ef4444' : 'color: #f59e0b';
        console.groupCollapsed(`%c[Error Report] ${actualError.message}`, color);
        console.error('Error Object:', actualError);
        console.log('Context:', errorReport.context);
        if (context.componentStack) {
            console.log('Component Stack:', context.componentStack);
        }
        console.groupEnd();
    } else {
        // Production logging
        console.error(`[${severity.toUpperCase()}] ${actualError.message}`, actualError.stack);
    }

    // 2. TODO: Integrate with Sentry or other error tracking service
    // if (window.Sentry) {
    //   window.Sentry.captureException(actualError, {
    //     extra: errorReport.context,
    //     level: severity,
    //   });
    // }

    return errorReport;
};

/**
 * Initialize error tracking (e.g., Sentry)
 */
export const initializeErrorTracking = () => {
    // Add initialization logic here when adding Sentry
    console.log('[System] Error tracking initialized');
};
