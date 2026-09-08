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
});
