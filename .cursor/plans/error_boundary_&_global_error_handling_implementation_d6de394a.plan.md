---
name: Error Boundary & Global Error Handling Implementation
overview: Implement React Error Boundaries and global error handlers to prevent white screens, improve error visibility, and prepare for error tracking integration. This will catch React component errors, JavaScript runtime errors, and unhandled promise rejections, providing user-friendly fallback UIs and structured error reporting.
todos:
  - id: create-error-handler
    content: Create src/utils/errorHandler.ts with error reporting functions, context tracking, and placeholder for Sentry integration
    status: pending
  - id: create-error-boundary
    content: Create src/components/ErrorBoundary.tsx with class component, error boundary lifecycle methods, and ErrorFallback UI component
    status: pending
  - id: add-global-handlers
    content: Add window.onerror and window.onunhandledrejection handlers to src/main.tsx, integrated with errorHandler
    status: pending
  - id: integrate-app
    content: Wrap Router/Routes in ErrorBoundary in src/App.tsx with appropriate resetKeys
    status: pending
  - id: test-implementation
    content: Test error boundary with intentional errors, async errors, recovery, and verify error reporting
    status: pending
---

# Error Boundary & Global Error Handling Implementation Plan

## Analysis & Purpose

### Current State

- **No Error Boundaries**: React component errors cause white screens and crash the entire app
- **No Global Error Handling**: JavaScript errors and unhandled promise rejections are only logged to console
- **Scattered Error Handling**: Individual components handle errors locally with `console.error` and try-catch blocks
- **No Error Tracking**: Errors are not captured for monitoring/debugging
- **Poor User Experience**: Users see blank screens or cryptic console errors instead of helpful messages

### Goals

1. **Prevent White Screens**: Catch React component errors and display user-friendly fallback UI
2. **Global Error Capture**: Catch all JavaScript errors and promise rejections at the application level
3. **Error Visibility**: Provide clear error messages and recovery options to users
4. **Error Reporting**: Structure error data for future integration with monitoring services (Sentry, etc.)
5. **Error Context**: Capture component stack, user actions, and error boundary location for debugging
6. **Graceful Degradation**: Allow users to retry operations or navigate away from error states

### Impact

- **User Experience**: Users see helpful error messages instead of blank screens
- **Developer Experience**: Better error visibility and debugging information
- **Production Reliability**: Errors are captured and can be monitored/alerted
- **Maintainability**: Centralized error handling reduces code duplication

## Architecture Overview

```javascript
┌─────────────────────────────────────────────────────────┐
│                    Global Error Handlers                │
│  (window.onerror, window.onunhandledrejection)         │
│  └─> errorHandler.ts (log & report)                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    App.tsx                              │
│  └─> <ErrorBoundary>                                   │
│      └─> <Router>                                       │
│          └─> <Routes>                                    │
│              ├─> <Dashboard />                          │
│              ├─> <Editor />                             │
│              └─> <LandingPage />                        │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              ErrorBoundary Component                    │
│  - Catches React component errors                      │
│  - Displays ErrorFallback UI                           │
│  - Reports to errorHandler.ts                          │
│  - Provides retry/reset functionality                  │
└─────────────────────────────────────────────────────────┘
```



## Implementation Details

### 1. Error Handler Utility (`src/utils/errorHandler.ts`)

**Purpose**: Centralized error logging and reporting infrastructure**Key Features**:

- Capture error metadata (message, stack, component info, user context)
- Log errors to console (development) and prepare for external service (production)
- Support for future Sentry integration
- Error context tracking (user actions, component hierarchy)

**Structure**:

```typescript
interface ErrorContext {
  componentStack?: string;
  errorBoundary?: string;
  userAction?: string;
  timestamp: number;
  userAgent: string;
  url: string;
}

interface ErrorReport {
  error: Error;
  context: ErrorContext;
  severity: 'error' | 'warning';
  isReactError: boolean;
}

// Functions:
- reportError(error, context, severity)
- captureUserAction(action)
- initializeErrorTracking() // For future Sentry setup
```



### 2. Error Boundary Component (`src/components/ErrorBoundary.tsx`)

**Purpose**: Catch React component tree errors and display fallback UI**Key Features**:

- Class component (required for Error Boundaries)
- `getDerivedStateFromError` to update state on error
- `componentDidCatch` to log error details
- Error recovery via reset function
- User-friendly error UI with retry/report options
- Support for fallback UI customization via props

**Props**:

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>; // Reset boundary when keys change
}
```

**State**:

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}
```



### 3. Error Fallback Component (`src/components/ErrorBoundary.tsx`)

**Purpose**: User-friendly error display UI**Features**:

- Clear error message (user-friendly, not technical)
- Error details (collapsible for debugging)
- Action buttons:
- "Try Again" (reset error boundary)
- "Report Issue" (copy error details / future: send to support)
- "Go Home" (navigate to dashboard)
- Matches app design system (Tailwind classes)
- Accessible (ARIA labels, keyboard navigation)

### 4. Global Error Handlers (`src/main.tsx`)

**Purpose**: Catch non-React errors (JavaScript runtime errors, promise rejections)**Implementation**:

- `window.onerror`: Catch synchronous JavaScript errors
- `window.onunhandledrejection`: Catch unhandled promise rejections
- Both handlers call `errorHandler.reportError()`
- Prevent default browser error dialogs in production

### 5. App Integration (`src/App.tsx`)

**Changes**:

- Wrap `<Router>` and `<Routes>` in `<ErrorBoundary>`
- Provide error boundary reset keys (e.g., user ID) to reset on auth changes
- Optional: Nested error boundaries for specific routes/components

## File Structure

```javascript
src/
├── components/
│   └── ErrorBoundary.tsx          # Error Boundary + Error Fallback UI
├── utils/
│   └── errorHandler.ts              # Global error handling utilities
├── App.tsx                          # Wrap routes in ErrorBoundary
└── main.tsx                         # Add global error handlers
```



## Implementation Steps

### Step 1: Create Error Handler Utility

- Create `src/utils/errorHandler.ts`
- Implement error context tracking
- Implement error reporting functions
- Add placeholder for future Sentry integration
- Export error reporting interface

### Step 2: Create Error Boundary Component

- Create `src/components/ErrorBoundary.tsx`
- Implement class component with error boundary lifecycle methods
- Create ErrorFallback functional component
- Add error recovery/reset functionality
- Style error UI to match app design system

### Step 3: Add Global Error Handlers

- Update `src/main.tsx`
- Add `window.onerror` handler
- Add `window.onunhandledrejection` handler
- Integrate with errorHandler utility
- Handle development vs production behavior

### Step 4: Integrate Error Boundary in App

- Update `src/App.tsx`
- Wrap Router/Routes in ErrorBoundary
- Add resetKeys for user authentication state
- Test error boundary placement

### Step 5: Testing & Validation

- Test with intentional component errors
- Test with async errors (promise rejections)
- Test error boundary recovery
- Verify error reporting logs correctly
- Test error UI accessibility

## Code Examples

### ErrorBoundary Component Structure

```typescript
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to error handler
    reportError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: 'AppErrorBoundary',
      timestamp: Date.now(),
      // ... other context
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}
```



### Global Error Handler Setup

```typescript
// In main.tsx
window.onerror = (message, source, lineno, colno, error) => {
  reportError(error || new Error(String(message)), {
    userAction: 'JavaScript Runtime Error',
    // ... context
  });
  return false; // Allow default handling in dev
};

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  reportError(event.reason, {
    userAction: 'Unhandled Promise Rejection',
    // ... context
  });
  event.preventDefault(); // Prevent console error in production
};
```



## Design Considerations

### Error UI Design

- Match existing app design system (light mode, Tailwind classes)
- Use existing color scheme (primary, error colors from design system)
- Responsive design (mobile-friendly)
- Clear visual hierarchy (icon, title, message, actions)

### Error Messages

- User-friendly messages (avoid technical jargon)
- Actionable guidance ("Try again" vs "Error: Cannot read property 'x'")
- Collapsible technical details for debugging
- Support for different error types (network, validation, etc.)

### Error Recovery

- Reset error boundary state
- Navigate to safe route (dashboard)
- Clear problematic state
- Retry failed operations where applicable

## Future Enhancements

1. **Sentry Integration**: Replace console logging with Sentry error tracking
2. **Error Analytics**: Track error frequency and patterns
3. **User Feedback**: Allow users to submit error reports with context
4. **Nested Boundaries**: Add error boundaries for specific features (Editor, Dashboard)
5. **Error Categorization**: Classify errors (network, validation, rendering, etc.)
6. **Automatic Recovery**: Retry failed operations automatically where safe

## Testing Strategy

1. **Component Errors**: Throw errors in components to test boundary
2. **Async Errors**: Test unhandled promise rejections
3. **Recovery**: Test reset functionality
4. **Navigation**: Test error boundary reset on route changes
5. **Error Reporting**: Verify error context is captured correctly
6. **UI/UX**: Test error fallback UI on different screen sizes

## Dependencies

- No new dependencies required