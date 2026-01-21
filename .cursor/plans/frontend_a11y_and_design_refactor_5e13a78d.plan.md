---
name: Frontend A11y and Design Refactor
overview: "Implement all recommended frontend changes from the web design and accessibility review in one refactor: new Modal and ConfirmDialog components, skip link and focus traps, ARIA and form fixes, design-token alignment for Auth/InputForm/FileUploader, replace alert/confirm with in-UI feedback, document titles, and miscellaneous a11y/UX fixes."
todos:
  - id: pr1
    content: "PR 1: Foundation (1a–1d) + App skip link and auth-loading"
    status: pending
  - id: pr2
    content: "PR 2: Landing + FAQ (Header nav, main id, document.title, Modal, FAQItem ARIA)"
    status: pending
  - id: pr3
    content: "PR 3: Auth + InputForm + FileUploader (tokens and ARIA)"
    status: pending
  - id: pr4
    content: "PR 4: Dashboard (8a–8d) + Editor + SlideDeck + SlideCard + Icons"
    status: pending
---

# Frontend Accessibility and Design Refactor

## Scope

One refactor implementing: skip navigation, modal focus/ESC/ARIA, FAQ and form ARIA, design-token consistency (Auth, InputForm, FileUploader), font stack, `prefers-reduced-motion`, replace `alert`/`confirm` with in-UI dialogs and messages, per-route `document.title`, dashboard card keyboard/semantics and delete ConfirmDialog, SlideDeck/SlideCard error states and a11y, and touch-target/icon fixes.

---

## Acceptance Criteria

- **Skip link:** Visible on keyboard focus; lands on the correct `#main-content` on every route (Landing, FAQ, Dashboard, Editor).
- **Modals:** Focus trapped inside; ESC closes; clicking backdrop closes (Auth and ConfirmDialog); focus returns to the element that opened the modal. **Scroll lock:** When Modal or ConfirmDialog is open, the page behind (body) must not scroll. Store `body.style.overflow` before setting `hidden` and restore it on close so pre-existing styles or other overlays are not wiped. Only one overlay is expected at a time.
- **No `alert()` or `confirm()`:** All removed; errors show inline with `role="alert"`; confirmations use `ConfirmDialog`.
- **Icon-only buttons:** All have accessible names (`aria-label` or equivalent).
- **Document titles:** Each major route sets a distinct `document.title` on mount; cleanup on unmount is optional (next route sets on mount; see §3).
- **No nested interactives:** Project cards use `Link` with Delete/Retry as siblings; no button/link inside another.
- **Focus visibility:** All interactive elements show a visible focus indicator when navigated to via keyboard (Tab, etc.); the existing `:focus-visible` rule in `index.css` defines success.

---

## No Visual Regression

Spacing, typography, and layout must remain visually consistent with the current UI except for intentional improvements (e.g. Auth modal in light theme when `isModal`, design-token alignment in InputForm/FileUploader). When swapping tokens (e.g. `slate-400` → `secondary-text`), preserve equivalent contrast and size. After each major step (especially Foundation, Auth, InputForm/FileUploader, Dashboard cards), do a quick visual pass on the affected screens.

---

## Verification: Test Plan

**Verification checklist (summary)**

- **Keyboard-only:** Tab order logical, focus ring visible on all interactive elements, no focus traps.
- **Screen reader:** Dialog and alertdialog announced with title; button labels and loading (`aria-live`) announced.

**Keyboard-only walkthrough**

1. Tab from load: first focusable is Skip link; activating it moves focus to `#main-content`.
2. On Landing/FAQ: Tab through Header (Logo, FAQ, Sign In); no focus traps; focus ring visible on all.
3. Open Auth modal (Sign In): focus moves into dialog; Tab cycles only Close and "Sign in with Google"; Shift+Tab ditto; ESC closes and focus returns to Sign In.
4. FAQ: Tab to an FAQ button; Enter/Space toggles; `aria-expanded` reflects state.
5. Dashboard: Tab through header, "New Project", Create New card, project cards (or Link + Delete when revealed); Sign out and Delete are reachable; Enter on card Link navigates.
6. Delete: Hover/focus to reveal Delete; click opens ConfirmDialog; Tab between Cancel/Delete; ESC or Cancel closes; Confirm triggers delete; focus not trapped.
7. Editor: Tab through sidebar form (inputs, range, switch, file drop, Generate); no trap in main.
8. SlideDeck error: "Back to Dashboard" and "Retry" reachable; no trap.
9. **Scroll lock:** With Auth or ConfirmDialog open, try mouse wheel or trackpad scroll; the background must not move.

**Screen reader smoke test**

1. **Dialog:** When Auth or ConfirmDialog opens, dialog role and title (or `aria-labelledby`) are announced.
2. **Buttons:** "Sign in with Google", "Close modal", "Sign out", "Delete project", "Edit content", "Edit visual idea", "Copy to clipboard" / "Copied" have sensible announcements.
3. **Loading:** Auth loading screen: "Loading…" (or equivalent) in an `aria-live` region.
4. **Alerts:** Inline errors (SlideCard, SlideDeck, ConfirmDialog on `onConfirm` failure) are in `role="alert"` and announced.
5. **Form:** Topic, Grade, Subject, Creativity, Bullets, Length, Description, Use Google Search have names or `aria-label`/`aria-describedby` where needed.
6. **FAQ:** Expand/collapse announces expanded/collapsed.

---

## 1. New Shared Components and Hooks

### 1.1 `useFocusTrap` hook

**New file:** [src/hooks/useFocusTrap.ts](src/hooks/useFocusTrap.ts)

- **Signature:** `useFocusTrap(containerRef: RefObject<HTMLElement | null>, isActive: boolean): void`  

**Only** Tab cycling and focus save/restore. No ESC handling (keeps the hook reusable for future non-dismissible dialogs).

- When `isActive`: on mount, store `document.activeElement`, focus first focusable in container, add `keydown` listener for **Tab only**: if focus would leave the container, `preventDefault` and move focus to last (Shift+Tab) or first (Tab) focusable.
- **Focusable selector:** `button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`. Exclude `[disabled]` so disabled controls are never the first focusable. **Implementation:** use this string with `container.querySelectorAll(...)`; copy it exactly—a mismatched or missing bracket can silently break focus trapping.
- **If no focusable elements exist** (e.g. empty or loading dialog): focus the container instead of throwing; the container must have `tabIndex={-1}` so it can receive focus. Callers (Modal, ConfirmDialog) ensure the inner `div` has `tabIndex={-1}` when it may be empty.
- On cleanup: remove listener, restore stored `activeElement` focus.

**Sub-step 1a:** Implement `useFocusTrap` and verify in isolation (e.g. a small test div with two buttons) that Tab cycles and focus restores.

### 1.1b `useScrollLock` hook

**New file:** [src/hooks/useScrollLock.ts](src/hooks/useScrollLock.ts)

- **Signature:** `useScrollLock(isOpen: boolean): void`
- **Behavior:** `useEffect(() => { if (!isOpen) return; const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, [isOpen]);`. The cleanup restores any pre-existing `body` overflow and avoids fighting other overlays.
- **Note:** Only one overlay (Modal or ConfirmDialog) is expected at a time. If nested modals are added later, consider a stack of stored values; for now, a single hook is enough. Modal and ConfirmDialog both call `useScrollLock(open)`. Implement `useScrollLock` before Modal (1c).
- **Mount only when open:** Render Modal/ConfirmDialog only when `open` is true (e.g. `{showAuthModal ? <Modal ...> : null}` or `{deleteConfirm && <ConfirmDialog open={true} ... />}`). That way `useScrollLock` and `useFocusTrap` run only while the dialog is on-screen; effects do not run for an offscreen, closed dialog.

**Sub-step 1b:** Before Modal: in [index.css](src/index.css) add `.sr-only`, `.skip-link`/`.skip-link:focus`, and `prefers-reduced-motion` (see §2.1); in [tailwind.config.js](tailwind.config.js) and `:root` set the font stack (see §2.2). No new JS components in this step.

### 1.2 `Modal` component

**New file:** [src/components/Modal.tsx](src/components/Modal.tsx). Export so PR2 can `import { Modal } from 'src/components/Modal'` (or the project’s alias). Ensure the file path is `src/components/Modal.tsx` for consistent imports in later PRs.

- **Props:** `open: boolean`, `onClose: () => void`, `ariaLabelledby: string` (default `"auth-dialog-title"`), `children`, optional `closeButton?: boolean` (default true).
- **Structure:** when `open`: (1) **Backdrop** — plain `div` with **no role** (only decorative); `inset-0 bg-black/50`, `onClick={onClose}`. (2) **Inner container** — `div` with `onClick={e=>e.stopPropagation()}`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `tabIndex={-1}` for useFocusTrap fallback, `ref` for focus trap. Inside: close button (`aria-label="Close modal"`) and `children`.
- **Behavior:**
  - `useFocusTrap(innerRef, open)` — Tab + focus restore only.
  - `useScrollLock(open)` — store/restore `body.style.overflow` (see §1.1b).
  - **Modal’s own `useEffect`:** when `open`, add `keydown` for `Escape` → `onClose`; cleanup on unmount or when `open` becomes false. Close button and backdrop `onClick` call `onClose`.
- **Styling:** `max-w-md`, `p-4`; close button `absolute -top-10 right-0` (or top-right inside) to match current.

**Sub-step 1c:** Implement `Modal`, wire it on Landing (and optionally FAQ) as a smoke test, then run keyboard and screen-reader checks for this step.

### 1.3 `ConfirmDialog` component

**New file:** [src/components/ConfirmDialog.tsx](src/components/ConfirmDialog.tsx). Export so PR4 can `import { ConfirmDialog } from 'src/components/ConfirmDialog'` (or the project’s alias). Ensure the file path is `src/components/ConfirmDialog.tsx` for consistent imports.

- **Props:** `open: boolean`, `onClose: () => void`, `title: string`, `message: string`, `confirmLabel: string`, `cancelLabel: string`, `onConfirm: () => void | Promise<void>`, `destructive?: boolean`.
- **Structure:** when `open`: (1) **Backdrop** — plain `div` with **no role** (only decorative); only the inner container has `role="alertdialog"`. (2) **Inner container** — `div` with `role="alertdialog"`, `aria-labelledby` (title id), `aria-describedby` (message id), `tabIndex={-1}` for useFocusTrap fallback. Title, message, Cancel and Confirm buttons. Optional inline error block (see below).
- **Behavior:**
  - `useFocusTrap(innerRef, open)` — Tab + focus restore only.
  - `useScrollLock(open)` — store/restore `body.style.overflow` (see §1.1b).
  - **ConfirmDialog’s own `useEffect`:** when `open`, add `keydown` for `Escape` → `onClose`; cleanup on unmount or when `open` becomes false. Backdrop click and Cancel call `onClose`.
  - On Confirm: set internal `loading`, `await onConfirm()`, then `onClose()`. **On catch:** do **not** call `onClose`. Set internal `errorMessage` (e.g. `err instanceof Error ? err.message : "Something went wrong"`) and render it in a `role="alert"` block (e.g. below the message, `text-error`). **Announcement:** use `role="alert"` only; it implies a live region. Do not add `aria-live="assertive"` to avoid duplication. **Clear on close:** when the user clicks Cancel or backdrop, `onClose()` runs and the parent sets `open` to false; clear `errorMessage` in a `useEffect` when `open` becomes false so the next open starts clean and the error is not re-announced. Disable only Confirm while `loading`; keep Cancel enabled so the user can dismiss.
- **Styling:** `btn-primary` for confirm; when `destructive`, use `bg-error`-style. Disable buttons only while `loading`.

**Sub-step 1d:** Implement `ConfirmDialog` with inline `errorMessage` and `role="alert"` on `onConfirm` failure. It will be first used in Dashboard (step 8b).

---

## 2. Global Styles and Config

### 2.1 [src/index.css](src/index.css)

- **`.sr-only`** (if missing):
```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
```

- **`.skip-link`** (for the App skip link): **Decision (B)** — define in `index.css`. Base: same as `sr-only`. On focus, override so the link is visible:
```css
.skip-link {
  /* same as .sr-only */
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
.skip-link:focus {
  position: absolute; top: 1rem; left: 1rem; z-index: 100;
  width: auto; height: auto; padding: 0.5rem 1rem; margin: 0;
  overflow: visible; clip: auto; white-space: normal;
  background: #2180EA; color: white; border-radius: 6px;
}
```


Use the skip link as `<a href="#main-content" className="skip-link">`. **(A)** Use Tailwind `focus:not-sr-only` plus `focus:absolute` etc. only if your setup provides that variant.

- **`prefers-reduced-motion`** (after `@layer` or at end):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```


### 2.2 [tailwind.config.js](tailwind.config.js)

- **`fontFamily.sans`:** replace `['Inter', 'sans-serif']` with `['-apple-system','BlinkMacSystemFont','Segoe UI','Roboto','Helvetica Neue','Arial','sans-serif']`.
- **`:root` in index.css:** remove or replace `'Inter'` in `font-family` with the same system stack.

---

## 3. App and Router

### 3.1 [src/App.tsx](src/App.tsx)

- **Skip link:** Inside `Router`, before `Routes`, add `<a href="#main-content" className="skip-link">Skip to main content</a>`. The `.skip-link` and `.skip-link:focus` rules are in §2.1 (decision B).

- **Auth loading:** In the `isAuthLoading` block, add an `aria-live="polite"` region with "Loading…" for screen readers (e.g. a visually hidden span or a small caption next to the spinner).

**Document titles (implementation note):** Set `"SlidesEdu"` as the default once (e.g. in `index.html` `<title>`). Each route (Landing, FAQ, Dashboard, Editor) overrides in a `useEffect` on mount. Cleanup on unmount is then optional, since the next route sets on mount; the per-route "cleanup to SlidesEdu" is equivalent but adds more moving parts.

---

## 4. Layout and Landing

### 4.1 [src/components/landing/Header.tsx](src/components/landing/Header.tsx)

- Wrap the `div` that contains the Logo, FAQ `Link`, and Sign In `button` in `<nav aria-label="Main navigation">`.

### 4.2 [src/components/LandingPage.tsx](src/components/LandingPage.tsx)

- **`<main id="main-content" tabIndex={-1}>`** so the skip target is focusable.
- **Auth modal:** Replace the custom modal `div`/backdrop/close with `<Modal open={showAuthModal} onClose={handleCloseModal} ariaLabelledby="auth-dialog-title">` and render `<Auth isModal />` as child. Remove the inline close button (Modal provides it).
- **Conditional render:** Change `{showAuthModal && (...)}` to `{showAuthModal ? <Modal ...><Auth isModal /></Modal> : null}`.
- **document.title:** `useEffect` that sets `document.title = "SlidesEdu – Create Classroom Slides"` on mount; cleanup optional (see §3).

---

## 5. FAQ Page

### 5.1 [src/components/landing/FAQ.tsx](src/components/landing/FAQ.tsx)

- **`<main id="main-content" tabIndex={-1}>`**
- **document.title:** `useEffect` → `"SlidesEdu – FAQ"` on mount; cleanup optional (see §3).
- **Auth modal:** Same as Landing: use `Modal`, `{showAuthModal ? <Modal ...><Auth isModal /></Modal> : null}`. Modal’s close gets `aria-label="Close modal"` (in Modal itself).

### 5.2 `FAQItem` in [src/components/landing/FAQ.tsx](src/components/landing/FAQ.tsx)

- Use `useId()` to generate `id` for question and answer.
- **Button:** `aria-expanded={isOpen}`, `aria-controls={answerId}`, `id={questionId}`.
- **Answer `div`:** `id={answerId}`, `role="region"`, `aria-labelledby={questionId}`.

---

## 6. Auth

### 6.1 [src/components/Auth.tsx](src/components/Auth.tsx)

- **Debug `fetch`:** Remove all `#region agent log` blocks and `fetch('http://127.0.0.1:7243/ingest/...')` or wrap in `if (import.meta.env.DEV) { ... }` so it never runs in production. Prefer removal for the refactor.
- **Typo:** `p - 4 mb - 6` → `p-4 mb-6` in the message `div` `className`.
- **`id` for modal:** When `isModal`, set `id="auth-dialog-title"` on the `h1` ("Welcome Back").
- **Light theme when `isModal`:**
  - Outer: when `isModal`, `p-0` only; when not, keep `min-h-screen bg-slate-900` and `text-slate-200`.
  - Inner card: when `isModal` use `bg-surface` (`#FFFFFF`), `border-border-light`, `text-primary-text`, `text-secondary-text`; when not, keep `bg-slate-800`, `border-slate-700`.
  - `h1`: when `isModal` use `text-primary` (or `text-primary-text`); when not, keep gradient.
  - Subtext: when `isModal` `text-secondary-text`; when not `text-slate-400`.
  - Message `div`: when `isModal` use `border-error`/`text-error` and `border-secondary`/`text-secondary` for success; when not, keep current.
  - Google button: when `isModal` use `btn-primary`-like styling to match design system; when not, keep current. Ensure `disabled` and loading state remain.

---

## 7. InputForm and FileUploader (Editor)

### 7.1 [src/components/InputForm.tsx](src/components/InputForm.tsx)

- **Design tokens:** Replace `text-slate-400`, `text-slate-500`, `bg-slate-800/50`, `border-white/5`, `bg-slate-600` with `text-secondary-text`, `border-border-light`, `bg-neutral-bg`, `bg-border-light` (or `neutral-bg` for tracks). Use `accent-primary` for `input[type=range] `where `accent-sky-500` is used.
- **ARIA:**
  - Description textarea (when expanded): `aria-label="Additional description (optional)"`.
  - Creativity range: `aria-valuemin={0.5}`, `aria-valuemax={0.9}`, `aria-valuenow={creativityLevel}`, `aria-label="Creativity level"`.
  - Bullets range: `aria-valuemin={3}`, `aria-valuemax={6}`, `aria-valuenow={bulletsPerSlide}`, `aria-label="Bullets per slide"`.
  - Length range: `aria-valuemin={0}`, `aria-valuemax={20}`, `aria-valuenow={numSlides}` (label already via `htmlFor="numSlides"`).
- **Description toggle:** Keep as button; ensure `focus:outline-none` doesn’t remove focus ring (rely on `:focus-visible` in global CSS).

### 7.2 [src/components/FileUploader.tsx](src/components/FileUploader.tsx)

- **Design tokens:** Replace `text-slate-300`, `text-slate-400`, `text-slate-500`, `text-slate-600`, `bg-slate-800`, `bg-slate-900/40`, `border-white/5`, `border-white/10`, `bg-slate-800` (progress), etc., with `text-primary-text`, `text-secondary-text`, `bg-neutral-bg`, `border-border-light`, `border-subtle` so it matches the light Editor sidebar. Keep `bg-[#FAFAF8] `as `bg-background` if that’s the token.

---

## 8. Dashboard

### 8.1 [src/components/Dashboard.tsx](src/components/Dashboard.tsx)

**Sub-step 8a (low risk):** `main` id, `document.title`, sign-out, delete `aria-label`

- **`<main id="main-content" tabIndex={-1}>`**
- **document.title:** `useEffect` → `"SlidesEdu – Your Projects"` on mount; cleanup optional (see §3).
- **Sign-out:** Replace the `div` with `onClick={handleSignOut}` and `title="Click to Sign Out"` by a `<button type="button" onClick={handleSignOut} aria-label="Sign out">` with the same inner content (avatar, name, icon). Preserve layout and `group`/hover.
- **Delete button (on card):** Add `aria-label="Delete project"` (keep `title` for tooltip). Leave `handleDeleteProject` and `window.confirm` as-is for this sub-step.

**Sub-step 8b:** ConfirmDialog and delete flow

- **State:** `deleteConfirm: { projectId: string } | null`.
- **`handleDeleteProject`:** Stop calling `window.confirm`; instead `setDeleteConfirm({ projectId })`.
- **`handleConfirmDelete`:** `try { await deleteProject(user.uid, deleteConfirm.projectId); setProjects(prev => prev.filter(p => p.id !== deleteConfirm.projectId)); setDeleteConfirm(null); } catch { /* ConfirmDialog shows error inline */ }`.
- **Render:** `{deleteConfirm && <ConfirmDialog open={true} onClose={()=>setDeleteConfirm(null)} title="Delete project" message="Are you sure you want to delete this project?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={handleConfirmDelete} destructive />}`. Mount only when `deleteConfirm` is non-null so `useScrollLock` and `useFocusTrap` run only while the dialog is on-screen (see §1.1b). Use `open={true}` explicitly to satisfy `open: boolean` and avoid lint/style churn.
- **Verify:** Delete still works; on `deleteProject` failure, error appears inside the dialog and user can Cancel to close.

**Sub-step 8c:** Project cards — `Link` and sibling Delete / Failed

- Refactor so the clickable card is a `Link` to `/project/${project.id}` and the Delete button is a **sibling** (not inside the `Link`). Use a wrapper `div` with `relative` and `group/card`; `Link` gets the card layout and content (title, badges, metadata); Delete `button` is `absolute top-2 right-2 z-10` with `opacity-0 group-hover/card:opacity-100`. When `project.status === 'generating'`, render a `div` with the same visual and `aria-busy` (no `Link`, no Delete). When `project.status === 'failed'`, keep the "Failed" + Retry overlay: render it as a **sibling** to the `Link` (absolute top-left) so the Retry button is not inside the `Link`. Retry `onClick`: `e.stopPropagation(); navigate(\`/project/${project.id}\`);`.
- Extract the shared card body (title, badges, metadata, and when generating: overlay, ping, etc.) into a variable or small helper to avoid duplication between `Link` and `div` branches.
- **Verify:** Card click and keyboard (Enter on `Link`) navigate; Delete and Retry work; no nested interactives.

**Sub-step 8d:** Create New card

- Replace `div` + `onClick={() => navigate('/new')}` with `<Link to="/new">` and the same inner content and styling.

---

## 9. Editor

### 9.1 [src/components/Editor.tsx](src/components/Editor.tsx)

- **`<main id="main-content" tabIndex={-1}>`** on the main content `main` (the one that wraps `SlideDeck`).
- **document.title:** `useEffect` depending on `topic` and `useLocation().pathname`: when path is `/new` or `/project/:id`, set `document.title = \`SlidesEdu – ${topic || 'New Project'}\`` on mount; cleanup optional (see §3). Dependencies: `[topic, pathname]`.

---

## 10. SlideDeck

### 10.1 [src/components/SlideDeck.tsx](src/components/SlideDeck.tsx)

- **`useNavigate`:** Add `const navigate = useNavigate()` and replace `window.location.href = '/'` in the error view’s "Back to Dashboard" with `navigate('/')`.
- **Export/Notes/Images errors:** Add state, e.g. `exportError: string | null` (or separate `pptError`, `notesError`, `imagesError`). In `handleExportPPTX`, `handleDownloadNotes`, `handleDownloadAllImages`: in `catch`, set the corresponding error instead of `alert(...)`. In the main UI (toolbar or above the deck), render an inline `role="alert"` message with the error and a "Dismiss" or "Retry" that clears the error and optionally retries. Use design tokens for error (`text-error`, `border-error`).

---

## 11. SlideCard

### 11.1 [src/components/SlideCard.tsx](src/components/SlideCard.tsx)

- **Invalid class:** `border-[#rgba(0,0,0,0.08)] `→ `border-subtle` or `border-[rgba(0,0,0,0.08)]`.
- **CopyButton:** `aria-label={copied ? 'Copied' : 'Copy to clipboard'}` on the `button`.
- **Generated image `img`:** `alt="Generated"` → `alt={\`Generated image for slide: ${slide.title}\`}` (or similar).
- **Pencil (Edit) button:** Ensure touch target ≥ 44×44: e.g. `min-w-[44px] min-h-[44px] `and `p-2` or `p-3`; same for the Edit Visual Idea button.
- **Replace `alert` with in-UI error:**
  - State: `imageError: string | null`, `promptError: string | null`.
  - In `handleGenerateImage` and `handleGeneratePrompt` / `handleRetryPromptGeneration`: in `catch`, set the corresponding error and clear it after a few seconds or on next action. Remove `alert(...)`.
  - In the card footer (near the visual-idea block or under the main content), render a `role="alert"` `div` when `imageError` or `promptError` is set, with the message and a Dismiss/close. Use `text-error`/`border-error`.

---

## 12. Icons and Decorative SVGs

### 12.1 [src/components/icons.tsx](src/components/icons.tsx)

- For each icon component, add `...rest` to props and spread onto the root `<svg>`, e.g. `function CopyIcon({ className, ...rest }) { return <svg ... {...rest} /> }`, so parents can pass `aria-hidden="true"` where the icon is decorative.

### 12.2 Decorative SVGs

- **[src/components/landing/Features.tsx](src/components/landing/Features.tsx):** Add `aria-hidden="true"` to each feature’s `svg`.
- **[src/components/landing/HowItWorks.tsx](src/components/landing/HowItWorks.tsx):** Add `aria-hidden="true"` to the step number circle’s container if it’s purely decorative, or to any decorative `svg`; the number `{step.number}` can stay.
- **[src/components/landing/UseCases.tsx](src/components/landing/UseCases.tsx):** Add `aria-hidden="true"` to the checkmark `svg` in each list item (the text carries the meaning).

### 12.3 Icon-only buttons

- **SlideCard:** Edit Content `button` (PencilIcon): add `aria-label="Edit content"`. Edit Visual Idea `button`: add `aria-label="Edit visual idea"`. CopyButton already handled above.

---

## 13. ErrorBoundary and Others

- **ErrorBoundary:** No changes.
- **FAQ modal close:** Handled by `Modal`’s built-in `aria-label="Close modal"`.

---

## 14. File and Directory Summary

**New:**

- `src/hooks/useFocusTrap.ts`
- `src/hooks/useScrollLock.ts`
- `src/components/Modal.tsx`
- `src/components/ConfirmDialog.tsx`

**Modified:**

- `src/index.css`
- `tailwind.config.js`
- `src/App.tsx`
- `src/components/landing/Header.tsx`
- `src/components/LandingPage.tsx`
- `src/components/landing/FAQ.tsx`
- `src/components/Auth.tsx`
- `src/components/InputForm.tsx`
- `src/components/FileUploader.tsx`
- `src/components/Dashboard.tsx`
- `src/components/Editor.tsx`
- `src/components/SlideDeck.tsx`
- `src/components/SlideCard.tsx`
- `src/components/icons.tsx`
- `src/components/landing/Features.tsx`
- `src/components/landing/HowItWorks.tsx`
- `src/components/landing/UseCases.tsx`

---

## 15. Execution Strategy: 4 PRs

Execute as four separate, merge-safe PRs. Run the Verification: Test Plan (and the relevant subset of the No Visual Regression checks) after each PR.

**UI review checklist (use as PR comment template before merge):**

```
- [ ] Keyboard walkthrough: done
- [ ] Screen reader smoke: done
- [ ] Visual pass: done
```

**PR 1: Foundation + App skip link**

- §1 (sub-steps 1a–1d): `useFocusTrap` (1a); `useScrollLock` (§1.1b); `index.css` (`.sr-only`, `.skip-link`/`.skip-link:focus`, `prefers-reduced-motion`) and font in `tailwind`/`:root` (1b); `Modal` (1c); `ConfirmDialog` (1d).
- §3 App: Skip link (`className="skip-link"`), auth-loading `aria-live`, and document-titles note. (Skip link and `.skip-link` live in §2.1; App only renders the link.)

**PR 2: Landing + FAQ**

- §4 `Header`: `<nav aria-label="Main navigation">`.
- §4 `LandingPage`: `main` id, `document.title`, switch to `Modal` for Auth, conditional render.
- §5 `FAQ`: `main` id, `document.title`, `Modal` for Auth; §5.2 `FAQItem` `aria-expanded`/`aria-controls`/`aria-labelledby`.
- §12.2 Decorative SVGs: `Features`, `HowItWorks`, `UseCases` — add `aria-hidden="true"` to the decorative `svg`s (keeps marketing-page changes together; low-risk).

**PR 3: Auth + InputForm + FileUploader**

- §6 `Auth`: remove debug `fetch`, fix `p-4 mb-6`, `id="auth-dialog-title"` when `isModal`, light theme when `isModal`.
- §7 `InputForm`: ARIA on ranges and description, design tokens.
- §7 `FileUploader`: design tokens.

**PR 4: Dashboard + Editor + SlideDeck + SlideCard + Icons**

- §8 `Dashboard` (8a–8d): `main` id, `document.title`, sign-out `button`, delete `aria-label` (8a); `ConfirmDialog` and delete flow (8b); project card `Link`/sibling Delete and Failed overlay (8c); Create New `Link` (8d).
- §9 `Editor`: `main` id, `document.title` from `topic` and pathname.
- §10 `SlideDeck`: `useNavigate` for Back, export/notes/images error state and `role="alert"`.
- §11 `SlideCard`: border fix, CopyButton `aria-label`, image `alt`, Pencil 44×44, `imageError`/`promptError` and `role="alert"`.
- §12.1 `icons` `...rest` (used in SlideCard and app-wide; stays in PR4); §12.3 SlideCard Edit `aria-label`s.

**Within each PR,** follow the order above. No PR depends on a later PR; earlier PRs leave `window.confirm`/`alert` or existing modals in place where the replacement is in a later PR.

**After PR4:** Run a repo-wide grep for `alert(` and `confirm(` (e.g. `rg "alert\("` and `rg "confirm\("` in `src/`) and fix or remove any remaining usages so the acceptance criterion **No `alert()` or `confirm()`** is met.

---

## 16. Dependencies and Risks

- **PR1 export paths:** PR1 must export `Modal` from `src/components/Modal.tsx` and `ConfirmDialog` from `src/components/ConfirmDialog.tsx`. PR2 imports `Modal`; PR4 imports `ConfirmDialog`. Use consistent paths (or the project’s alias) so later PRs do not need to guess.
- **`useScrollLock`:** Only one overlay (Modal or ConfirmDialog) is expected at a time. Nested modals would require a stack of stored `body.style.overflow` values; for now, the single store/restore in `useScrollLock` is sufficient.
- **`useFocusTrap` and `Modal`:** `useFocusTrap` handles only Tab cycling and focus save/restore; ESC and backdrop are handled in `Modal`/`ConfirmDialog` via their own `useEffect`. Must run only when the modal is open and when the inner content is mounted; use `innerRef` and `isActive=open`. Ensure `onClose` is stable or the effect deps are correct to avoid stale closures.
- **Dashboard card `Link` vs `div`:** The failed overlay and Delete must stay outside the `Link` to avoid nested interactives. Layout (overlays, `group/card`) must match current behavior.
- **Auth `isModal`:** Both standalone (e.g. direct route) and modal usages must be tested; `isModal` drives layout and tokens only.
- **`prefers-reduced-motion`:** The global override is broad; if any animation is required for correctness, consider a more targeted override. The current review recommends the global rule.