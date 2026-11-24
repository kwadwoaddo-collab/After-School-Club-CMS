// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LoginPage from '../login/page';
import StaffLoginPage from '../staff-login/page';
import PortalLoginPage from '../portal/login/page';
import ForgotPasswordPage from '../forgot-password/page';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-auth/react', () => ({
    signIn: vi.fn(),
}));

describe('Auth doors role clarity, cross-links & passwordless guidance (PR #8a–#8d)', () => {
    afterEach(() => {
        cleanup();
    });

    it('/login identifies admin/staff audience, preserves G7 selectors, and links parents outside <form>', () => {
        const { container } = render(<LoginPage />);

        expect(screen.getByRole('heading', { name: /Admin & Staff Sign In/i })).toBeDefined();
        expect(screen.getByText(/For club owners, administrators, and invited staff members\./i)).toBeDefined();

        // Guardrail G7 selectors & mode switcher
        expect(container.querySelector('input#admin-email')).not.toBeNull();
        expect(container.querySelector('input#admin-password')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Admin / Owner' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Staff Member' })).toBeDefined();

        const submitBtn = container.querySelector('button[type="submit"]');
        expect(submitBtn).not.toBeNull();
        expect(submitBtn?.textContent).toBe('Sign In');

        // N-02: Parent cross-link outside <form>
        const parentLink = screen.getByRole('link', { name: /Sign in as a parent/i });
        expect(parentLink.getAttribute('href')).toBe('/portal/login');
        expect(parentLink.closest('form')).toBeNull();

        // N-06: Staff tab uses consistent magic-link submit label
        fireEvent.click(screen.getByRole('button', { name: 'Staff Member' }));
        const staffSubmitBtn = container.querySelector('button[type="submit"]');
        expect(staffSubmitBtn?.textContent).toBe('Send Sign-In Link');
    });

    it('/staff-login identifies invited club staff audience and uses consistent submit label', () => {
        const { container } = render(<StaffLoginPage />);

        expect(screen.getByRole('heading', { name: 'Staff Login' })).toBeDefined();
        expect(screen.getByText(/For invited club staff/i)).toBeDefined();

        const submitBtn = container.querySelector('button[type="submit"]');
        expect(submitBtn).not.toBeNull();
        expect(submitBtn?.textContent).toContain('Send Sign-In Link');

        const adminLink = screen.getByRole('link', { name: /Admin login/i });
        expect(adminLink.getAttribute('href')).toBe('/login');
        expect(adminLink.closest('form')).toBeNull();
    });

    it('/portal/login identifies parents & carers, trims subtitle, and points staff cross-link to /staff-login', () => {
        const { container } = render(<PortalLoginPage />);

        expect(screen.getByText(/For Parents & Carers/i)).toBeDefined();
        expect(screen.getByRole('heading', { name: 'Parent Portal' })).toBeDefined();
        expect(
            screen.getByText("Enter your registered email and we'll send a secure sign-in link.")
        ).toBeDefined();

        const submitBtn = container.querySelector('button[type="submit"]');
        expect(submitBtn).not.toBeNull();
        expect(submitBtn?.textContent).toBe('Send Sign-In Link');

        // N-03 / D4: Staff cross-link points to /staff-login, not /login
        const staffLink = screen.getByRole('link', { name: 'Staff Login' });
        expect(staffLink.getAttribute('href')).toBe('/staff-login');
        expect(staffLink.closest('form')).toBeNull();
    });

    it('/forgot-password clarifies outside <form> that parents do not use passwords and links to magic-link doors', () => {
        render(<ForgotPasswordPage />);

        expect(screen.getByText(/Parents do not use passwords/i)).toBeDefined();

        const parentPortalLink = screen.getByRole('link', { name: 'Parent Portal' });
        expect(parentPortalLink.getAttribute('href')).toBe('/portal/login');
        expect(parentPortalLink.closest('form')).toBeNull();

        const staffLoginLink = screen.getByRole('link', { name: 'Staff Login' });
        expect(staffLoginLink.getAttribute('href')).toBe('/staff-login');
        expect(staffLoginLink.closest('form')).toBeNull();
    });
});

describe('Portal login brand & contrast (X-01)', () => {
    it('renders the SprintScale brand and a token-based input border', async () => {
        const { default: PortalLoginPage } = await import('../portal/login/page');
        const { render, screen } = await import('@testing-library/react');
        const { container } = render(<PortalLoginPage />);
        expect(screen.getByTestId('portal-brand').textContent).toBe('SprintScale');
        const input = container.querySelector('#portal-login-email');
        expect(input?.className).toContain('border-[var(--if-text-muted)]');
        expect(input?.className).toContain('text-foreground');
    });
});
