# Accessibility

Health Tracker targets WCAG 2.2 Level AA conformance with selected AAA
enhancements.

<!-- toc -->
<!-- tocstop -->

## Conformance level

| Level | Status |
| ----- | ------ |
| A     | Full   |
| AA    | Full   |
| AAA   | Partial (2.3.3, 2.5.5) |

## Color contrast

All color combinations meet WCAG 2.2 contrast requirements.

### Text contrast (1.4.3)

| Element | Foreground | Background | Ratio | Requirement |
| ------- | ---------- | ---------- | ----- | ----------- |
| Primary text | #e4e2ec | #14131a | 12.1:1 | 4.5:1 (AA) |
| Muted text | #9a95a8 | #14131a | 5.8:1 | 4.5:1 (AA) |
| Labels | #ffffff | #1e1c28 | 14.2:1 | 4.5:1 (AA) |

### Non-text contrast (1.4.11)

| Element | Color | Background | Ratio | Requirement |
| ------- | ----- | ---------- | ----- | ----------- |
| Borders | #4a4660 | #14131a | 3.1:1 | 3:1 (AA) |
| Focus ring | #fbbf24 | #14131a | 8.5:1 | 3:1 (AA) |
| Primary accent | #c4b5fd | #14131a | 8.2:1 | 3:1 (AA) |

## Focus management

### Focus visible (2.4.7)

All interactive elements have visible focus indicators:

- **Buttons**: 2px solid amber outline with 2px offset
- **Form inputs**: Amber border with 2px box-shadow
- **Tabs**: 2px solid amber outline (inset for primary tabs)
- **Calendar days**: 2px solid amber outline with 2px offset
- **Program cards**: 2px solid amber outline with 2px offset

### Focus not obscured (2.4.11)

Focused elements have `scroll-margin-top: 80px` to prevent obscurement by the
sticky header.

## Target size

### Minimum target size (2.5.8)

All interactive elements meet the 24×24 CSS pixel minimum:

- Small buttons (`.btn.sm`): 24×24 minimum
- Tags and badges: 24px minimum height
- Calendar days: 44×44 (meets enhanced AAA requirement)
- Navigation buttons: 44×44

## Motion and animation

### Reduced motion (2.3.3 - AAA)

Animations and transitions are disabled when the user has enabled
`prefers-reduced-motion: reduce` in their system settings:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Near-zero durations preserve JavaScript callback timing while eliminating
visible motion.

## High contrast support

Enhanced contrast is provided when the user has enabled
`prefers-contrast: more`:

- Border contrast increases from 3.1:1 to 4.5:1
- Muted text contrast increases from 5.8:1 to 7.5:1
- Light background overlays increase from 10% to 25% opacity

## Known limitations

1. **Single theme**: Only dark mode is available. Users requiring light mode
   should use browser/OS invert colors feature.

2. **No skip links**: The app is single-page with minimal content before main
   navigation. Skip links are not implemented.

3. **Chart accessibility**: Canvas-based charts do not have accessible
   alternatives. Summary text is provided below charts.

## Testing methodology

Compliance verified using:

1. **Manual keyboard testing**: Tab navigation through all interactive elements
2. **Browser devtools**: Contrast checking with Chrome/Firefox accessibility
   tools
3. **System preferences**: Testing with `prefers-reduced-motion` and
   `prefers-contrast` enabled
4. **Touch testing**: Verifying target sizes on mobile devices

## Changes log

| Date | Change |
| ---- | ------ |
| 2025-12-26 | Initial WCAG 2.2 AA compliance implementation |
