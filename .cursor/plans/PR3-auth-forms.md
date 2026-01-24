# PR 3: Auth + InputForm + FileUploader

## Scope

This PR aligns Auth, InputForm, and FileUploader with the design system: removes debug code, fixes typos, adds ARIA attributes, and replaces dark theme tokens with light design tokens to match the Editor sidebar.

## Acceptance Criteria (Relevant to PR3)

- **Icon-only buttons:** All have accessible names (`aria-label` or equivalent).
- **Focus visibility:** All interactive elements show a visible focus indicator when navigated to via keyboard (Tab, etc.).

## No Visual Regression

When swapping tokens (e.g. `slate-400` → `secondary-text`), preserve equivalent contrast and size. After this PR, do a quick visual pass on the Editor to ensure InputForm and FileUploader match the light sidebar styling, and that Auth modal (when `isModal`) uses the light theme consistently.

## Verification: Test Plan (PR3)

**UI review checklist (use as PR comment template before merge):**

```
- [ ] Keyboard walkthrough: done
- [ ] Screen reader smoke: done
- [ ] Visual pass: done
```

**Keyboard-only walkthrough (PR3 subset)**

7. Editor: Tab through sidebar form (inputs, range, switch, file drop, Generate); no trap in main.

**Screen reader smoke test (PR3 subset)**

5. **Form:** Topic, Grade, Subject, Creativity, Bullets, Length, Description, Use Google Search have names or `aria-label`/`aria-describedby` where needed.

---

## Implementation Steps

### 1. Auth Component

#### 1.1 [src/components/Auth.tsx](src/components/Auth.tsx)

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

### 2. InputForm Component

#### 2.1 [src/components/InputForm.tsx](src/components/InputForm.tsx)

- **Design tokens:** Replace `text-slate-400`, `text-slate-500`, `bg-slate-800/50`, `border-white/5`, `bg-slate-600` with `text-secondary-text`, `border-border-light`, `bg-neutral-bg`, `bg-border-light` (or `neutral-bg` for tracks). Use `accent-primary` for `input[type=range]` where `accent-sky-500` is used.
- **ARIA:**
  - Description textarea (when expanded): `aria-label="Additional description (optional)"`.
  - Creativity range: `aria-valuemin={0.5}`, `aria-valuemax={0.9}`, `aria-valuenow={creativityLevel}`, `aria-label="Creativity level"`.
  - Bullets range: `aria-valuemin={3}`, `aria-valuemax={6}`, `aria-valuenow={bulletsPerSlide}`, `aria-label="Bullets per slide"`.
  - Length range: `aria-valuemin={0}`, `aria-valuemax={20}`, `aria-valuenow={numSlides}` (label already via `htmlFor="numSlides"`).
- **Description toggle:** Keep as button; ensure `focus:outline-none` doesn't remove focus ring (rely on `:focus-visible` in global CSS).

### 3. FileUploader Component

#### 3.1 [src/components/FileUploader.tsx](src/components/FileUploader.tsx)

- **Design tokens:** Replace `text-slate-300`, `text-slate-400`, `text-slate-500`, `text-slate-600`, `bg-slate-800`, `bg-slate-900/40`, `border-white/5`, `border-white/10`, `bg-slate-800` (progress), etc., with `text-primary-text`, `text-secondary-text`, `bg-neutral-bg`, `border-border-light`, `border-subtle` so it matches the light Editor sidebar. Keep `bg-[#FAFAF8]` as `bg-background` if that's the token.

---

## File Summary

**Modified:**

- `src/components/Auth.tsx`
- `src/components/InputForm.tsx`
- `src/components/FileUploader.tsx`

---

## Dependencies and Risks

- **Auth `isModal`:** Both standalone (e.g. direct route) and modal usages must be tested; `isModal` drives layout and tokens only. Ensure the light theme when `isModal` matches the design system and doesn't break standalone usage.

---

## Implementation Order

1. `Auth`: remove debug `fetch`, fix `p-4 mb-6`, `id="auth-dialog-title"` when `isModal`, light theme when `isModal`.
2. `InputForm`: ARIA on ranges and description, design tokens.
3. `FileUploader`: design tokens.
