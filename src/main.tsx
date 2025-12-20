import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { reportError, initializeErrorTracking } from './utils/errorHandler';

// Initialize error tracking
initializeErrorTracking();

// Global Error Handlers
window.onerror = (message, source, lineno, colno, error) => {
  reportError(error || new Error(String(message)), {
    userAction: 'Global JavaScript Error',
    source,
    lineno,
    colno,
  });
  // Allow default handling in development
  return import.meta.env.PROD;
};

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  reportError(event.reason, {
    userAction: 'Unhandled Promise Rejection',
  });
  // Prevent console noise in production
  if (import.meta.env.PROD) {
    event.preventDefault();
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
