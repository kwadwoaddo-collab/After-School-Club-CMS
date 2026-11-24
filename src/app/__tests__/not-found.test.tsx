// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import NotFound from '../not-found';

describe('Branded 404 (X-02)', () => {
    afterEach(() => cleanup());

    it('offers escape links to every role door', () => {
        render(<NotFound />);
        expect(screen.getByRole('heading', { name: 'Page not found' })).toBeDefined();
        expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
        expect(screen.getByRole('link', { name: 'Admin / owner log in' }).getAttribute('href')).toBe('/login');
        expect(screen.getByRole('link', { name: 'Staff log in' }).getAttribute('href')).toBe('/staff-login');
        expect(screen.getByRole('link', { name: 'Parent portal' }).getAttribute('href')).toBe('/portal/login');
    });
});
