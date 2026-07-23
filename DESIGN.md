# After School Club CMS — Design System

## Token Vocabularies

We have standardized the design tokens to eliminate `!important` overrides while maintaining the Apple HIG aesthetic and shadcn integration.

### Core Variables (`globals.css`)
- `--background`, `--foreground`: Base canvas and text colors.
- `--card`, `--card-foreground`: Elevated surface tokens.
- `--primary`, `--primary-foreground`: Apple Store Blue (WCAG AA compliant).
- `--secondary`, `--muted`: Subtle surfaces and muted text (Apple Secondary Label).
- `--border`, `--input-bg`: UI outlines and inputs.

### Semantic Status Tokens
- `--color-success` (`#30d158`): Apple System Green.
- `--color-warning` (`#ff9f0a`): Apple System Amber.
- `--color-info` (`#0a84ff`): Apple System Blue.
- `--color-error` (`#ff716c`): High contrast red.
- `--color-tertiary` (`#b8ffbb`): Present/Attendance success identifier.

### Primitives
We have consolidated standard UI components into `src/components/ui/` to enforce styling without global overrides.

- `<Button variant="primary | secondary | ghost | destructive" />`: Pre-styled buttons with correct scale animations and paddings.
- `<Badge variant="default | success | warning | error | info" />`: Pill-shaped semantic tags.
- `<EmptyState />`: Consistent layout for empty states across the application.
- `<Field />`: Semantic wrapping for inputs to render consistent labels and errors.

### Deprecated Patterns
- **Do not** use `text-slate-400`, `text-gray-500`, etc. Rely on `text-muted-foreground` and `text-foreground`.
- **Do not** use `!important` in CSS. Overrides should be done using standard Tailwind component-level classes (e.g. `@layer components`).
