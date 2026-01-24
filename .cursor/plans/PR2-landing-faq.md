# PR 2: Landing + FAQ

## Scope

This PR updates the landing and FAQ pages: adds semantic navigation, main content IDs for skip link, document titles, switches to the new Modal component for Auth, adds FAQ accordion ARIA, and marks decorative SVGs as `aria-hidden`.

## Acceptance Criteria (Relevant to PR2)

- **Skip link:** Lands on the correct `#main-content` on Landing and FAQ routes.
- **Modals:** Focus trapped inside; ESC closes; clicking backdrop closes; focus returns to the element that opened the modal. **Scroll lock:** When Modal is open, the page behind (body) must not scroll.
- **Icon-only buttons:** All have accessible names (`aria-label` or equivalent).
- **Document titles:** Landing and FAQ set distinct `document.title` on mount.

## No Visual Regression

Spacing, typography, and layout must remain visually consistent. After this PR, verify that the Modal matches the current modal styling and that the FAQ accordion behavior is unchanged.

## Verification: Test Plan (PR2)

**UI review checklist (use as PR comment template before merge):**

```
- [ ] Keyboard walkthrough: done
- [ ] Screen reader smoke: done
- [ ] Visual pass: done
```

**Keyboard-only walkthrough (PR2 subset)**

1. Tab from load: first focusable is Skip link; activating it moves focus to `#main-content`.
2. On Landing/FAQ: Tab through Header (Logo, FAQ, Sign In); no focus traps; focus ring visible on all.
3. Open Auth modal (Sign In): focus moves into dialog; Tab cycles only Close and "Sign in with Google"; Shift+Tab ditto; ESC closes and focus returns to Sign In.
4. FAQ: Tab to an FAQ button; Enter/Space toggles; `aria-expanded` reflects state.
5. **Scroll lock:** With Auth modal open, try mouse wheel or trackpad scroll; the background must not move.

**Screen reader smoke test (PR2 subset)**

1. **Dialog:** When Auth modal opens, dialog role and title (or `aria-labelledby`) are announced.
2. **Buttons:** "Sign in with Google" and "Close modal" have sensible announcements.
3. **FAQ:** Expand/collapse announces expanded/collapsed.

---

## Implementation Steps

### 1. Header Navigation

#### 1.1 [src/components/landing/Header.tsx](src/components/landing/Header.tsx)

- Wrap the `div` that contains the Logo, FAQ `Link`, and Sign In `button` in `<nav aria-label="Main navigation">`.

### 2. Landing Page

#### 2.1 [src/components/LandingPage.tsx](src/components/LandingPage.tsx)

- **`<main id="main-content" tabIndex={-1}>`** so the skip target is focusable.
- **Auth modal:** Replace the custom modal `div`/backdrop/close with `<Modal open={showAuthModal} onClose={handleCloseModal} ariaLabelledby="auth-dialog-title">` and render `<Auth isModal />` as child. Remove the inline close button (Modal provides it).
- **Conditional render:** Change `{showAuthModal && (...)}` to `{showAuthModal ? <Modal ...><Auth isModal /></Modal> : null}`.
- **document.title:** `useEffect` that sets `document.title = "SlidesEdu – Create Classroom Slides"` on mount; cleanup optional (see document titles note in PR1).

### 3. FAQ Page

#### 3.1 [src/components/landing/FAQ.tsx](src/components/landing/FAQ.tsx)

- **`<main id="main-content" tabIndex={-1}>`**
- **document.title:** `useEffect` → `"SlidesEdu – FAQ"` on mount; cleanup optional (see document titles note in PR1).
- **Auth modal:** Same as Landing: use `Modal`, `{showAuthModal ? <Modal ...><Auth isModal /></Modal> : null}`. Modal's close gets `aria-label="Close modal"` (in Modal itself).

#### 3.2 `FAQItem` in [src/components/landing/FAQ.tsx](src/components/landing/FAQ.tsx)

- Use `useId()` to generate `id` for question and answer.
- **Button:** `aria-expanded={isOpen}`, `aria-controls={answerId}`, `id={questionId}`.
- **Answer `div`:** `id={answerId}`, `role="region"`, `aria-labelledby={questionId}`.

### 4. Decorative SVGs

#### 4.1 [src/components/landing/Features.tsx](src/components/landing/Features.tsx)

- Add `aria-hidden="true"` to each feature's `svg`.

#### 4.2 [src/components/landing/HowItWorks.tsx](src/components/landing/HowItWorks.tsx)

- Add `aria-hidden="true"` to the step number circle's container if it's purely decorative, or to any decorative `svg`; the number `{step.number}` can stay.

#### 4.3 [src/components/landing/UseCases.tsx](src/components/landing/UseCases.tsx)

- Add `aria-hidden="true"` to the checkmark `svg` in each list item (the text carries the meaning).

---

## File Summary

**Modified:**

- `src/components/landing/Header.tsx`
- `src/components/LandingPage.tsx`
- `src/components/landing/FAQ.tsx`
- `src/components/landing/Features.tsx`
- `src/components/landing/HowItWorks.tsx`
- `src/components/landing/UseCases.tsx`

**Dependencies:**

- PR1 must be merged first (provides `Modal` component).

---

## Dependencies and Risks

- **Modal import:** Import `Modal` from `src/components/Modal` (or the project's alias) as established in PR1.
- **Conditional mount:** Render Modal only when `showAuthModal` is true (e.g. `{showAuthModal ? <Modal ...> : null}`) so `useScrollLock` and `useFocusTrap` run only while the dialog is on-screen.

---

## Implementation Order

1. Header: add `<nav aria-label="Main navigation">`.
2. LandingPage: `main` id, `document.title`, switch to `Modal` for Auth, conditional render.
3. FAQ: `main` id, `document.title`, `Modal` for Auth; `FAQItem` `aria-expanded`/`aria-controls`/`aria-labelledby`.
4. Decorative SVGs: `Features`, `HowItWorks`, `UseCases` — add `aria-hidden="true"` to the decorative `svg`s.
