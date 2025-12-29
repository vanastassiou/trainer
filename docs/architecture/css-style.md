# CSS style guide

This document defines CSS conventions for the Health Tracker PWA.

<!-- toc -->

- [Cascade layers](#cascade-layers)
- [Design tokens](#design-tokens)
- [Typography](#typography)
- [Component patterns](#component-patterns)
- [Accessibility requirements](#accessibility-requirements)
- [Naming conventions](#naming-conventions)

<!-- tocstop -->

## Cascade layers

CSS is organized into cascade layers for explicit specificity management:

```css
@layer reset, tokens, base, components, utilities, overrides;
```

| Layer        | Purpose                                    |
| ------------ | ------------------------------------------ |
| `reset`      | Box-sizing, margin/padding reset           |
| `tokens`     | `:root` custom properties, `@property`     |
| `base`       | Element defaults (body, focus)             |
| `components` | All component styles                       |
| `utilities`  | Helper classes (.hidden, .row, .page)      |
| `overrides`  | Accessibility media queries                |

Layers eliminate specificity wars and make overrides predictable. Later layers
take precedence over earlier ones regardless of selector specificity.

## Design tokens

All design values are defined as CSS custom properties in `:root`. Use these
variables instead of hardcoded values.

### Colors

| Variable                  | Value                          | Usage                    |
| ------------------------- | ------------------------------ | ------------------------ |
| `--color-bg`              | `#14131a`                      | Page background          |
| `--color-surface`         | `#1e1c28`                      | Cards, inputs, elevated  |
| `--color-primary`         | `#c4b5fd`                      | Primary accent (purple)  |
| `--color-secondary`       | `#fbbf24`                      | Secondary accent (amber) |
| `--color-tertiary`        | `#f9a8d4`                      | Tertiary accent (pink)   |
| `--color-text`            | `#e4e2ec`                      | Primary text             |
| `--color-text-muted`      | `#9a95a8`                      | Secondary text           |
| `--color-border`          | `#4a4660`                      | Borders, dividers        |
| `--color-danger`          | `#f87171`                      | Error states             |
| `--color-success`         | `#34d399`                      | Success states           |

Each color has `-hover` and `-light` variants for interactive states.

### Spacing

| Variable         | Value  | Usage                           |
| ---------------- | ------ | ------------------------------- |
| `--spacing-xs`   | `4px`  | Tight spacing (icon padding)    |
| `--spacing-sm`   | `6px`  | Small gaps                      |
| `--spacing-md`   | `8px`  | Default component gaps          |
| `--spacing-lg`   | `12px` | Section spacing                 |
| `--spacing-xl`   | `16px` | Card padding, larger gaps       |
| `--spacing-2xl`  | `24px` | Major section separation        |
| `--gap-grid`     | `12px` | Grid column gaps                |
| `--gap-tight`    | `2px`  | Tight gaps (tag lists)          |
| `--input-padding`| `10px 12px` | Standard input padding     |

### Border radius

| Variable       | Value | Usage                    |
| -------------- | ----- | ------------------------ |
| `--radius-xs`  | `3px` | Tiny elements, badges    |
| `--radius-sm`  | `4px` | Small elements, tags     |
| `--radius`     | `6px` | Default (buttons, cards) |
| `--radius-md`  | `8px` | Medium elements          |
| `--radius-lg`  | `12px`| Large cards, modals      |

### Z-index layers

| Variable      | Value | Usage                          |
| ------------- | ----- | ------------------------------ |
| `--z-header`  | `100` | Sticky header                  |
| `--z-modal`   | `200` | Modal dialogs                  |
| `--z-toast`   | `300` | Toast notifications            |

### Transitions

| Variable               | Value           | Usage                      |
| ---------------------- | --------------- | -------------------------- |
| `--transition-fast`    | `0.15s ease`    | Hover states               |
| `--transition-normal`  | `0.2s ease-out` | Larger transitions         |
| `--transition-slow`    | `0.3s ease`     | Progress bars, animations  |

### Font sizes

| Variable           | Value  | Usage                          |
| ------------------ | ------ | ------------------------------ |
| `--font-size-lg`   | `16px` | Larger body text               |
| `--font-size-xl`   | `18px` | Section headers                |
| `--font-size-2xl`  | `24px` | Page titles                    |

### Opacity

| Variable              | Value | Usage                         |
| --------------------- | ----- | ----------------------------- |
| `--opacity-inactive`  | `0.4` | Inactive icons, muted states  |

### Focus ring

| Variable          | Value                              | Usage              |
| ----------------- | ---------------------------------- | ------------------ |
| `--focus-ring`    | `2px solid var(--color-secondary)` | Focus outline      |
| `--focus-offset`  | `2px`                              | Outline offset     |

### Typed custom properties

Colors are defined with `@property` for animation support:

```css
@property --color-primary {
  syntax: '<color>';
  inherits: true;
  initial-value: #c4b5fd;
}
```

This enables smooth color transitions and provides type safety. Browsers without
`@property` support fall back to standard custom property behavior.

---

## Typography

### Header hierarchy

Semantic HTML headers (h1-h3) are styled in `@layer base` with a clear visual
hierarchy:

| Level | Size | Weight | Color     | Spacing           | Extras        |
| ----- | ---- | ------ | --------- | ----------------- | ------------- |
| h1    | 20px | 700    | amber     | 0 0 12px 0        | bottom border |
| h2    | 16px | 600    | purple    | 16px 0 8px 0      | -             |
| h3    | 14px | 500    | text      | 0 0 6px 0         | -             |

Notes:
- h2 has `margin-top: 16px` for spacing between sections (reset to 0 for
  `:first-child`)
- h1 border is removed in `.profile-section` where section borders exist

Design decisions:

- **Semantic HTML over styled divs**: Use `<h1>`, `<h2>`, `<h3>` elements for
  accessibility and document structure, not `<div>` or `<span>` with heading
  classes
- **Color differentiation**: Each level uses a distinct color (amber → purple →
  text) to reinforce hierarchy without relying solely on size
- **h1 border**: Bottom border on h1 provides visual separation for major
  sections
- **Component overrides**: Modal headers retain amber color for prominence in
  dialog contexts

### Contextual overrides

Some components override base header styles for specific contexts:

| Selector             | Override                    | Reason                      |
| -------------------- | --------------------------- | --------------------------- |
| `.profile-section h1`| no border                   | Section borders exist       |
| `.modal-header h3`   | 16px, amber                 | Modal titles need emphasis  |
| `.profile-section h4`| 13px, muted, uppercase      | Subsection labels           |
| `.field-group-label` | spacing only                | Section dividers in forms   |

Prefer semantic class names (`.field-group-label`) over presentational names
(`.label-muted`) for structural elements.

---

## Component patterns

### Buttons

Base class: `.btn`

```css
.btn {
  padding: 10px 14px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}
```

Variants:

| Class             | Purpose                              |
| ----------------- | ------------------------------------ |
| `.btn.accent`     | Primary action (amber background)    |
| `.btn.outline-accent` | Secondary action (amber border)  |
| `.btn.danger`     | Destructive action (red)             |
| `.btn.ghost`      | Tertiary action (subtle)             |
| `.btn.sm`         | Smaller size (min 24x24)             |
| `.btn.full`       | Full width                           |

### Cards

Base class: `.card`

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--spacing-xl);
}
```

Modifiers:

| Class            | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `.card--inset`   | Darker background for nesting              |
| `.card--compact` | Reduced padding (`--spacing-lg`)           |
| `.card--active`  | Highlighted border state                   |

### Forms

Structure:

```html
<form>
  <div class="form-group">
    <label>Label</label>
    <input type="text">
  </div>
  <div class="form-buttons">
    <button class="btn accent">Save</button>
  </div>
</form>
```

Forms use flexbox with `gap: var(--spacing-xl)` between groups.

### Tabs

Primary tabs (`.tab`): Full-width navigation with bottom border indicator.

Sub-tabs (`.sub-tab`): Segmented control style with border around active item.

---

## Accessibility requirements

### Focus states

All interactive elements must have visible focus indicators using the focus
ring tokens:

```css
.btn:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* Form inputs also support focus-visible */
input:focus-visible,
select:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}
```

Use `scroll-margin-top: 80px` on focusable elements to prevent sticky header
from obscuring focused content (WCAG 2.4.11).

### Touch targets

Minimum sizes per WCAG 2.5.8:

| Element          | Minimum size |
| ---------------- | ------------ |
| `.btn.sm`        | 24x24px      |
| `.calendar-day`  | 44x44px      |
| `.exercise-tag`  | 24px height  |

### Reduced motion

Respect user preference:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Use `0.01ms` instead of `0` to preserve JavaScript timing callbacks.

### High contrast

Support increased contrast preference:

```css
@media (prefers-contrast: more) {
  :root {
    --color-border: #6a6680;
    --color-text-muted: #b5b0c0;
  }
}
```

### Color contrast ratios

| Element      | Ratio  | WCAG level |
| ------------ | ------ | ---------- |
| Primary text | 12.1:1 | AAA        |
| Muted text   | 5.8:1  | AA         |
| Borders      | 3.1:1  | AA         |

---

## Naming conventions

### BEM-like modifiers

Use double-dash for modifiers on base classes:

```css
.card { }
.card--compact { }
.card--active { }
```

### Utility classes

Reusable layout utilities defined in `@layer utilities`:

| Class          | Purpose                                       |
| -------------- | --------------------------------------------- |
| `.hidden`      | `display: none !important`                    |
| `.page`        | Page visibility control                       |
| `.row`         | Flex row with `gap: var(--spacing-md)`        |
| `.row--gap-sm` | Row with `--spacing-sm` gap                   |
| `.row--gap-lg` | Row with `--spacing-lg` gap                   |
| `.data-row`    | Form field row with `gap: var(--spacing-md)`  |
| `.label-muted` | Muted uppercase text styling                  |
| `.icon-btn`    | Transparent button with hover opacity         |
| `.modal-body`  | Modal content with padding and scroll         |

### Color classes

Semantic color utilities:

| Class          | Purpose                |
| -------------- | ---------------------- |
| `.text-danger` | Error/warning text     |
| `.color-*`     | Apply theme colors     |

### Logical properties

Use logical properties for RTL support:

```css
/* Preferred */
margin-inline-start: 4px;
padding-block: 8px;

/* Avoid when possible */
margin-left: 4px;
padding-top: 8px;
```

### CSS nesting

Use native CSS nesting for component variants to improve readability:

```css
.btn {
  /* base styles */

  &:hover {
    /* hover state */
  }

  &.accent {
    /* variant styles */

    &:hover {
      /* variant hover */
    }
  }
}
```

### Container queries

Use container queries for component-scoped responsive layouts:

```css
/* Parent establishes containment context */
.stats-container {
  container-type: inline-size;
}

/* Child responds to container width, not viewport */
@container (min-width: 400px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

Container queries are preferred over media queries when the component's layout
should respond to its available space rather than viewport dimensions.
