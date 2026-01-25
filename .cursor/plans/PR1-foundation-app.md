# PR 1: Foundation + App Skip Link

## Scope

This PR establishes the foundation for accessibility and design improvements: hooks for focus trapping and scroll locking, shared Modal and ConfirmDialog components, global styles (skip link, prefers-reduced-motion, font stack), and App-level skip link and auth loading improvements. It also aligns modal behavior with the **current Auth modal implementation** used in Landing, FAQ, and Share Preview.

## Acceptance Criteria (Relevant to PR1)

- **Skip link:** Visible on keyboard focus; lands on the correct `#main-content` on every route. **Decision:** each route’s primary `<main>` gets `id="main-content"` (Landing, FAQ, Dashboard, Editor, SharePreview).
- **Modals:** Focus trapped inside; ESC closes; clicking backdrop closes; focus returns to the element that opened the modal. **Scroll lock:** When Modal or ConfirmDialog is open, the page behind (body) must not scroll. Store `body.style.overflow` before setting `hidden` and restore it on close so pre-existing styles or other overlays are not wiped. Only one overlay is expected at a time.
- **Auth modal alignment:** The Auth component keeps its internal close button when used as a modal. The shared `Modal` should disable its own close button for Auth to avoid duplicate controls.
- **Focus visibility:** All interactive elements show a visible focus indicator when navigated to via keyboard (Tab, etc.); the existing `:focus-visible` rule in `index.css` defines success.

## No Visual Regression

Spacing, typography, and layout must remain visually consistent with the current UI (including the Auth modal’s card styling and the FAQ modal’s `backdrop-blur`). After this PR, do a quick visual pass to ensure the skip link appears correctly on focus and that Modal/ConfirmDialog match the current modal styling.

## Verification: Test Plan (PR1)

**UI review checklist (use as PR comment template before merge):**

```
- [ ] Keyboard walkthrough: done
- [ ] Screen reader smoke: done
- [ ] Visual pass: done
```

**Keyboard-only walkthrough (PR1 subset)**

1. Tab from load: first focusable is Skip link; activating it moves focus to `#main-content` in the current route’s `<main>`.
2. Open Auth modal (Sign In): focus moves into dialog; Tab cycles through Close, Google sign-in, email input, and email submit; Shift+Tab reverse; ESC closes and focus returns to Sign In.
3. **Scroll lock:** With Auth modal open, try mouse wheel or trackpad scroll; the background must not move.
4. Share Preview: click “Log in to edit and download” → Auth modal opens; closing modal clears the “should claim” state (no auto-claim after close).

**Screen reader smoke test (PR1 subset)**

1. **Dialog:** When Auth modal opens, dialog role and title (or `aria-labelledby`) are announced.
2. **Buttons:** "Close modal", "Sign in with Google", and "Continue with Email" have sensible announcements.
3. **Loading:** Auth loading screen: "Loading…" (or equivalent) in an `aria-live` region.

---

## Implementation Steps

### 1. Hooks

#### 1.1 `useFocusTrap` hook

**New file:** [src/hooks/useFocusTrap.ts](src/hooks/useFocusTrap.ts)

- **Signature:** `useFocusTrap(containerRef: RefObject<HTMLElement | null>, isActive: boolean): void`  

**Only** Tab cycling and focus save/restore. No ESC handling (keeps the hook reusable for future non-dismissible dialogs).

- When `isActive`: on mount, store `document.activeElement`, focus first focusable in container, add `keydown` listener for **Tab only**: if focus would leave the container, `preventDefault` and move focus to last (Shift+Tab) or first (Tab) focusable.
- **Focusable selector:** `button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`. Exclude `[disabled]` so disabled controls are never the first focusable. **Implementation:** use this string with `container.querySelectorAll(...)`; copy it exactly—a mismatched or missing bracket can silently break focus trapping.
- **If no focusable elements exist** (e.g. empty or loading dialog): focus the container instead of throwing; the container must have `tabIndex={-1}` so it can receive focus. Callers (Modal, ConfirmDialog) ensure the inner `div` has `tabIndex={-1}` when it may be empty.
- On cleanup: remove listener, restore stored `activeElement` focus.
- **Best practice (client-event-listeners):** Ensure the keydown listener is registered only while active and is always cleaned up to avoid multiple global listeners.

**Sub-step 1a:** Implement `useFocusTrap` and verify in isolation (e.g. a small test div with two buttons) that Tab cycles and focus restores.

#### 1.1b `useScrollLock` hook

**New file:** [src/hooks/useScrollLock.ts](src/hooks/useScrollLock.ts)

- **Signature:** `useScrollLock(isOpen: boolean): void`
- **Behavior:** `useEffect(() => { if (!isOpen) return; const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, [isOpen]);`. The cleanup restores any pre-existing `body` overflow and avoids fighting other overlays.
- **Note:** Only one overlay (Modal or ConfirmDialog) is expected at a time. If nested modals are added later, consider a stack of stored values; for now, a single hook is enough. Modal and ConfirmDialog both call `useScrollLock(open)`. Implement `useScrollLock` before Modal (1c).
- **Mount only when open:** Render Modal/ConfirmDialog only when `open` is true (e.g. `{showAuthModal ? <Modal ...> : null}` or `{deleteConfirm && <ConfirmDialog open={true} ... />}`). That way `useScrollLock` and `useFocusTrap` run only while the dialog is on-screen; effects do not run for an offscreen, closed dialog.
- **Best practice (rendering-conditional-render):** Prefer ternary (`condition ? <Modal ... /> : null`) over `&&` for conditional rendering of overlays.

### 2. Global Styles and Config

#### 2.1 [src/index.css](src/index.css)

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

**Sub-step 1b:** Add `.sr-only`, `.skip-link`/`.skip-link:focus`, and `prefers-reduced-motion` in [index.css](src/index.css); set the font stack in [tailwind.config.js](tailwind.config.js) and `:root` (see §2.2). No new JS components in this step.

#### 2.2 [tailwind.config.js](tailwind.config.js)

- **`fontFamily.sans`:** replace `['Inter', 'sans-serif']` with `['-apple-system','BlinkMacSystemFont','Segoe UI','Roboto','Helvetica Neue','Arial','sans-serif']`.
- **`:root` in index.css:** remove or replace `'Inter'` in `font-family` with the same system stack.

### 3. Modal Component

**New file:** [src/components/Modal.tsx](src/components/Modal.tsx). Export so PR2 can `import { Modal } from 'src/components/Modal'` (or the project's alias). Ensure the file path is `src/components/Modal.tsx` for consistent imports in later PRs.

- **Props:** `open: boolean`, `onClose: () => void`, `ariaLabelledby: string` (default `"auth-dialog-title"`), `children`, optional `closeButton?: boolean` (default true).
- **Structure:** when `open`: (1) **Backdrop** — plain `div` with **no role** (only decorative); `inset-0 bg-black/50`, `onClick={onClose}`. (2) **Inner container** — `div` with `onClick={e=>e.stopPropagation()}`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `tabIndex={-1}` for useFocusTrap fallback, `ref` for focus trap. Inside: close button (`aria-label="Close modal"`) and `children`.
- **Behavior:**
  - `useFocusTrap(innerRef, open)` — Tab + focus restore only.
  - `useScrollLock(open)` — store/restore `body.style.overflow` (see §1.1b).
  - **Modal's own `useEffect`:** when `open`, add `keydown` for `Escape` → `onClose`; cleanup on unmount or when `open` becomes false. Close button and backdrop `onClick` call `onClose`.
- **Styling:** `max-w-md`, `p-4`; close button `absolute -top-10 right-0` (or top-right inside) to match current.
- **Auth modal usage:** When wrapping `Auth` in `Modal`, set `closeButton={false}` and allow the Auth component to render its existing close control. Preserve the current card styling and `backdrop-blur` where used (FAQ).

**Sub-step 1c:** Implement `Modal`, wire it on Landing (and optionally FAQ) as a smoke test, then run keyboard and screen-reader checks for this step.

### 4. ConfirmDialog Component

**New file:** [src/components/ConfirmDialog.tsx](src/components/ConfirmDialog.tsx). Export so PR4 can `import { ConfirmDialog } from 'src/components/ConfirmDialog'` (or the project's alias). Ensure the file path is `src/components/ConfirmDialog.tsx` for consistent imports.

- **Props:** `open: boolean`, `onClose: () => void`, `title: string`, `message: string`, `confirmLabel: string`, `cancelLabel: string`, `onConfirm: () => void | Promise<void>`, `destructive?: boolean`.
- **Structure:** when `open`: (1) **Backdrop** — plain `div` with **no role** (only decorative); only the inner container has `role="alertdialog"`. (2) **Inner container** — `div` with `role="alertdialog"`, `aria-labelledby` (title id), `aria-describedby` (message id), `tabIndex={-1}` for useFocusTrap fallback. Title, message, Cancel and Confirm buttons. Optional inline error block (see below).
- **Behavior:**
  - `useFocusTrap(innerRef, open)` — Tab + focus restore only.
  - `useScrollLock(open)` — store/restore `body.style.overflow` (see §1.1b).
  - **ConfirmDialog's own `useEffect`:** when `open`, add `keydown` for `Escape` → `onClose`; cleanup on unmount or when `open` becomes false. Backdrop click and Cancel call `onClose`.
  - On Confirm: set internal `loading`, `await onConfirm()`, then `onClose()`. **On catch:** do **not** call `onClose`. Set internal `errorMessage` (e.g. `err instanceof Error ? err.message : "Something went wrong"`) and render it in a `role="alert"` block (e.g. below the message, `text-error`). **Announcement:** use `role="alert"` only; it implies a live region. Do not add `aria-live="assertive"` to avoid duplication. **Clear on close:** when the user clicks Cancel or backdrop, `onClose()` runs and the parent sets `open` to false; clear `errorMessage` in a `useEffect` when `open` becomes false so the next open starts clean and the error is not re-announced. Disable only Confirm while `loading`; keep Cancel enabled so the user can dismiss.
- **Styling:** `btn-primary` for confirm; when `destructive`, use `bg-error`-style. Disable buttons only while `loading`.

**Sub-step 1d:** Implement `ConfirmDialog` with inline `errorMessage` and `role="alert"` on `onConfirm` failure. It will be first used in Dashboard (step 8b).

### 5. App and Router

#### 5.1 [src/App.tsx](src/App.tsx)

- **Skip link:** Inside `Router`, before `Routes`, add `<a href="#main-content" className="skip-link">Skip to main content</a>`. The `.skip-link` and `.skip-link:focus` rules are in §2.1 (decision B). Each route’s main container should be `<main id="main-content">...</main>` so the skip link lands correctly (Landing, FAQ, Dashboard, Editor, SharePreview).

- **Auth loading:** In the `isAuthLoading` block, add an `aria-live="polite"` region with "Loading…" for screen readers (e.g. a visually hidden span or a small caption next to the spinner).

**Document titles (implementation note):** Set `"SlidesEdu"` as the default once (e.g. in `index.html` `<title>`). Each route (Landing, FAQ, Dashboard, Editor) overrides in a `useEffect` on mount. Cleanup on unmount is then optional, since the next route sets on mount; the per-route "cleanup to SlidesEdu" is equivalent but adds more moving parts.

---

## File Summary

**New:**

- `src/hooks/useFocusTrap.ts`
- `src/hooks/useScrollLock.ts`
- `src/components/Modal.tsx`
- `src/components/ConfirmDialog.tsx`

**Modified:**

- `src/index.css`
- `tailwind.config.js`
- `src/App.tsx`

---

## Dependencies and Risks

- **Export paths:** PR1 must export `Modal` from `src/components/Modal.tsx` and `ConfirmDialog` from `src/components/ConfirmDialog.tsx`. PR2 imports `Modal`; PR4 imports `ConfirmDialog`. Use consistent paths (or the project's alias) so later PRs do not need to guess.
- **`useScrollLock`:** Only one overlay (Modal or ConfirmDialog) is expected at a time. Nested modals would require a stack of stored `body.style.overflow` values; for now, the single store/restore in `useScrollLock` is sufficient.
- **`useFocusTrap` and `Modal`:** `useFocusTrap` handles only Tab cycling and focus save/restore; ESC and backdrop are handled in `Modal`/`ConfirmDialog` via their own `useEffect`. Must run only when the modal is open and when the inner content is mounted; use `innerRef` and `isActive=open`. Ensure `onClose` is stable or the effect deps are correct to avoid stale closures.
- **`prefers-reduced-motion`:** The global override is broad; if any animation is required for correctness, consider a more targeted override. The current review recommends the global rule.
- **Web Interface Guidelines:** Fetch from GitHub failed during review; re-run the guidelines check before implementation and ensure any UI-specific rules are addressed.

---

## Implementation Order

1. `useFocusTrap` (1a) — implement and verify in isolation.
2. `useScrollLock` (§1.1b) — implement before Modal.
3. `index.css` and font in `tailwind`/`:root` (1b) — `.sr-only`, `.skip-link`/`.skip-link:focus`, `prefers-reduced-motion`, font stack.
4. `Modal` (1c) — implement, wire on Landing (and optionally FAQ) as a smoke test, then run keyboard and screen-reader checks.
5. `ConfirmDialog` (1d) — implement with inline `errorMessage` and `role="alert"` on `onConfirm` failure.
6. `App.tsx` — skip link and auth-loading `aria-live`.
