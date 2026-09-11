import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * UX-F1 — Form control readability regression tests
 *
 * Environment: vitest/node (no DOM). Tests read source files directly to
 * verify that the dangerous text-white pattern is absent from form controls
 * that render on light card backgrounds, and that the required CSS tokens
 * are defined in globals.css.
 *
 * See: project-notes/post-modernisation/ux-f1-global-form-readability.md
 */

const SRC = path.resolve(__dirname, '../../../../');

function readSrc(relative: string): string {
  return fs.readFileSync(path.resolve(SRC, relative), 'utf-8');
}

describe('UX-F1 — Form control readability regression tests', () => {

  // ─── Shared component source checks ──────────────────────────────────────

  it('Input component does not use text-white (uses text-text instead)', () => {
    const src = readSrc('src/components/ui/Input.tsx');
    expect(src).not.toContain('text-white');
    expect(src).toContain('text-text');
    expect(src).toContain('bg-surface');
  });

  it('Textarea component does not use text-white (uses text-text instead)', () => {
    const src = readSrc('src/components/ui/Textarea.tsx');
    expect(src).not.toContain('text-white');
    expect(src).toContain('text-text');
    expect(src).toContain('bg-surface');
  });

  it('Input component has displayName "Input"', () => {
    const src = readSrc('src/components/ui/Input.tsx');
    expect(src).toContain("Input.displayName = 'Input'");
  });

  it('Textarea component has displayName "Textarea"', () => {
    const src = readSrc('src/components/ui/Textarea.tsx');
    expect(src).toContain("Textarea.displayName = 'Textarea'");
  });

  // ─── Route-specific input checks ─────────────────────────────────────────

  it('OnboardingForm does not use text-white on native input elements', () => {
    const src = readSrc('src/features/onboarding/components/OnboardingForm.tsx');
    const inputLines = src.split('\n').filter(line =>
      line.includes('<input') && line.includes('className')
    );
    for (const line of inputLines) {
      expect(line, `Input line should not have text-white: ${line.trim()}`).not.toContain('text-white');
    }
  });

  it('OnboardingForm does not use undefined text-on-surface-variant on labels or headings', () => {
    const src = readSrc('src/features/onboarding/components/OnboardingForm.tsx');
    // text-on-surface-variant was undefined; should be replaced with text-muted-foreground
    // Exception: placeholder:text-on-surface-variant/50 is still present — that uses the
    // now-defined --on-surface-variant CSS variable so it's acceptable.
    const labelLines = src.split('\n').filter(line =>
      (line.includes('<label') || line.includes('<h2') || line.includes('<h3')) &&
      line.includes('text-on-surface-variant')
    );
    expect(labelLines).toHaveLength(0);
  });

  it('signup page inputs do not use text-white on native input elements', () => {
    const src = readSrc('src/app/signup/page.tsx');
    const inputLines = src.split('\n').filter(line =>
      line.includes('<input') && line.includes('className') && line.includes('bg-secondary')
    );
    for (const line of inputLines) {
      expect(line, `Input line should not have text-white: ${line.trim()}`).not.toContain('text-white');
    }
  });

  it('AddMedicalNoteForm textarea does not use text-white', () => {
    const src = readSrc('src/features/portal/components/AddMedicalNoteForm.tsx');
    const textareaLines = src.split('\n').filter(line =>
      line.includes('<textarea') && line.includes('className')
    );
    for (const line of textareaLines) {
      expect(line, `Textarea line should not have text-white: ${line.trim()}`).not.toContain('text-white');
    }
  });

  it('AlertModal does not use text-white on its title h3 or bg-secondary/80 button', () => {
    const src = readSrc('src/components/ui/AlertModal.tsx');
    const h3Lines = src.split('\n').filter(line => line.includes('<h3') && line.includes('text-white'));
    expect(h3Lines, 'AlertModal h3 should not use text-white').toHaveLength(0);
    const buttonLines = src.split('\n').filter(line =>
      line.includes('bg-secondary') && line.includes('text-white')
    );
    expect(buttonLines, 'AlertModal bg-secondary button should not use text-white').toHaveLength(0);
  });

  it('ConfirmModal does not use text-white on its title or cancel button', () => {
    const src = readSrc('src/components/ui/ConfirmModal.tsx');
    const h3Lines = src.split('\n').filter(line => line.includes('<h3') && line.includes('text-white'));
    expect(h3Lines, 'ConfirmModal h3 should not use text-white').toHaveLength(0);
    // Cancel button uses bg-secondary/80 — should now use text-foreground
    const cancelLines = src.split('\n').filter(line =>
      line.includes('bg-secondary') && line.includes('text-white')
    );
    expect(cancelLines, 'ConfirmModal cancel button should not use text-white').toHaveLength(0);
  });

  it('CommunicationsClient subject input has explicit text-foreground class', () => {
    const src = readSrc('src/app/dashboard/communications/CommunicationsClient.tsx');
    const subjectSection = src.split('\n')
      .filter(line => line.includes('bg-card border border-border rounded-xl'));
    const hasTextForeground = subjectSection.some(line => line.includes('text-foreground'));
    expect(hasTextForeground).toBe(true);
  });

  it('portal login email input has text-foreground class', () => {
    const src = readSrc('src/app/portal/login/page.tsx');
    const inputLines = src.split('\n').filter(line =>
      line.includes('<input') || (line.includes('className') && line.includes('border-outline-variant'))
    );
    const hasTextForeground = inputLines.some(line => line.includes('text-foreground'));
    expect(hasTextForeground, 'Portal login input should have text-foreground').toBe(true);
  });

  // ─── CSS token checks ─────────────────────────────────────────────────────

  it('globals.css defines --on-surface-variant token in the light :root block', () => {
    const src = readSrc('src/app/globals.css');
    expect(src).toContain('--on-surface-variant');
    // Should appear at least 4 times (light :root, dark media, dark class, light class)
    const occurrences = (src.match(/--on-surface-variant/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });

  it('globals.css registers --color-on-surface-variant in the @theme inline block', () => {
    const src = readSrc('src/app/globals.css');
    expect(src).toContain('--color-on-surface-variant');
  });

  it('globals.css has webkit-autofill override', () => {
    const src = readSrc('src/app/globals.css');
    expect(src).toContain(':-webkit-autofill');
    expect(src).toContain('-webkit-text-fill-color');
    expect(src).toContain('-webkit-box-shadow');
  });

  it('StatusUpdater button does not use text-white on bg-secondary/40', () => {
    const src = readSrc('src/app/dashboard/registrations/[id]/StatusUpdater.tsx');
    const buttonLines = src.split('\n').filter(line =>
      line.includes('bg-secondary') && line.includes('text-white')
    );
    expect(buttonLines, 'StatusUpdater button should not use text-white on bg-secondary').toHaveLength(0);
  });

  // ─── Post-Modernisation UI Contrast Invariants (PM-UI-REG-1) ───────────────

  it('signup page container establishes an explicit dark scope and color-scheme', () => {
    const src = readSrc('src/app/signup/page.tsx');
    expect(src).toContain('grid md:grid-cols-2 dark');
    expect(src).toContain("colorScheme: 'dark'");
  });

  it('signup page inputs do not use compounded opacity on placeholders', () => {
    const src = readSrc('src/app/signup/page.tsx');
    const inputLines = src.split('\n').filter(line =>
      line.includes('<input') && line.includes('className') && line.includes('bg-secondary')
    );
    for (const line of inputLines) {
      expect(line).not.toContain('placeholder:text-on-surface-variant/50');
      expect(line).toContain('placeholder:text-muted-foreground');
    }
  });

  it('globals.css input::placeholder does not dilute token contrast with opacity: 0.6', () => {
    const src = readSrc('src/app/globals.css');
    // The placeholder rule must define opacity: 1 so calibrated --muted-foreground tokens are not degraded
    expect(src).toMatch(/input::placeholder,\s*textarea::placeholder\s*\{[^}]*opacity:\s*1;/);
  });

  it('globals.css :-webkit-autofill override specifies caret-color', () => {
    const src = readSrc('src/app/globals.css');
    expect(src).toContain('caret-color: hsl(var(--foreground))');
  });

  it('globals.css wraps input base defaults in @layer base and :where() to eliminate cascade override', () => {
    const src = readSrc('src/app/globals.css');
    // Base input defaults must be wrapped in @layer base and :where() so utility classes (bg-white, bg-secondary, etc.) always win
    expect(src).toContain('@layer base');
    expect(src).toMatch(/@layer base\s*\{[\s\S]*?:where\([\s\S]*?input\[type="text"\]/);
  });

  it('login page inputs maintain clean white surface and calibrated placeholder', () => {
    const src = readSrc('src/app/login/page.tsx');
    expect(src).toContain('bg-white border border-slate-200 text-slate-900 placeholder:text-slate-500');
  });

  it('staff-login page email input uses placeholder:text-white/60 to satisfy >= 4.5:1 contrast invariant', () => {
    const src = readSrc('src/app/staff-login/page.tsx');
    expect(src).not.toContain('placeholder-white/30');
    expect(src).toContain('placeholder:text-white/60');
  });

  // ─── WCAG 2.1 AA Contrast Verification Math ───────────────────────────────

  it('Staff-login glass field contrast invariants meet WCAG 2.1 AA normal text (placeholder >= 4.5:1)', () => {
    function sRGBtoLin(c: number) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function lum(r: number, g: number, b: number) {
      return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
    }
    function contrast(l1: number, l2: number) {
      const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (bright + 0.05) / (dark + 0.05);
    }

    // Staff login card: bg-white/10 over gradient (slate-950 to slate-900)
    // Input surface: bg-white/5 over card
    // 1. Over slate-950 [2, 6, 23]
    const card950 = [2 * 0.9 + 25.5, 6 * 0.9 + 25.5, 23 * 0.9 + 25.5];
    const input950 = [card950[0] * 0.95 + 12.75, card950[1] * 0.95 + 12.75, card950[2] * 0.95 + 12.75];
    const lumInput950 = lum(input950[0], input950[1], input950[2]);

    // 2. Over slate-900 [15, 23, 42]
    const card900 = [15 * 0.9 + 25.5, 23 * 0.9 + 25.5, 42 * 0.9 + 25.5];
    const input900 = [card900[0] * 0.95 + 12.75, card900[1] * 0.95 + 12.75, card900[2] * 0.95 + 12.75];
    const lumInput900 = lum(input900[0], input900[1], input900[2]);

    // Placeholder text at 60% white (placeholder:text-white/60)
    const text950 = [input950[0] * 0.4 + 255 * 0.6, input950[1] * 0.4 + 255 * 0.6, input950[2] * 0.4 + 255 * 0.6];
    const lumText950 = lum(text950[0], text950[1], text950[2]);
    const cr950 = contrast(lumText950, lumInput950);

    const text900 = [input900[0] * 0.4 + 255 * 0.6, input900[1] * 0.4 + 255 * 0.6, input900[2] * 0.4 + 255 * 0.6];
    const lumText900 = lum(text900[0], text900[1], text900[2]);
    const cr900 = contrast(lumText900, lumInput900);

    // Both ends of the gradient must satisfy normal text contrast >= 4.5:1
    expect(cr950).toBeGreaterThanOrEqual(4.5); // Actual: ~6.12:1
    expect(cr900).toBeGreaterThanOrEqual(4.5); // Actual: ~5.33:1
  });

  it('Dark field contrast invariants meet WCAG 2.1 AA (text >= 4.5:1, placeholder >= 4.5:1)', () => {
    function sRGBtoLin(c: number) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function lum(r: number, g: number, b: number) {
      return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
    }
    function contrast(l1: number, l2: number) {
      const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (bright + 0.05) / (dark + 0.05);
    }

    // Dark field background: #1e1e24 (--secondary in dark mode)
    const lDarkBg = lum(30, 30, 36);
    // Dark field text: #f5f5f7 (--foreground in dark mode)
    const lDarkText = lum(245, 245, 247);
    // Dark field placeholder: #86868b (--muted-foreground in dark mode, opacity: 1)
    const lDarkPlaceholder = lum(134, 134, 139);

    const textContrast = contrast(lDarkText, lDarkBg);
    const placeholderContrast = contrast(lDarkPlaceholder, lDarkBg);

    expect(textContrast).toBeGreaterThanOrEqual(4.5); // Required: >= 4.5:1
    expect(textContrast).toBeGreaterThan(14.0);       // Actual: ~15.2:1
    expect(placeholderContrast).toBeGreaterThanOrEqual(4.5); // Required: >= 4.5:1 (Actual: ~4.58:1)
  });

  it('Light field contrast invariants meet WCAG 2.1 AA (text >= 4.5:1, placeholder >= 4.5:1)', () => {
    function sRGBtoLin(c: number) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function lum(r: number, g: number, b: number) {
      return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
    }
    function contrast(l1: number, l2: number) {
      const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (bright + 0.05) / (dark + 0.05);
    }

    // Light field background: #ffffff (--card / pure white input)
    const lLightBg = lum(255, 255, 255);
    // Light field text: #1d1d1f (--foreground in light mode)
    const lLightText = lum(29, 29, 31);
    // Light field placeholder: #636366 (--muted-foreground in light mode, opacity: 1)
    const lLightPlaceholder = lum(99, 99, 102);

    const textContrast = contrast(lLightBg, lLightText);
    const placeholderContrast = contrast(lLightBg, lLightPlaceholder);

    expect(textContrast).toBeGreaterThanOrEqual(4.5); // Required: >= 4.5:1
    expect(textContrast).toBeGreaterThan(15.0);       // Actual: ~16.8:1
    expect(placeholderContrast).toBeGreaterThanOrEqual(4.5); // Required: >= 4.5:1 (Actual: ~5.99:1)
  });
});
