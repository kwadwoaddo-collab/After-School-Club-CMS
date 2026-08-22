import { requireAuth } from '@/lib/require-auth';
import AddCentreForm from './AddCentreForm';

export default async function AddCentrePage() {
    // Milestone 3D: normalised from a raw auth() + manual role check to the
    // established requireAuth helper, matching /dashboard/centres and every
    // other gated Centres page. Behaviour is unchanged — this page was
    // already correctly ['ORG_OWNER','MANAGER']-only; see
    // project-notes/milestone-3d-centres-audit.md §3.
    await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    return <AddCentreForm />;
}
