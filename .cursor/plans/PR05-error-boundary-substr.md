# PR5: Replace deprecated substr in ErrorBoundary

## Purpose
- Remove use of deprecated `String.prototype.substr` in favor of `slice` for forward compatibility and lint/standards.

## Scope
- **Single file:** `src/components/ErrorBoundary.tsx` (line 80)

## Implementation

1. **Replace** the error ID expression:
   - From: `Math.random().toString(36).substr(2, 9).toUpperCase()`
   - To: `Math.random().toString(36).slice(2, 11).toUpperCase()`
   - `slice(2, 11)` returns 9 characters, same as `substr(2, 9)`.

## Verification
- Root `npm run build`
- Trigger the error boundary and confirm the error ID still looks like a 9-character alphanumeric string.
