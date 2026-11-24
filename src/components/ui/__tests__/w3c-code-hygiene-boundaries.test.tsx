// @vitest-environment jsdom
import React from 'react';
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.stubGlobal('React', React);

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { ConfirmModal } from '../ConfirmModal';
import ConfirmActionModal from '@/features/finance/components/ConfirmActionModal';
import FinanceError from '@/app/dashboard/finance/error';
import KioskError from '@/app/dashboard/kiosk/error';
import AttendanceError from '@/app/dashboard/attendance/error';

const ROOT = process.cwd();

describe('Wave 3C code hygiene, ConfirmModal consolidation & error boundaries (PR-21)', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('removes unused DataTable files, keeps pure Server Components free of use client, and ships canonical src/types/next-auth.d.ts', () => {
        expect(fs.existsSync(path.join(ROOT, 'src/components/ui/DataTable.tsx'))).toBe(false);
        expect(fs.existsSync(path.join(ROOT, 'src/components/ui/DataTable.test.tsx'))).toBe(false);
        expect(fs.existsSync(path.join(ROOT, 'src/next-auth.d.ts'))).toBe(false);
        expect(fs.existsSync(path.join(ROOT, 'src/types/next-auth.d.ts'))).toBe(true);

        const tableSrc = fs.readFileSync(path.join(ROOT, 'src/components/ui/Table.tsx'), 'utf8');
        expect(tableSrc).not.toContain('still used by');

        for (const rel of [
            'src/components/dashboard/KpiGrid.tsx',
            'src/components/dashboard/GrowthSparkline.tsx',
            'src/components/dashboard/LoadForecast.tsx',
            'src/app/dashboard/help/videos/[slug]/_components/VideoPlayerView.tsx',
        ]) {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            expect(src.startsWith("'use client'")).toBe(false);
        }
    });

    it('delegates ConfirmActionModal to ConfirmModal with async loading and error display', async () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn().mockRejectedValueOnce(new Error('Cannot delete draft with payments'));

        render(
            <ConfirmActionModal
                isOpen
                onClose={onClose}
                onConfirm={onConfirm}
                variant="delete"
                invoiceNumber="INV-0042"
            />
        );

        expect(screen.getByText('Delete Draft Invoice')).toBeTruthy();
        expect(screen.getByText(/Draft invoice INV-0042 will be permanently removed/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Discard Permanently' }));
        await screen.findByText('Cannot delete draft with payments');
        expect(onClose).not.toHaveBeenCalled();

        // Subsequent successful confirm closes modal
        onConfirm.mockResolvedValueOnce(undefined);
        fireEvent.click(screen.getByRole('button', { name: 'Discard Permanently' }));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('blocks Escape close while ConfirmModal isLoading is true', () => {
        const onClose = vi.fn();
        render(
            <ConfirmModal
                isOpen
                onClose={onClose}
                onConfirm={vi.fn()}
                title="Confirm action"
                description="Please wait"
                isLoading
            />
        );

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('renders route-scoped InvoiceFlow error boundaries for finance, kiosk, and attendance', () => {
        for (const [Component, heading] of [
            [FinanceError, 'Unable to load finance'],
            [KioskError, 'Unable to load kiosk register'],
            [AttendanceError, 'Unable to load attendance'],
        ] as const) {
            const reset = vi.fn();
            render(<Component error={new Error('db failure')} reset={reset} />);
            expect(screen.getByText(heading)).toBeTruthy();
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
            expect(reset).toHaveBeenCalledTimes(1);
            cleanup();
        }
    });
});
