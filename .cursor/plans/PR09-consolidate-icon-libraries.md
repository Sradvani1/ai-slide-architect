# PR9: Consolidate icon libraries

## Purpose
- Use a single icon source to simplify dependencies and avoid duplicate semantics (e.g. Download in both heroicons and icons.tsx). Plan recommends lucide-react for consistency and tree-shaking.

## Current state (verified)
- **SlideDeck.tsx:** Imports `ArrowDownTrayIcon`, `ClipboardDocumentIcon`, `DocumentTextIcon`, `ShareIcon` from `@heroicons/react/24/outline`; used at lines 652, 670, 688, 706.
- **icons.tsx:** Defines `CopyIcon`, `CheckIcon`, `GenerateIcon`, `DownloadIcon`, `ImageIcon`, `PptxIcon`, `DocumentTextIcon`, `ShareIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `PencilIcon`. Used by Dashboard, InputForm, SlideCard (not SlideDeck).
- **package.json:** Has both `@heroicons/react` and `lucide-react`. lucide-react is not imported anywhere in `src/`.

## Implementation (option A – recommended in plan: lucide-react)

1. **Audit:** No other files import heroicons; only SlideDeck does. So only SlideDeck and package.json change.

2. **In SlideDeck.tsx:**
   - Replace: `import { ArrowDownTrayIcon, ClipboardDocumentIcon, DocumentTextIcon, ShareIcon } from '@heroicons/react/24/outline';`
   - With: `import { Download, Copy, FileText, Share2 } from 'lucide-react';` (or equivalent names; confirm lucide-react export names).
   - Replace each usage: `<ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />` → `<Download className="h-4 w-4" aria-hidden="true" />`, and similarly for Copy, FileText, Share2. Preserve `className` and `aria-hidden` where present.

3. **Remove** `@heroicons/react` from `package.json` dependencies.

4. **Run** `npm install` and root `npm run build`.

## Alternative (option B – no new deps)
- Use existing `icons.tsx`: SlideDeck already has equivalents (DownloadIcon, DocumentTextIcon, ShareIcon, and CopyIcon for clipboard). Change SlideDeck to import from `./icons` and remove `@heroicons/react`. Then you can remove `@heroicons/react` from package.json; leave or remove `lucide-react` depending on whether you plan to use it elsewhere.

## Verification
- Root `npm run build`
- Visual check: deck toolbar buttons (Share, Speaker notes, Copy, Download) still render and behave correctly.
