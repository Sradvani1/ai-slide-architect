---
name: Image Carousel Modal and Batch Download
overview: Add a modal image viewer with navigation for search images and multi-select batch download functionality. Replace the current behavior where clicking images opens new tabs with a contained modal experience, and enable users to select multiple images and download them as a ZIP file.
todos:
  - id: install-jszip
    content: Add jszip dependency to package.json
    status: completed
  - id: create-image-viewer-modal
    content: Create ImageViewerModal component with navigation, keyboard support, and image preloading
    status: completed
  - id: create-image-download-utils
    content: Create imageDownload.ts utility with fetchImageAsBlob and downloadImagesAsZip functions, including CORS handling
    status: completed
  - id: add-selection-state
    content: Add selection mode state and handlers to SlideCard component
    status: completed
  - id: update-image-carousel-ui
    content: Replace <a> tags with clickable divs, add selection mode visual feedback, and integrate click handlers
    status: completed
  - id: add-selection-controls
    content: Add Select Images button, selection mode controls (counter, cancel, download), and integrate download functionality
    status: completed
  - id: integrate-modal
    content: Integrate ImageViewerModal into SlideCard with proper state management and navigation handlers
    status: completed
  - id: error-handling
    content: Add error handling for CORS failures, image load failures, and empty states
    status: completed
isProject: false
---

# Image Carousel Modal and Batch Download Feature

## Overview

This plan implements two UX improvements for the search image carousel in `SlideCard.tsx`:

1. **Modal Image Viewer**: Replace new-tab navigation with a full-screen modal containing a larger image view and left/right navigation
2. **Multi-Select Batch Download**: Add selection mode with visual feedback and ZIP download capability

## Current State

In [`src/components/SlideCard.tsx`](src/components/SlideCard.tsx) (lines 485-516), search images are displayed as thumbnails in a horizontal scroll. Each image is wrapped in an `<a>` tag that opens `sourcePageUrl` in a new tab, which provides a poor viewing experience for small thumbnails.

## Architecture

### Component Structure

```
SlideCard
├── ImageCarousel (existing horizontal scroll)
│   ├── ImageThumbnail (enhanced with click handler)
│   └── SelectionModeControls (new)
└── ImageViewerModal (new)
    ├── LargeImageView
    ├── NavigationArrows
    └── ImageCounter
```

### Data Flow

1. **Modal Viewer Flow**:

   - User clicks thumbnail → Opens modal with clicked image index
   - User navigates with arrows/keyboard → Updates displayed image index
   - Modal fetches and displays full-size image

2. **Selection & Download Flow**:

   - User toggles "Select Images" → Enters selection mode
   - User clicks thumbnails → Toggles selection state
   - User clicks "Download Selected" → Fetches images → Creates ZIP → Triggers download

## Implementation Details

### 1. Install JSZip Dependency

Add `jszip` to `package.json` dependencies:

```json
"jszip": "^3.10.1"
```

### 2. Create ImageViewerModal Component

**New file**: [`src/components/ImageViewerModal.tsx`](src/components/ImageViewerModal.tsx)

- Props:
  - `images: GeneratedImage[]` - Array of images to display
  - `initialIndex: number` - Starting image index
  - `open: boolean` - Modal visibility
  - `onClose: () => void` - Close handler
- Features:
  - Full-screen or large modal (90% viewport width, max-height with aspect ratio preservation)
  - Large image display with `object-contain` to preserve aspect ratio
  - Left/right arrow buttons on sides of image
  - Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  - Image counter display (e.g., "3 of 50")
  - Loading state for image fetch
  - Error handling for failed image loads
  - Click outside backdrop to close
  - Preload adjacent images for smooth navigation

### 3. Create Image Download Utility

**New file**: [`src/utils/imageDownload.ts`](src/utils/imageDownload.ts)

Functions:

- `fetchImageAsBlob(url: string): Promise<Blob>` - Fetches image with CORS handling
- `downloadImagesAsZip(images: GeneratedImage[], filename: string): Promise<void>` - Creates ZIP and triggers download
- `sanitizeFilename(name: string): string` - Sanitizes filenames for ZIP entries

**CORS Handling Strategy**:

- Try direct fetch first
- If CORS fails, use canvas-based approach: Load image in `<img>` with `crossOrigin="anonymous"`, draw to canvas, convert to blob
- If that fails, show error message for that specific image
- Continue with other images that succeed

### 4. Enhance SlideCard Component

**File**: [`src/components/SlideCard.tsx`](src/components/SlideCard.tsx)

#### State Additions:

```typescript
const [modalOpen, setModalOpen] = useState(false);
const [modalImageIndex, setModalImageIndex] = useState(0);
const [selectionMode, setSelectionMode] = useState(false);
const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
const [isDownloading, setIsDownloading] = useState(false);
```

#### Modifications:

**Lines 485-516** (Search Images Carousel):

- Replace `<a>` tags with clickable `<div>` or `<button>`
- Add click handler: `onClick={() => handleImageClick(index)}`
- Add selection mode visual feedback:
  - When `selectionMode` is true, show checkbox or highlight border
  - Apply `border-primary border-2` or similar when `selectedImageIds.has(img.id)`
- Add selection toggle handler: `onClick={() => handleToggleSelection(img.id)}` when in selection mode

**New Handlers**:

- `handleImageClick(index: number)` - Opens modal at specified index
- `handleToggleSelection(imageId: string)` - Toggles selection in Set
- `handleDownloadSelected()` - Downloads selected images as ZIP
- `handleEnterSelectionMode()` - Enters selection mode, clears previous selections
- `handleExitSelectionMode()` - Exits selection mode

**New UI Elements** (in footer section, around line 540):

- "Select Images" button (when not in selection mode and search images exist)
- Selection mode controls:
  - Counter: "X selected"
  - "Cancel" button to exit selection mode
  - "Download Selected (X)" button (disabled when none selected)
- Loading state during ZIP creation

### 5. Integration Points

**Modal Integration**:

- Import `ImageViewerModal` in `SlideCard.tsx`
- Render modal conditionally: `{modalOpen && <ImageViewerModal ... />}`
- Pass `searchImagesForSlide` as images prop
- Handle navigation: Update `modalImageIndex` on arrow clicks

**Download Integration**:

- Import `downloadImagesAsZip` from `imageDownload.ts`
- Show loading spinner during download
- Handle errors gracefully (show alert/toast for failed images)
- Generate filename: `slide-${slideNumber}-images-${Date.now()}.zip`

## Edge Cases & Error Handling

1. **CORS Issues**:

   - Some external images may not be fetchable
   - Use canvas fallback method
   - Show warning for images that fail
   - Continue with successful downloads

2. **Large Image Sets**:

   - Limit ZIP size or number of images (e.g., max 50)
   - Show progress indicator for large batches
   - Consider chunking for very large sets

3. **Modal Navigation**:

   - Handle edge cases (first/last image)
   - Disable arrows at boundaries
   - Loop navigation (optional, user preference)

4. **Image Loading Failures**:

   - Show placeholder/error in modal
   - Skip failed images in download
   - Log errors for debugging

5. **Empty States**:

   - Disable download button when no selections
   - Show message when selection mode has no images

## Testing Considerations

1. Test modal with various image sizes/aspect ratios
2. Test keyboard navigation (arrows, escape)
3. Test CORS scenarios (same-origin vs external)
4. Test ZIP creation with 1, 5, 20, 50 images
5. Test selection mode toggle and visual feedback
6. Test error handling for failed image fetches
7. Test on mobile devices (touch navigation)

## Accessibility

- Modal: ARIA labels, focus trap, keyboard navigation
- Selection mode: Screen reader announcements for selection count
- Download button: Loading state announcements
- Image alt text: Use existing alt text or generate descriptive text

## Performance Optimizations

- Preload adjacent images in modal (index ± 1)
- Lazy load images in carousel (intersection observer)
- Debounce selection toggle if needed
- Use `useMemo` for filtered selected images list
- Consider image compression for very large images in ZIP

## Dependencies

- `jszip`: ^3.10.1 (new)
- Existing: `Modal` component, React hooks