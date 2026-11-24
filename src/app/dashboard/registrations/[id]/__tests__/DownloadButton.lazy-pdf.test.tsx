// @vitest-environment jsdom
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const toBlobMock = vi.fn();
const pdfMock = vi.fn((..._args: unknown[]) => ({ toBlob: toBlobMock }));

vi.mock('@react-pdf/renderer', () => ({
    pdf: (...args: unknown[]) => pdfMock(...args),
}));

vi.mock('@/features/registration/components/RegistrationTemplate', () => ({
    RegistrationTemplate: () => <div data-testid="reg-template" />,
}));

import DownloadButton from '../DownloadButton';

describe('PR-17: Lazy @react-pdf/renderer bundle isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        toBlobMock.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    });

    afterEach(() => {
        cleanup();
    });

    it('keeps @react-pdf/renderer and PDF templates out of top-level static imports in route entrypoints', () => {
        const root = process.cwd();
        const entrypoints = [
            'src/app/register/[...slug]/page.tsx',
            'src/app/dashboard/registrations/[id]/DownloadButton.tsx',
            'src/features/finance/components/InvoiceDetailsClient.tsx',
        ];

        for (const relPath of entrypoints) {
            const content = fs.readFileSync(path.join(root, relPath), 'utf8');
            expect(content).not.toMatch(/^import\s+.*from\s+['"]@react-pdf\/renderer['"]/m);
            expect(content).not.toMatch(/^import\s+.*RegistrationTemplate/m);
            expect(content).not.toMatch(/^import\s+.*InvoiceTemplate/m);
            expect(content).not.toMatch(/^import\s+.*ReceiptTemplate/m);
        }
    });

    it('generates and downloads registration PDF on click via dynamic import', async () => {
        const createObjectURLSpy = vi.fn(() => 'blob:mock-registration-pdf');
        const revokeObjectURLSpy = vi.fn();
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURLSpy });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURLSpy });
        const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        render(
            <DownloadButton
                orgName="Test Club"
                centreName="Main Centre"
                startDate="2026-09-01"
                submittedAt="2026-08-20T10:00:00Z"
                parents={[{ firstName: 'Jane', lastName: 'Doe', relationship: 'Mother', phone: '07700900000' }]}
                registeredChildren={[{ firstName: 'Sam', lastName: 'Doe', dateOfBirth: '2018-05-01', schoolYear: 'Y3', sessions: [] }]}
                emergencyContact={{ name: 'John Doe', relationship: 'Father', phone: '07700900001' }}
                funding={{ type: 'self_funded' }}
                specialNeeds={{ has: false }}
            />
        );

        expect(pdfMock).not.toHaveBeenCalled();

        const btn = screen.getByRole('button', { name: /Download PDF/i });
        fireEvent.click(btn);

        await waitFor(() => expect(pdfMock).toHaveBeenCalledTimes(1));
        expect(toBlobMock).toHaveBeenCalledTimes(1);
        expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(anchorClickSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-registration-pdf');

        anchorClickSpy.mockRestore();
    });
});
