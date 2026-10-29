'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Folder, Download, Upload, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import { uploadCentreDocument, replaceCentreDocument, renameCentreDocument, removeCentreDocument, restoreCentreDocument } from '@/features/documents/actions';

type Document = { id: string; name: string; originalFilename: string; sizeBytes: number; updatedAt: string; version: number };
type Centre = { id: string; name: string };
type Edit = { kind: 'rename' | 'replace' | 'remove'; document: Document } | null;
const inputClass = 'w-full rounded-md border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export default function DocumentsClient({ centres, centre, documents = [], removedDocuments = [], canManage = false, loadError }: {
    centres: Centre[]; centre?: Centre; documents?: Document[]; removedDocuments?: Document[]; canManage?: boolean; loadError?: string;
}) {
    const router = useRouter();
    const { setSelectedCentreId } = useCentreFilter();
    const [adding, setAdding] = useState(false);
    const [edit, setEdit] = useState<Edit>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const running = useRef(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!centre || running.current) return;
        const data = new FormData(event.currentTarget);
        data.set('centreId', centre.id);
        running.current = true; setBusy(true); setError(''); setMessage('');
        try {
            let result;
            if (!edit) result = await uploadCentreDocument(data);
            else {
                const identity = { centreId: centre.id, documentId: edit.document.id, version: edit.document.version };
                if (edit.kind === 'remove') result = await removeCentreDocument(identity);
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
        setAdding(false); setError(''); setMessage(''); setEdit({ kind, document });
    }

    return <div className="space-y-6 [--if-danger:#B3261E] dark:[--if-danger:#F87171]">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-page-title text-text">Documents</h1><p className="mt-2 text-sm text-text-secondary">{centre ? `${centre.name} · PDF files for this centre` : 'Choose a centre to open its document folder.'}</p></div>
            {centre && canManage && !loadError && <Button disabled={busy || documents.length >= 20} onClick={() => { setAdding(true); setEdit(null); setError(''); setMessage(''); }}><Upload className="h-4 w-4" />Upload PDF</Button>}
        </div>
        {!centre ? <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {centres.length ? centres.map(item => <button key={item.id} onClick={() => setSelectedCentreId(item.id)} className="flex min-h-16 w-full items-center gap-3 px-5 py-4 text-left text-text hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><Folder className="h-5 w-5 text-accent" /><span className="min-w-0 break-words font-medium">{item.name}</span><span className="ml-auto text-sm text-accent">Open folder</span></button>) : <p className="p-6 text-sm text-text-secondary">No centres are assigned to your account. Ask your manager for access.</p>}
        </div> : <>
            {loadError && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-4 text-sm text-danger">{loadError}</p>}
            {error && !adding && !edit && <p role="alert" className="text-sm text-danger">{error}</p>}
            {message && <p role="status" className="text-sm text-success">{message}</p>}
            {(adding || edit) && <form key={edit ? `${edit.kind}-${edit.document.id}` : 'upload'} onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-surface p-5" aria-label={edit ? `${edit.kind} document` : 'Upload PDF'}>
                <h2 className="text-lg font-semibold text-text">{edit ? ({ rename: 'Rename document', replace: 'Replace PDF', remove: 'Remove document?' }[edit.kind]) : 'Upload a PDF'}</h2>
                {edit && <p className="break-words text-sm text-text-secondary">{edit.document.name}</p>}
                {edit?.kind === 'remove' ? <p className="text-sm text-text-secondary">This removes the document from this centre’s folder. Staff will no longer be able to download it. Owners and managers can restore it from Removed files.</p> : <>
                    {(!edit || edit.kind === 'rename') && <label className="block max-w-xl space-y-2 text-sm font-medium text-text">Document name<input autoFocus name="name" required maxLength={120} defaultValue={edit?.document.name} placeholder="e.g. Parent information pack" className={inputClass} /></label>}
                    {(!edit || edit.kind === 'replace') && <label className="block max-w-xl space-y-2 text-sm font-medium text-text">PDF file<input name="file" type="file" accept="application/pdf,.pdf" required className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent`} /><span className="block text-xs font-normal text-text-secondary">PDF only, up to 3 MB. {edit ? 'The current PDF stays available until its replacement is saved.' : 'Up to 20 documents per centre.'}</span></label>}
                </>}
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy} variant={edit?.kind === 'remove' ? 'destructive' : 'default'}>{busy ? 'Saving…' : edit?.kind === 'remove' ? 'Remove document' : edit ? 'Save changes' : 'Upload PDF'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setAdding(false); setEdit(null); setError(''); }}>Cancel</Button></div>
            </form>}
            {!loadError && <div className="overflow-hidden rounded-lg border border-border bg-surface">
                {documents.length === 0 ? <div className="px-6 py-12 text-center"><FileText className="mx-auto mb-3 h-7 w-7 text-text-muted" /><h2 className="font-semibold text-text">No PDFs yet</h2><p className="mt-2 text-sm text-text-secondary">{canManage ? 'Upload your first PDF to make it available to staff at this centre.' : 'Your owner or manager can upload PDFs for this centre.'}</p></div> : <ul className="divide-y divide-border">{documents.map(document => <li key={document.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <FileText className="hidden h-5 w-5 shrink-0 text-accent sm:block" />
                    <div className="min-w-0 flex-1"><h2 className="break-words font-medium text-text">{document.name}</h2><p className="mt-1 break-words text-xs text-text-secondary">{document.originalFilename} · {(document.sizeBytes / 1024 / 1024).toFixed(2)} MB · Updated {new Date(document.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })}</p>
                    {canManage && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2"><button disabled={busy} onClick={() => openEdit('rename', document)} className="min-h-9 text-sm text-accent underline-offset-4 hover:underline">Rename</button><button disabled={busy} onClick={() => openEdit('replace', document)} className="min-h-9 text-sm text-accent underline-offset-4 hover:underline">Replace PDF</button><button disabled={busy} onClick={() => openEdit('remove', document)} className="min-h-9 text-sm text-danger underline-offset-4 hover:underline">Remove</button></div>}</div>
                    <div className="flex shrink-0 flex-wrap gap-2"><Button asChild variant="outline"><a href={`/api/documents/${document.id}?view=1`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${document.name} (new tab)`}><ExternalLink className="h-4 w-4" />Open PDF</a></Button><Button asChild><a href={`/api/documents/${document.id}?download=1`} aria-label={`Download ${document.name}`}><Download className="h-4 w-4" />Download</a></Button></div>
                </li>)}</ul>}
            </div>}
            {canManage && removedDocuments.length > 0 && <details className="rounded-lg border border-border bg-surface p-5"><summary className="cursor-pointer font-medium text-text">Removed files ({removedDocuments.length})</summary><ul className="mt-4 divide-y divide-border">{removedDocuments.map(document => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 break-words text-sm text-text-secondary">{document.name}</span><Button variant="outline" disabled={busy || documents.length >= 20} onClick={() => restore(document)} aria-label={`Restore ${document.name}`}>Restore</Button></li>)}</ul></details>}
            {canManage && documents.length >= 20 && <p className="text-sm text-text-secondary">This folder has reached its 20-document limit. Replace or remove a PDF before uploading another.</p>}
        </>}
    </div>;
}
