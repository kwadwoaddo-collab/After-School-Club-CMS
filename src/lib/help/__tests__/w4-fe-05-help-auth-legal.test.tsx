// @vitest-environment jsdom
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';

let mockSearchParams = new URLSearchParams();
const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/',
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  getProviders: vi.fn().mockResolvedValue({}),
}));

import {
  MarkdownArticle,
  extractTOC,
  normalizeInternalHelpHref,
  isUnsafeUrlScheme,
} from '@/lib/help/markdown-renderer';
import { HELP_GUIDES } from '@/lib/help/help-manifest';
import AcceptInvitePage from '@/app/accept-invite/page';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import Home from '@/app/page';

describe('Wave 4 FE-05 — Help Links/Anchors, Auth Doors, Legal Skin & XSS Scheme Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it('rewrites all relative .md guide links to /dashboard/help/guides/<slug> and leaves zero raw .md links in help content', () => {
    const validSlugs = new Set(HELP_GUIDES.map(g => g.slug));
    const helpDir = path.resolve(process.cwd(), 'src/content/help');

    const walk = (dirPath: string): string[] => {
      const files: string[] = [];
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) files.push(...walk(full));
        else if (entry.name.endsWith('.md')) files.push(full);
      }
      return files;
    };

    const mdFiles = walk(helpDir);
    expect(mdFiles.length).toBeGreaterThan(20);

    for (const file of mdFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toContain('/dashboard/notifications');
      const linkMatches = [...content.matchAll(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g)];
      for (const [, , href] of linkMatches) {
        expect(href.endsWith('.md')).toBe(false);
        if (href.startsWith('/dashboard/help/guides/')) {
          const slug = href.replace('/dashboard/help/guides/', '').split('#')[0];
          expect(validSlugs.has(slug)).toBe(true);
        }
      }
    }

    // Defensive normaliser handles legacy relative .md links too
    expect(normalizeInternalHelpHref('../role-guides/manager-guide.md')).toBe('/dashboard/help/guides/manager-guide');
    expect(normalizeInternalHelpHref('../functional-manuals/registrations.md#triage')).toBe('/dashboard/help/guides/registrations-intake#triage');
  });

  it('resolves 100% of Quick-Jump #anchor links across all 4 troubleshooting guides to rendered heading IDs', () => {
    const troubleshootingFiles = [
      'src/content/help/troubleshooting/administration-troubleshooting.md',
      'src/content/help/troubleshooting/attendance-safeguarding-troubleshooting.md',
      'src/content/help/troubleshooting/family-booking-troubleshooting.md',
      'src/content/help/troubleshooting/finance-troubleshooting.md',
    ];

    for (const relPath of troubleshootingFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
      const tocIds = new Set(extractTOC(content).map(item => item.id));
      const hashLinks = [...content.matchAll(/\[([^\]]+)\]\(#([^)]+)\)/g)];
      expect(hashLinks.length).toBeGreaterThan(0);

      for (const [, label, targetId] of hashLinks) {
        expect(tocIds.has(targetId), `Missing heading ID #${targetId} for [${label}] in ${relPath}`).toBe(true);
      }
    }
  });

  it('blocks javascript:, data:, and vbscript: URL schemes in MarkdownArticle links and images', () => {
    expect(isUnsafeUrlScheme('javascript:alert(1)')).toBe(true);
    expect(isUnsafeUrlScheme('  JaVaScRiPt:alert(1)')).toBe(true);
    expect(isUnsafeUrlScheme('data:text/html,<script>alert(1)</script>')).toBe(true);
    expect(isUnsafeUrlScheme('vbscript:msgbox(1)')).toBe(true);
    expect(isUnsafeUrlScheme('/dashboard/help/guides/owner-guide')).toBe(false);

    const html = renderToStaticMarkup(
      <MarkdownArticle
        content={[
          'Click [Evil Link](javascript:alert(1)) or [Data Link](data:text/html,boom).',
          '',
          '![Inline Bad](data:image/svg+xml,<svg/>)',
          '',
          '![Block Bad](javascript:evil())',
        ].join('\n')}
      />
    );

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
    expect(html).not.toContain('<img');
    expect(html).toContain('Evil Link');
  });

  it('/accept-invite renders main#main-content[tabIndex=-1], mode=login 15-minute copy, and /staff-login recovery CTA on error', async () => {
    mockSearchParams = new URLSearchParams('mode=login');
    render(<AcceptInvitePage />);

    const main = document.querySelector('main#main-content');
    expect(main).not.toBeNull();
    expect(main?.getAttribute('tabindex')).toBe('-1');

    const alertCard = await screen.findByRole('alert');
    expect(alertCard.textContent).toContain('15 minutes');

    const recoveryLink = screen.getByRole('link', { name: /Request a new staff sign-in link/i });
    expect(recoveryLink.getAttribute('href')).toBe('/staff-login');

    cleanup();

    // Ready state with mode=login
    mockSearchParams = new URLSearchParams('token=valid-tok&mode=login');
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ email: 'tutor@club.co.uk', role: 'TUTOR' }),
    }) as unknown as typeof fetch;

    try {
      const { container } = render(<AcceptInvitePage />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Confirm Staff Sign-In' })).toBeDefined();
      });
      expect(container.textContent).toContain('expires in 15 minutes');
      expect(screen.getByRole('link', { name: 'staff login page' }).getAttribute('href')).toBe('/staff-login');
      expect(container.innerHTML).not.toContain('text-white/30');
      expect(container.innerHTML).not.toContain('text-white/40');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('/privacy and /terms use InvoiceFlow tokens, remove internal build-tracker copy, and apply UK English spelling', () => {
    const privacyHtml = renderToStaticMarkup(<PrivacyPage />);
    const termsHtml = renderToStaticMarkup(<TermsPage />);

    for (const html of [privacyHtml, termsHtml]) {
      expect(html).toContain('id="main-content"');
      expect(html).toContain('bg-page');
      expect(html).not.toContain('#05070A');
      expect(html).not.toContain('Initial Terms and Privacy pages implemented');
      expect(html.length).toBeGreaterThan(500);
    }

    expect(privacyHtml).toContain('brand colours');
    expect(privacyHtml).toContain('unauthorised access');
  });

  it('Landing LoginChooser keeps data-testid="login-chooser" and closes on Escape and outside pointerdown', () => {
    render(<Home />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const choosers = nav.querySelectorAll('details[data-testid="login-chooser"]') as NodeListOf<HTMLDetailsElement>;
    expect(choosers.length).toBeGreaterThan(0);

    choosers[0].open = true;
    expect(choosers[0].open).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(choosers[0].open).toBe(false);

    choosers[0].open = true;
    fireEvent.pointerDown(document.body);
    expect(choosers[0].open).toBe(false);
  });
});
