'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Folder, Download, Upload, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import { uploadCentreDocument, replaceCentreDocument, renameCentreDocument, removeCentreDocument, restoreCentreDocument, createCentreFolder, renameCentreFolder, removeCentreFolder, restoreCentreFolder, moveCentreDocument } from '@/features/documents/actions';

type Document = { id: string; name: string; originalFilename: string; sizeBytes: number; updatedAt: string; version: number; folderId?: string | null };
type DocumentFolder = { id: string; name: string; parentId: string | null; version: number };
type FolderEdit = { kind: 'create' } | { kind: 'rename' | 'remove'; folder: DocumentFolder } | null;
type Centre = { id: string; name: string };
type Edit = { kind: 'rename' | 'replace' | 'remove' | 'move'; document: Document } | null;
const inputClass = 'w-full rounded-md border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export default function DocumentsClient({ centres, centre, documents = [], removedDocuments = [], folders = [], removedFolders = [], currentFolderId = null, canManage = false, loadError }: {
    centres: Centre[]; centre?: Centre; documents?: Document[]; removedDocuments?: Document[]; folders?: DocumentFolder[]; removedFolders?: DocumentFolder[]; currentFolderId?: string | null; canManage?: boolean; loadError?: string;
}) {
    const router = useRouter();
    const { setSelectedCentreId } = useCentreFilter();
    const [adding, setAdding] = useState(false);
    const [folderEdit, setFolderEdit] = useState<FolderEdit>(null);
    const [edit, setEdit] = useState<Edit>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const running = useRef(false);

    const currentFolder = folders.find(folder => folder.id === currentFolderId);
    const invalidFolder = !!currentFolderId && !currentFolder;
    const visibleDocuments = documents.filter(document => (document.folderId ?? null) === currentFolderId);
    const visibleFolders = folders.filter(folder => folder.parentId === currentFolderId);
    const trail: DocumentFolder[] = [];
    let ancestor = currentFolder;
    while (ancestor && trail.length < folders.length) { trail.unshift(ancestor); ancestor = folders.find(folder => folder.id === ancestor?.parentId); }
    const folderHref = (id: string | null) => id ? `/dashboard/documents?folder=${encodeURIComponent(id)}` : '/dashboard/documents';
    const folderPath = (folder: DocumentFolder) => {
        const names = [folder.name]; let parentId = folder.parentId; const visited = new Set([folder.id]);
        while (parentId && !visited.has(parentId)) { visited.add(parentId); const parent = folders.find(item => item.id === parentId); if (!parent) break; names.unshift(parent.name); parentId = parent.parentId; }
        return names.join(' / ');
    };

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!centre || running.current) return;
        const data = new FormData(event.currentTarget);
        data.set('centreId', centre.id);
        if (!edit && currentFolderId) data.set('folderId', currentFolderId);
        running.current = true; setBusy(true); setError(''); setMessage('');
        try {
            let result;
            if (!edit) result = await uploadCentreDocument(data);
            else {
                const identity = { centreId: centre.id, documentId: edit.document.id, version: edit.document.version };
                if (edit.kind === 'remove') result = await removeCentreDocument(identity);
                else if (edit.kind === 'move') result = await moveCentreDocument({ ...identity, folderId: String(data.get('folderId') || '') || null });
                else if (edit.kind === 'rename') result = await renameCentreDocument({ ...identity, name: String(data.get('name') || '') });
                else {
                    data.set('documentId', identity.documentId); data.set('version', String(identity.version));
                    result = await replaceCentreDocument(data);
                }
            }
            if (!result.success) { setError(result.error); return; }
            setMessage(edit?.kind === 'remove' ? 'Document removed.' : edit ? 'Document updated.' : 'PDF uploaded.');
            setAdding(false); setEdit(null); router.refresh();
        } catch { setError('The document could not be saved. Please try again.'); }
        finally { running.current = false; setBusy(false); }
    }

    async function submitFolder(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!centre || !folderEdit || running.current) return;
        const data = new FormData(event.currentTarget);
        running.current = true; setBusy(true); setError(''); setMessage('');
        try {
            const result = folderEdit.kind === 'create'
                ? await createCentreFolder({ centreId: centre.id, parentId: currentFolderId, name: String(data.get('name') || '') })
                : folderEdit.kind === 'rename'
                    ? await renameCentreFolder({ centreId: centre.id, folderId: folderEdit.folder.id, version: folderEdit.folder.version, name: String(data.get('name') || '') })
                    : await removeCentreFolder({ centreId: centre.id, folderId: folderEdit.folder.id, version: folderEdit.folder.version });
            if (!result.success) { setError(result.error); return; }
            setMessage(folderEdit.kind === 'remove' ? 'Folder removed.' : folderEdit.kind === 'create' ? 'Folder created.' : 'Folder renamed.');
            setFolderEdit(null); router.refresh();
        } catch { setError('The folder could not be saved. Please try again.'); }
        finally { running.current = false; setBusy(false); }
    }

    async function restoreFolder(folder: DocumentFolder) {
        if (!centre || running.current) return;
        running.current = true; setBusy(true); setError(''); setMessage('');
        try {
            const result = await restoreCentreFolder({ centreId: centre.id, folderId: folder.id, version: folder.version });
            if (!result.success) { setError(result.error); return; }
            setMessage('Folder restored.'); router.refresh();
        } catch { setError('The folder could not be restored. Please try again.'); }
        finally { running.current = false; setBusy(false); }
    }

    async function restore(document: Document) {
        if (!centre || running.current) return;
        running.current = true; setBusy(true); setError(''); setMessage('');
        try {
            const result = await restoreCentreDocument({ centreId: centre.id, documentId: document.id, version: document.version });
            if (!result.success) { setError(result.error); return; }
            setMessage('Document restored.'); router.refresh();
        } catch { setError('The document could not be restored. Please try again.'); }
        finally { running.current = false; setBusy(false); }
    }

    function openEdit(kind: NonNullable<Edit>['kind'], document: Document) {
        setAdding(false); setFolderEdit(null); setError(''); setMessage(''); setEdit({ kind, document });
    }

    return <div className="space-y-6 [--if-danger:#B3261E] dark:[--if-danger:#F87171]">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-page-title text-text">Documents</h1><p className="mt-2 text-sm text-text-secondary">{centre ? `${centre.name} · PDF files for this centre` : 'Choose a centre to open its document folder.'}</p></div>
            {centre && canManage && !loadError && !invalidFolder && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || folders.length >= 100} onClick={() => { setFolderEdit({ kind: 'create' }); setAdding(false); setEdit(null); setError(''); setMessage(''); }}>New folder</Button><Button disabled={busy || documents.length >= 20} onClick={() => { setAdding(true); setFolderEdit(null); setEdit(null); setError(''); setMessage(''); }}><Upload className="h-4 w-4" />Upload PDF</Button></div>}
        </div>
        {!centre ? <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {centres.length ? centres.map(item => <button key={item.id} onClick={() => setSelectedCentreId(item.id)} className="flex min-h-16 w-full items-center gap-3 px-5 py-4 text-left text-text hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><Folder className="h-5 w-5 text-accent" /><span className="min-w-0 break-words font-medium">{item.name}</span><span className="ml-auto text-sm text-accent">Open folder</span></button>) : <p className="p-6 text-sm text-text-secondary">No centres are assigned to your account. Ask your manager for access.</p>}
        </div> : <>
            <nav aria-label="Document folders" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><Link href={folderHref(null)} className="text-accent underline-offset-4 hover:underline">{centre.name}</Link>{trail.map(folder => <span key={folder.id} className="contents"><span aria-hidden="true" className="text-text-muted">/</span>{folder.id === currentFolderId ? <span aria-current="page" className="break-words font-medium text-text">{folder.name}</span> : <Link href={folderHref(folder.id)} className="break-words text-accent underline-offset-4 hover:underline">{folder.name}</Link>}</span>)}</nav>
            {invalidFolder && <p role="alert" className="text-sm text-danger">This folder is no longer available. <Link href={folderHref(null)} className="underline">Return to this centre’s documents</Link>.</p>}
            {folderEdit && <form key={folderEdit.kind === 'create' ? 'create-folder' : `${folderEdit.kind}-${folderEdit.folder.id}`} onSubmit={submitFolder} className="space-y-4 rounded-lg border border-border bg-surface p-5" aria-label="Manage folder"><h2 className="text-lg font-semibold text-text">{folderEdit.kind === 'create' ? 'New folder' : folderEdit.kind === 'rename' ? 'Rename folder' : 'Remove folder?'}</h2>{folderEdit.kind === 'remove' ? <p className="text-sm text-text-secondary">Remove “{folderEdit.folder.name}”? Only an empty folder can be removed. You can restore it from Removed folders.</p> : <label className="block max-w-xl space-y-2 text-sm font-medium text-text">Folder name<input autoFocus required name="name" maxLength={120} defaultValue={folderEdit.kind === 'rename' ? folderEdit.folder.name : ''} className={inputClass} /></label>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex flex-wrap gap-2"><Button disabled={busy} variant={folderEdit.kind === 'remove' ? 'destructive' : 'default'}>{busy ? 'Saving…' : folderEdit.kind === 'create' ? 'Create folder' : folderEdit.kind === 'remove' ? 'Remove folder' : 'Save folder name'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setFolderEdit(null); setError(''); }}>Cancel</Button></div></form>}
            {loadError && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-4 text-sm text-danger">{loadError}</p>}
            {error && !adding && !edit && !folderEdit && <p role="alert" className="text-sm text-danger">{error}</p>}
            {message && <p role="status" className="text-sm text-success">{message}</p>}
            {(adding || edit) && <form key={edit ? `${edit.kind}-${edit.document.id}` : 'upload'} onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-surface p-5" aria-label={edit ? `${edit.kind} document` : 'Upload PDF'}>
                <h2 className="text-lg font-semibold text-text">{edit ? ({ rename: 'Rename document', replace: 'Replace PDF', remove: 'Remove document?', move: 'Move PDF' }[edit.kind]) : 'Upload a PDF'}</h2>
                {edit && <p className="break-words text-sm text-text-secondary">{edit.document.name}</p>}
                {edit?.kind === 'move' ? <label className="block max-w-xl space-y-2 text-sm font-medium text-text">Destination folder<select name="folderId" defaultValue={edit.document.folderId ?? ''} className={inputClass}><option value="">{centre.name} (main folder)</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folderPath(folder)}</option>)}</select></label> : edit?.kind === 'remove' ? <p className="text-sm text-text-secondary">This removes the document from this centre’s folder. Staff will no longer be able to download it. Owners and managers can restore it from Removed files.</p> : <>
                    {(!edit || edit.kind === 'rename') && <label className="block max-w-xl space-y-2 text-sm font-medium text-text">Document name<input autoFocus name="name" required maxLength={120} defaultValue={edit?.document.name} placeholder="e.g. Parent information pack" className={inputClass} /></label>}
                    {(!edit || edit.kind === 'replace') && <label className="block max-w-xl space-y-2 text-sm font-medium text-text">PDF file<input name="file" type="file" accept="application/pdf,.pdf" required className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent`} /><span className="block text-xs font-normal text-text-secondary">PDF only, up to 3 MB. {edit ? 'The current PDF stays available until its replacement is saved.' : 'Up to 20 documents per centre.'}</span></label>}
                </>}
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy} variant={edit?.kind === 'remove' ? 'destructive' : 'default'}>{busy ? 'Saving…' : edit?.kind === 'remove' ? 'Remove document' : edit ? 'Save changes' : 'Upload PDF'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setAdding(false); setEdit(null); setError(''); }}>Cancel</Button></div>
            </form>}
            {!loadError && !invalidFolder && visibleFolders.length > 0 && <ul className="divide-y divide-border rounded-lg border border-border bg-surface">{visibleFolders.map(folder => <li key={folder.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><Link href={folderHref(folder.id)} className="flex min-w-0 items-center gap-3 font-medium text-text hover:text-accent"><Folder className="h-5 w-5 shrink-0 text-accent" /><span className="break-words">{folder.name}</span></Link>{canManage && <div className="flex gap-4"><button disabled={busy} onClick={() => { setFolderEdit({ kind: 'rename', folder }); setEdit(null); setAdding(false); setError(''); }} className="min-h-9 text-sm text-accent hover:underline" aria-label={`Rename folder ${folder.name}`}>Rename</button><button disabled={busy} onClick={() => { setFolderEdit({ kind: 'remove', folder }); setEdit(null); setAdding(false); setError(''); }} className="min-h-9 text-sm text-danger hover:underline" aria-label={`Remove folder ${folder.name}`}>Remove</button></div>}</li>)}</ul>}
            {!loadError && !invalidFolder && <div className="overflow-hidden rounded-lg border border-border bg-surface">
                {visibleDocuments.length === 0 ? <div className="px-6 py-12 text-center"><FileText className="mx-auto mb-3 h-7 w-7 text-text-muted" /><h2 className="font-semibold text-text">No PDFs in this folder</h2><p className="mt-2 text-sm text-text-secondary">{canManage ? 'Upload a PDF here, or move an existing PDF into this folder.' : 'Your owner or manager can upload PDFs for this centre.'}</p></div> : <ul className="divide-y divide-border">{visibleDocuments.map(document => <li key={document.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <FileText className="hidden h-5 w-5 shrink-0 text-accent sm:block" />
                    <div className="min-w-0 flex-1"><h2 className="break-words font-medium text-text">{document.name}</h2><p className="mt-1 break-words text-xs text-text-secondary">{document.originalFilename} · {(document.sizeBytes / 1024 / 1024).toFixed(2)} MB · Updated {new Date(document.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })}</p>
                    {canManage && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2"><button disabled={busy} onClick={() => openEdit('rename', document)} className="min-h-9 text-sm text-accent underline-offset-4 hover:underline">Rename</button><button disabled={busy} onClick={() => openEdit('replace', document)} className="min-h-9 text-sm text-accent underline-offset-4 hover:underline">Replace PDF</button><button disabled={busy} onClick={() => openEdit('move', document)} className="min-h-9 text-sm text-accent underline-offset-4 hover:underline">Move</button><button disabled={busy} onClick={() => openEdit('remove', document)} className="min-h-9 text-sm text-danger underline-offset-4 hover:underline">Remove</button></div>}</div>
                    <div className="flex shrink-0 flex-wrap gap-2"><Button asChild variant="outline"><a href={`/api/documents/${document.id}?view=1`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${document.name} (new tab)`}><ExternalLink className="h-4 w-4" />Open PDF</a></Button><Button asChild><a href={`/api/documents/${document.id}?download=1`} aria-label={`Download ${document.name}`}><Download className="h-4 w-4" />Download</a></Button></div>
                </li>)}</ul>}
            </div>}
            {canManage && removedDocuments.length > 0 && <details className="rounded-lg border border-border bg-surface p-5"><summary className="cursor-pointer font-medium text-text">Removed files ({removedDocuments.length})</summary><ul className="mt-4 divide-y divide-border">{removedDocuments.map(document => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 break-words text-sm text-text-secondary">{document.name}</span><Button variant="outline" disabled={busy || documents.length >= 20} onClick={() => restore(document)} aria-label={`Restore ${document.name}`}>Restore</Button></li>)}</ul></details>}
            {canManage && removedFolders.length > 0 && <details className="rounded-lg border border-border bg-surface p-5"><summary className="cursor-pointer font-medium text-text">Removed folders ({removedFolders.length})</summary><ul className="mt-4 divide-y divide-border">{removedFolders.map(folder => <li key={folder.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="break-words text-sm text-text-secondary">{folder.name}</span><Button variant="outline" disabled={busy || folders.length >= 100} onClick={() => restoreFolder(folder)} aria-label={`Restore folder ${folder.name}`}>Restore</Button></li>)}</ul></details>}
            {canManage && documents.length >= 20 && <p className="text-sm text-text-secondary">This centre has reached its 20-document limit. Replace or remove a PDF before uploading another.</p>}
        </>}
    </div>;
}
