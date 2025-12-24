---
name: Improve Deck Building UI/UX
overview: Remove duplicate navigation buttons, improve progress indicators, remove background option, and replace clunky progress percentage with subtle visual indicators in the dashboard.
todos:
  - id: remove-duplicate-button
    content: Remove duplicate 'Back to Dashboard' button from Editor.tsx (lines 395-406)
    status: pending
  - id: improve-loader
    content: "Refactor Loader component in SlideDeck.tsx: add spinner, simplify progress bar, remove pulsing dots and percentage text, consolidate messages"
    status: pending
  - id: remove-background-button
    content: Remove 'Continue in Background' button from Loader component in SlideDeck.tsx
    status: pending
    dependencies:
      - improve-loader
  - id: replace-dashboard-indicator
    content: Replace progress percentage badge in Dashboard.tsx with subtle animated border and corner indicator
    status: pending
  - id: update-card-styling
    content: Update dashboard card className to handle generating state with proper disabled styling
    status: pending
    dependencies:
      - replace-dashboard-indicator
---

# Improve Deck Building UI/UX

## Issues Identified

1. **Duplicate "Back to Dashboard" buttons**: One in the deck page (top-right) and one in the user input sidebar - redundant and confusing
2. **Poor progress bar and messages**: Current implementation has cluttered progress indicators with pulsing dots, small percentage text, and verbose messages
3. **"Continue in Background" button**: Unnecessary option that encourages users to leave when we want them to wait
4. **Overlapping progress percentage in dashboard**: The progress percentage badge overlaps with card text, creating a poor visual experience

## Implementation Plan

### 1. Remove Duplicate "Back to Dashboard" Button

**File:** [`src/components/Editor.tsx`](src/components/Editor.tsx)**Change:** Remove the desktop "Back to Dashboard" button from the deck page (lines 395-406). Keep only the button in the sidebar header (lines 425-433) which is sufficient for navigation.**Rationale:** The sidebar button is always accessible and provides consistent navigation. The duplicate button in the deck area is redundant and adds visual clutter.---

### 2. Improve Progress Bar and Messages

**File:** [`src/components/SlideDeck.tsx`](src/components/SlideDeck.tsx)**Changes:**

#### 2.1 Simplify Loader Component (lines 40-82)

**Remove:**

- The three pulsing dots below the progress bar (lines 52-56)
- The percentage text display (lines 57-59)
- The verbose secondary description paragraph (lines 68-72)

**Add:**

- A centered spinner icon above the progress bar for visual feedback
- A single, clear status message that updates based on progress
- Cleaner progress bar styling

**New Implementation:**

```typescript
const Loader: React.FC<{ progress?: number }> = ({ progress }) => {
    const getStatusMessage = () => {
        if (progress === undefined) return 'Preparing your presentation';
        if (progress < 25) return 'Researching content';
        if (progress < 75) return 'Writing slides';
        if (progress < 100) return 'Finalizing presentation';
        return 'Almost done';
    };

    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
            {/* Spinner Icon */}
            <div className="mb-8">
                <svg 
                    className="animate-spin h-8 w-8 text-primary" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                    aria-label="Loading"
                >
                    <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                    />
                    <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            </div>

            {/* Progress Bar - Clean and minimal */}
            <div className="w-full max-w-md mb-6">
                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        style={{ 
                            width: progress !== undefined 
                                ? `${progress}%` 
                                : '33%'
                        }}
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Generation progress"
                    />
                </div>
            </div>

            {/* Status Message - Single line, clear */}
            <h2 className="text-2xl font-semibold text-primary-text mb-2 tracking-tight">
                {getStatusMessage()}
            </h2>
        </div>
    );
};
```

**Rationale:**

- Removes visual clutter (pulsing dots, percentage text)
- Provides clear, single-line status updates
- Maintains accessibility with ARIA labels
- Follows design guidelines for minimalism and cognitive load reduction

---

### 3. Remove "Continue in Background" Button

**File:** [`src/components/SlideDeck.tsx`](src/components/SlideDeck.tsx)**Change:** Remove the "Continue in Background" button (lines 74-79) from the Loader component.**Rationale:** Users can still navigate away using the sidebar button if needed, but we don't want to encourage leaving during generation. The button removal aligns with the goal of keeping users engaged during the short generation process.---

### 4. Replace Progress Percentage with Subtle Dashboard Indicator

**File:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx)**Changes:**

#### 4.1 Remove Progress Badge (lines 226-234)

Remove the entire status badge that displays "Generating X%" which overlaps with card content.

#### 4.2 Add Subtle Visual Indicators

Replace the badge with:

- An animated border around the card (subtle pulse effect)
- A small corner indicator dot (top-right)
- A subtle overlay to indicate disabled state
- Update card className to handle generating state

**New Implementation:**

```typescript
{/* Replace lines 226-234 with: */}
{project.status === 'generating' && (
    <>
        {/* Animated border indicator */}
        <div 
            className="absolute inset-0 rounded-xl border-2 border-primary/30 pointer-events-none"
            style={{
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
        />
        
        {/* Subtle corner indicator */}
        <div className="absolute top-3 right-3 z-10">
            <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </div>
        </div>
        
        {/* Subtle overlay for disabled state */}
        <div className="absolute inset-0 bg-white/40 rounded-xl pointer-events-none" />
    </>
)}
```



#### 4.3 Update Card Styling (line 223)

Modify the card className to handle the generating state:

```typescript
className={`
    group/card rounded-xl pt-5 pb-4 px-6 
    border border-[rgba(0,0,0,0.06)] 
    shadow-[0_1px_3px_rgba(0,0,0,0.08)] 
    bg-surface 
    hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] 
    hover:-translate-y-0.5 
    transition-all duration-150 ease-out 
    relative flex flex-col min-h-[140px]
    ${project.status === 'generating' 
        ? 'opacity-75 cursor-not-allowed pointer-events-none' 
        : 'cursor-pointer'
    }
`}
```

**Rationale:**

- Eliminates text overlap issues
- Provides clear visual feedback without cluttering the card
- Maintains accessibility with visual indicators
- Follows design guidelines for subtle, minimalist indicators
- Card remains non-interactive during generation (pointer-events-none)

---

## Design Principles Applied

All changes follow the frontend design guidelines:

1. **Minimalism First**: Removed redundant elements and visual clutter
2. **Cognitive Load Reduction**: Simplified messages and removed unnecessary information
3. **Accessibility**: Maintained ARIA labels and semantic HTML
4. **Subtle Indicators**: Used gentle animations instead of text overlays
5. **Consistency**: Aligned with existing design patterns and spacing

---

## Testing Checklist

- [ ] Verify "Back to Dashboard" button only appears in sidebar
- [ ] Test progress bar displays correctly at all progress levels
- [ ] Confirm spinner animation is smooth and accessible
- [ ] Verify status messages update appropriately
- [ ] Test dashboard card indicators don't overlap content
- [ ] Confirm generating cards are non-clickable
- [ ] Test responsive behavior on mobile devices
- [ ] Verify animations respect prefers-reduced-motion
- [ ] Check accessibility with screen readers
- [ ] Test navigation flow from editor to dashboard and back

---

## Files Modified

1. [`src/components/Editor.tsx`](src/components/Editor.tsx) - Remove duplicate dashboard button
2. [`src/components/SlideDeck.tsx`](src/components/SlideDeck.tsx) - Improve Loader component, remove background button