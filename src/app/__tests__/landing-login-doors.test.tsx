// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import Home from '../page';

describe('Landing page login doors & legal label (N-04 + N-09a)', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders footer Log in links for Admin / owner, Staff, and Parents without /dashboard', () => {
        render(<Home />);
        const footer = screen.getByRole('contentinfo');

        expect(within(footer).getByRole('heading', { name: 'Log in' })).toBeDefined();
        expect(within(footer).getByRole('link', { name: 'Admin / owner' }).getAttribute('href')).toBe('/login');
        expect(within(footer).getByRole('link', { name: 'Staff' }).getAttribute('href')).toBe('/staff-login');
        expect(within(footer).getByRole('link', { name: 'Parents' }).getAttribute('href')).toBe('/portal/login');

        const allLinks = screen.getAllByRole('link');
        expect(allLinks.some((el) => el.getAttribute('href') === '/dashboard')).toBe(false);
    });

    it('links "the staff login page" inside the staff FAQ answer to /staff-login', () => {
        render(<Home />);
        const staffFaqButton = screen.getByRole('button', { name: /How do staff sign in\?/i });
        fireEvent.click(staffFaqButton);

        const faqLink = screen.getByRole('link', { name: 'the staff login page' });
        expect(faqLink.getAttribute('href')).toBe('/staff-login');
    });

    it('renders "Terms of Service" instead of "Terms and Conditions" in the footer and preserves #pricing + #early-access anchors', () => {
        const { container } = render(<Home />);
        const footer = screen.getByRole('contentinfo');

        expect(within(footer).getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe('/terms');
        expect(within(footer).queryByRole('link', { name: 'Terms and Conditions' })).toBeNull();

        expect(container.querySelector('#pricing')).not.toBeNull();
        expect(container.querySelector('#early-access')).not.toBeNull();
    });
});
