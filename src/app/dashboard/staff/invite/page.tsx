import { requireAuth } from '@/lib/require-auth';
import InviteStaffForm from '@/features/staff/components/InviteStaffForm';

/**
 * Server wrapper — Milestone 3C. Previously this route had no page-level
 * role gate at all (the whole page was a Client Component), so any
 * authenticated user could reach and interact with the invite form UI even
 * though submission was already server-gated via POST /api/staff/invite.
 * See project-notes/milestone-3c-staff-audit.md §5. The form itself is
 * unchanged, just moved to InviteStaffForm.tsx so this file can gate it.
 */
export default async function InviteStaffPage() {
    await requireAuth({ roles: ['ORG_OWNER'] });

    return <InviteStaffForm />;
}
