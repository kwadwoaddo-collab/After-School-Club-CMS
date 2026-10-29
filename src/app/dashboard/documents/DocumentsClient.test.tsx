// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ upload: vi.fn(), rename: vi.fn(), replace: vi.fn(), remove: vi.fn(), restore: vi.fn(), select: vi.fn(), refresh: vi.fn(), createFolder: vi.fn(), renameFolder: vi.fn(), removeFolder: vi.fn(), restoreFolder: vi.fn(), move: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/components/dashboard/CentreFilterContext', () => ({ useCentreFilter: () => ({ setSelectedCentreId: mocks.select }) }));
vi.mock('@/features/documents/actions', () => ({ uploadCentreDocument: mocks.upload, renameCentreDocument: mocks.rename, replaceCentreDocument: mocks.replace, removeCentreDocument: mocks.remove, restoreCentreDocument: mocks.restore, createCentreFolder: mocks.createFolder, renameCentreFolder: mocks.renameFolder, removeCentreFolder: mocks.removeFolder, restoreCentreFolder: mocks.restoreFolder, moveCentreDocument: mocks.move }));
import DocumentsClient from './DocumentsClient';
const centre = { id: 'centre-a', name: 'Sydenham' };
const document = { id: 'document-a', name: 'Parent pack', originalFilename: 'pack.pdf', sizeBytes: 2000, updatedAt: '2026-10-29T12:00:00Z', version: 3 };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('centre document folder', () => {
    it('requires choosing a centre before upload', () => {
        render(<DocumentsClient centres={[centre]} />);
        expect(screen.queryByRole('button', { name: 'Upload PDF' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Sydenham/ }));
        expect(mocks.select).toHaveBeenCalledWith('centre-a');
    });
    it('lets staff download without exposing management controls', () => {
        render(<DocumentsClient centres={[centre]} centre={centre} documents={[document]} />);
        expect(screen.getByRole('link', { name: 'Download Parent pack' }).getAttribute('href')).toBe('/api/documents/document-a?download=1');
        expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Upload PDF' })).toBeNull();
    });
    it('only removes after explicit confirmation, with centre and version', async () => {
        mocks.remove.mockResolvedValue({ success: true });
        render(<DocumentsClient centres={[centre]} centre={centre} documents={[document]} canManage />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect(mocks.remove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Remove document' }));
        await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ centreId: 'centre-a', documentId: 'document-a', version: 3 }));
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });
    it('shows recoverable removed files to managers', async () => {
        mocks.restore.mockResolvedValue({ success: true });
        render(<DocumentsClient centres={[centre]} centre={centre} removedDocuments={[document]} canManage />);
        fireEvent.click(screen.getByText('Removed files (1)'));
        fireEvent.click(screen.getByRole('button', { name: 'Restore Parent pack' }));
        await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith({ centreId: 'centre-a', documentId: 'document-a', version: 3 }));
    });
    it('keeps failed edits visible with a useful server error', async () => {
        mocks.rename.mockResolvedValue({ success: false, error: 'This file changed. Refresh and try again.' });
        render(<DocumentsClient centres={[centre]} centre={centre} documents={[document]} canManage />);
        fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Document name' }), { target: { value: 'Updated pack' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('This file changed'));
        expect(mocks.rename).toHaveBeenCalledWith({ centreId: 'centre-a', documentId: 'document-a', version: 3, name: 'Updated pack' });
        expect(mocks.refresh).not.toHaveBeenCalled();
    });
    it('shows current folder files and breadcrumbs without mixing root files', () => {
        render(<DocumentsClient centres={[centre]} centre={centre} currentFolderId="nested" folders={[{ id: 'policies', name: 'Policies', parentId: null, version: 1 }, { id: 'nested', name: '2026', parentId: 'policies', version: 1 }]} documents={[document, { ...document, id: 'nested-doc', name: 'Nested PDF', folderId: 'nested' }]} />);
        expect(screen.queryByRole('heading', { name: 'Parent pack' })).toBeNull();
        expect(screen.getByRole('heading', { name: 'Nested PDF' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Policies' }).getAttribute('href')).toBe('/dashboard/documents?folder=policies');
        expect(screen.getByText('2026').getAttribute('aria-current')).toBe('page');
    });
    it('creates a child folder in the current folder', async () => {
        mocks.createFolder.mockResolvedValue({ success: true });
        render(<DocumentsClient centres={[centre]} centre={centre} currentFolderId="policies" folders={[{ id: 'policies', name: 'Policies', parentId: null, version: 1 }]} canManage />);
        fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Folder name' }), { target: { value: '2026' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create folder' }));
        await waitFor(() => expect(mocks.createFolder).toHaveBeenCalledWith({ centreId: 'centre-a', parentId: 'policies', name: '2026' }));
    });
    it('moves a PDF to root with its current version', async () => {
        mocks.move.mockResolvedValue({ success: true });
        render(<DocumentsClient centres={[centre]} centre={centre} currentFolderId="policies" folders={[{ id: 'policies', name: 'Policies', parentId: null, version: 1 }]} documents={[{ ...document, folderId: 'policies' }]} canManage />);
        fireEvent.click(screen.getByRole('button', { name: 'Move' }));
        fireEvent.change(screen.getByRole('combobox', { name: 'Destination folder' }), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(mocks.move).toHaveBeenCalledWith({ centreId: 'centre-a', documentId: 'document-a', version: 3, folderId: null }));
    });
    it('shows recovery instead of files for a removed or foreign folder', () => {
        render(<DocumentsClient centres={[centre]} centre={centre} currentFolderId="unavailable" documents={[document]} canManage />);
        expect(screen.getByRole('alert').textContent).toContain('no longer available');
        expect(screen.queryByRole('link', { name: 'Download Parent pack' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Upload PDF' })).toBeNull();
    });

    it('uploads into the current folder without changing the centre-wide limit', async () => {
        mocks.upload.mockResolvedValue({ success: true });
        render(<DocumentsClient centres={[centre]} centre={centre} currentFolderId="policies" folders={[{ id: 'policies', name: 'Policies', parentId: null, version: 1 }]} canManage />);
        fireEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
        const form = screen.getByRole('form', { name: 'Upload PDF' });
        fireEvent.change(screen.getByRole('textbox', { name: 'Document name' }), { target: { value: 'New policy' } });
        fireEvent.submit(form);
        await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
        const data = mocks.upload.mock.calls[0][0] as FormData;
        expect(data.get('centreId')).toBe('centre-a');
        expect(data.get('folderId')).toBe('policies');
    });

});
