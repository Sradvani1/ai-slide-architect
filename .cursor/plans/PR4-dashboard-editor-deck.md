# PR 4: Dashboard + Editor + SlideDeck + SlideCard + Icons

## Scope

This PR completes the refactor: Dashboard (sign-out button, ConfirmDialog for delete, project card keyboard/semantics), Editor (main id, document.title), SlideDeck (useNavigate, error states), SlideCard (border fix, ARIA, error states), and icon components (`...rest` for `aria-hidden`).

## Acceptance Criteria (Relevant to PR4)

- **Skip link:** Lands on the correct `#main-content` on Dashboard and Editor routes.
- **Modals:** ConfirmDialog focus trapped; ESC closes; clicking backdrop closes; focus returns to the element that opened the modal. **Scroll lock:** When ConfirmDialog is open, the page behind (body) must not scroll.
- **No `alert()` or `confirm()`:** All removed; errors show inline with `role="alert"`; confirmations use `ConfirmDialog`.
- **Icon-only buttons:** All have accessible names (`aria-label` or equivalent).
- **Document titles:** Dashboard and Editor set distinct `document.title` on mount.
- **No nested interactives:** Project cards use `Link` with Delete/Retry as siblings; no button/link inside another.
- **Focus visibility:** All interactive elements show a visible focus indicator when navigated to via keyboard (Tab, etc.).

## No Visual Regression

Spacing, typography, and layout must remain visually consistent. After this PR, verify that Dashboard project cards maintain their current appearance and behavior, and that SlideCard and SlideDeck error states are visually clear.

## Verification: Test Plan (PR4)

**UI review checklist (use as PR comment template before merge):**

```
- [ ] Keyboard walkthrough: done
- [ ] Screen reader smoke: done
- [ ] Visual pass: done
```

**Keyboard-only walkthrough (PR4 subset)**

5. Dashboard: Tab through header, "New Project", Create New card, project cards (or Link + Delete when revealed); Sign out and Delete are reachable; Enter on card Link navigates.
6. Delete: Hover/focus to reveal Delete; click opens ConfirmDialog; Tab between Cancel/Delete; ESC or Cancel closes; Confirm triggers delete; focus not trapped.
7. Editor: Tab through sidebar form (inputs, range, switch, file drop, Generate); no trap in main.
8. SlideDeck error: "Back to Dashboard" and "Retry" reachable; no trap.
9. **Scroll lock:** With ConfirmDialog open, try mouse wheel or trackpad scroll; the background must not move.

**Screen reader smoke test (PR4 subset)**

1. **Dialog:** When ConfirmDialog opens, alertdialog role and title (or `aria-labelledby`) are announced.
2. **Buttons:** "Sign out", "Delete project", "Edit content", "Edit visual idea", "Copy to clipboard" / "Copied" have sensible announcements.
4. **Alerts:** Inline errors (SlideCard, SlideDeck, ConfirmDialog on `onConfirm` failure) are in `role="alert"` and announced.

**After PR4:** Run a repo-wide grep for `alert(` and `confirm(` (e.g. `rg "alert\("` and `rg "confirm\("` in `src/`) and fix or remove any remaining usages so the acceptance criterion **No `alert()` or `confirm()`** is met.

---

## Implementation Steps

### 1. Dashboard

#### 1.1 [src/components/Dashboard.tsx](src/components/Dashboard.tsx)

**Sub-step 8a (low risk):** `main` id, `document.title`, sign-out, delete `aria-label`

- **`<main id="main-content" tabIndex={-1}>`**
- **document.title:** `useEffect` → `"SlidesEdu – Your Projects"` on mount; cleanup optional (see document titles note in PR1).
- **Sign-out:** Replace the `div` with `onClick={handleSignOut}` and `title="Click to Sign Out"` by a `<button type="button" onClick={handleSignOut} aria-label="Sign out">` with the same inner content (avatar, name, icon). Preserve layout and `group`/hover.
- **Delete button (on card):** Add `aria-label="Delete project"` (keep `title` for tooltip). Leave `handleDeleteProject` and `window.confirm` as-is for this sub-step.

**Sub-step 8b:** ConfirmDialog and delete flow

- **State:** `deleteConfirm: { projectId: string } | null`.
- **`handleDeleteProject`:** Stop calling `window.confirm`; instead `setDeleteConfirm({ projectId })`.
- **`handleConfirmDelete`:** `try { await deleteProject(user.uid, deleteConfirm.projectId); setProjects(prev => prev.filter(p => p.id !== deleteConfirm.projectId)); setDeleteConfirm(null); } catch { /* ConfirmDialog shows error inline */ }`.
- **Render:** `{deleteConfirm && <ConfirmDialog open={true} onClose={()=>setDeleteConfirm(null)} title="Delete project" message="Are you sure you want to delete this project?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={handleConfirmDelete} destructive />}`. Mount only when `deleteConfirm` is non-null so `useScrollLock` and `useFocusTrap` run only while the dialog is on-screen (see PR1). Use `open={true}` explicitly to satisfy `open: boolean` and avoid lint/style churn.
- **Verify:** Delete still works; on `deleteProject` failure, error appears inside the dialog and user can Cancel to close.

**Sub-step 8c:** Project cards — `Link` and sibling Delete / Failed

- Refactor so the clickable card is a `Link` to `/project/${project.id}` and the Delete button is a **sibling** (not inside the `Link`). Use a wrapper `div` with `relative` and `group/card`; `Link` gets the card layout and content (title, badges, metadata); Delete `button` is `absolute top-2 right-2 z-10` with `opacity-0 group-hover/card:opacity-100`. When `project.status === 'generating'`, render a `div` with the same visual and `aria-busy` (no `Link`, no Delete). When `project.status === 'failed'`, keep the "Failed" + Retry overlay: render it as a **sibling** to the `Link` (absolute top-left) so the Retry button is not inside the `Link`. Retry `onClick`: `e.stopPropagation(); navigate(\`/project/${project.id}\`);`.
- Extract the shared card body (title, badges, metadata, and when generating: overlay, ping, etc.) into a variable or small helper to avoid duplication between `Link` and `div` branches.
- **Verify:** Card click and keyboard (Enter on `Link`) navigate; Delete and Retry work; no nested interactives.

**Sub-step 8d:** Create New card

- Replace `div` + `onClick={() => navigate('/new')}` with `<Link to="/new">` and the same inner content and styling.

### 2. Editor

#### 2.1 [src/components/Editor.tsx](src/components/Editor.tsx)

- **`<main id="main-content" tabIndex={-1}>`** on the main content `main` (the one that wraps `SlideDeck`).
- **document.title:** `useEffect` depending on `topic` and `useLocation().pathname`: when path is `/new` or `/project/:id`, set `document.title = \`SlidesEdu – ${topic || 'New Project'}\`` on mount; cleanup optional (see document titles note in PR1). Dependencies: `[topic, pathname]`.

### 3. SlideDeck

#### 3.1 [src/components/SlideDeck.tsx](src/components/SlideDeck.tsx)

- **`useNavigate`:** Add `const navigate = useNavigate()` and replace `window.location.href = '/'` in the error view's "Back to Dashboard" with `navigate('/')`.
- **Export/Notes/Images errors:** Add state, e.g. `exportError: string | null` (or separate `pptError`, `notesError`, `imagesError`). In `handleExportPPTX`, `handleDownloadNotes`, `handleDownloadAllImages`: in `catch`, set the corresponding error instead of `alert(...)`. In the main UI (toolbar or above the deck), render an inline `role="alert"` message with the error and a "Dismiss" or "Retry" that clears the error and optionally retries. Use design tokens for error (`text-error`, `border-error`).

### 4. SlideCard

#### 4.1 [src/components/SlideCard.tsx](src/components/SlideCard.tsx)

- **Invalid class:** `border-[#rgba(0,0,0,0.08)]` → `border-subtle` or `border-[rgba(0,0,0,0.08)]`.
- **CopyButton:** `aria-label={copied ? 'Copied' : 'Copy to clipboard'}` on the `button`.
- **Generated image `img`:** `alt="Generated"` → `alt={\`Generated image for slide: ${slide.title}\`}` (or similar).
- **Pencil (Edit) button:** Ensure touch target ≥ 44×44: e.g. `min-w-[44px] min-h-[44px]` and `p-2` or `p-3`; same for the Edit Visual Idea button.
- **Replace `alert` with in-UI error:**
  - State: `imageError: string | null`, `promptError: string | null`.
  - In `handleGenerateImage` and `handleGeneratePrompt` / `handleRetryPromptGeneration`: in `catch`, set the corresponding error and clear it after a few seconds or on next action. Remove `alert(...)`.
  - In the card footer (near the visual-idea block or under the main content), render a `role="alert"` `div` when `imageError` or `promptError` is set, with the message and a Dismiss/close. Use `text-error`/`border-error`.

### 5. Icons and Icon-only Buttons

#### 5.1 [src/components/icons.tsx](src/components/icons.tsx)

- For each icon component, add `...rest` to props and spread onto the root `<svg>`, e.g. `function CopyIcon({ className, ...rest }) { return <svg ... {...rest} /> }`, so parents can pass `aria-hidden="true"` where the icon is decorative.

#### 5.2 Icon-only buttons in SlideCard

- **SlideCard:** Edit Content `button` (PencilIcon): add `aria-label="Edit content"`. Edit Visual Idea `button`: add `aria-label="Edit visual idea"`. CopyButton already handled above.

---

## File Summary

**Modified:**

- `src/components/Dashboard.tsx`
- `src/components/Editor.tsx`
- `src/components/SlideDeck.tsx`
- `src/components/SlideCard.tsx`
- `src/components/icons.tsx`

**Dependencies:**

- PR1 must be merged first (provides `ConfirmDialog` component).

---

## Dependencies and Risks

- **ConfirmDialog import:** Import `ConfirmDialog` from `src/components/ConfirmDialog` (or the project's alias) as established in PR1.
- **Dashboard card `Link` vs `div`:** The failed overlay and Delete must stay outside the `Link` to avoid nested interactives. Layout (overlays, `group/card`) must match current behavior.
- **Conditional mount:** Render ConfirmDialog only when `deleteConfirm` is non-null (e.g. `{deleteConfirm && <ConfirmDialog open={true} ... />}`) so `useScrollLock` and `useFocusTrap` run only while the dialog is on-screen.

---

## Implementation Order

1. Dashboard (8a–8d): `main` id, `document.title`, sign-out `button`, delete `aria-label` (8a); `ConfirmDialog` and delete flow (8b); project card `Link`/sibling Delete and Failed overlay (8c); Create New `Link` (8d).
2. Editor: `main` id, `document.title` from `topic` and pathname.
3. SlideDeck: `useNavigate` for Back, export/notes/images error state and `role="alert"`.
4. SlideCard: border fix, CopyButton `aria-label`, image `alt`, Pencil 44×44, `imageError`/`promptError` and `role="alert"`.
5. Icons: `icons` `...rest`; SlideCard Edit `aria-label`s.

**After PR4:** Run a repo-wide grep for `alert(` and `confirm(` (e.g. `rg "alert\("` and `rg "confirm\("` in `src/`) and fix or remove any remaining usages so the acceptance criterion **No `alert()` or `confirm()`** is met.
