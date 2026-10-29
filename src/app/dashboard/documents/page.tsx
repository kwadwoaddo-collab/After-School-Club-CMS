import { requireAuth } from '@/lib/require-auth';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getCentreDocuments } from '@/features/documents/actions';
import DocumentsClient from './DocumentsClient';

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
    const { folder } = await searchParams;
    const { user } = await requireAuth();
    const centres = await getUserAccessibleCentres(user.id);
    const selectedCentreId = await resolveActiveCentreId(undefined, centres.map(centre => centre.id));
    const centre = centres.find(item => item.id === selectedCentreId);
    if (!centre) return <DocumentsClient centres={centres.map(({ id, name }) => ({ id, name }))} />;
    let result: Awaited<ReturnType<typeof getCentreDocuments>> | null = null;
    try { result = await getCentreDocuments(centre.id); } catch { /* Render a recoverable loading error below. */ }
    return <DocumentsClient key={`${centre.id}-${folder ?? 'root'}`} currentFolderId={folder || null} folders={result?.folders} removedFolders={result?.removedFolders} centres={centres.map(({ id, name }) => ({ id, name }))} centre={{ id: centre.id, name: centre.name }} documents={result?.documents} removedDocuments={result?.removedDocuments} canManage={result?.canManage} loadError={result ? undefined : "We couldn't load this centre's documents. Refresh the page to try again."} />;
}
