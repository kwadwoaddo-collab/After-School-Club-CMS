// @vitest-environment jsdom
import React from 'react';
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { formatSchoolYearLabel } from '@/lib/school-year';
import ParentsLoading from '../parents/loading';
import ParentDetailLoading from '../parents/[id]/loading';
import FinanceLoading from '../finance/loading';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Wave 3C design tokens, UK copy, accessible labels & skeletons (PR-19 & PR-20)', () => {
    afterEach(() => {
        cleanup();
    });

    it('updates AGENTS.md STYLE REFERENCE to InvoiceFlow tokens while keeping Next.js agent block intact', () => {
        const agentsMd = read('AGENTS.md');
        expect(agentsMd).toContain('--if-page');
        expect(agentsMd).toContain('bg-surface border border-border rounded-xl');
        expect(agentsMd).not.toContain('#05070A');
        expect(agentsMd).toContain('<!-- BEGIN:nextjs-agent-rules -->');
        expect(agentsMd).toContain('<!-- END:nextjs-agent-rules -->');
        expect(agentsMd).toContain('Financial communications — deliberate sending only');
    });

    it('restyles migrated skeletons (parents, parents/[id], finance) to flat bg-surface rounded-xl without glassmorphic-card', () => {
        for (const rel of [
            'src/app/dashboard/parents/loading.tsx',
            'src/app/dashboard/parents/[id]/loading.tsx',
            'src/app/dashboard/finance/loading.tsx',
        ]) {
            const src = read(rel);
            expect(src).toContain('bg-surface border border-border rounded-xl');
            expect(src).not.toContain('glassmorphic-card');
        }

        const { container: c1 } = render(<ParentsLoading />);
        expect(c1.querySelector('.bg-surface.border-border.rounded-xl')).toBeTruthy();

        const { container: c2 } = render(<ParentDetailLoading />);
        expect(c2.querySelector('.bg-surface.border-border.rounded-xl')).toBeTruthy();

        const { container: c3 } = render(<FinanceLoading />);
        expect(c3.querySelector('.bg-surface.border-border.rounded-xl')).toBeTruthy();
    });

    it('eliminates "Year ear 3" bug via formatSchoolYearLabel in student attendance page', () => {
        const attendanceSrc = read('src/app/dashboard/students/[id]/attendance/page.tsx');
        expect(attendanceSrc).toContain('formatSchoolYearLabel(student.schoolYear)');
        expect(attendanceSrc).not.toContain("student.schoolYear.replace('Y', '')");
        expect(attendanceSrc).toContain('<EmptyState');

        expect(formatSchoolYearLabel('Year 3')).toBe('Year 3');
        expect(formatSchoolYearLabel('Y3')).toBe('Year 3');
        expect(formatSchoolYearLabel('Reception')).toBe('Reception');
        expect(formatSchoolYearLabel('Graduated')).toBe('Graduated');
    });

    it('adds accessible names on collapsed Share Portals link and Availability back link, plus EmptyState', () => {
        const sidebarSrc = read('src/components/dashboard/Sidebar.tsx');
        expect(sidebarSrc).toContain('href="/dashboard/share"');
        expect(sidebarSrc).toContain('aria-label="Share Portals"');

        const availabilitySrc = read('src/app/dashboard/availability/page.tsx');
        expect(availabilitySrc).toContain('aria-label="Back to dashboard"');
        expect(availabilitySrc).toContain('<EmptyState');
    });

    it('standardises UK Organisation copy and .text-page-title headings on settings and communications', () => {
        const settingsPageSrc = read('src/app/dashboard/settings/page.tsx');
        expect(settingsPageSrc).toContain('Manage your organisation profile');
        expect(settingsPageSrc).toContain('className="text-page-title text-text">Workspace Settings</h1>');

        const settingsTabsSrc = read('src/features/settings/components/SettingsTabs.tsx');
        expect(settingsTabsSrc).toContain('Organisation Profile');
        expect(settingsTabsSrc).not.toContain('>Organization Profile<');

        const commsPageSrc = read('src/app/dashboard/communications/page.tsx');
        expect(commsPageSrc).toContain('className="text-page-title text-text"');
        expect(screen).toBeDefined();
    });
});
