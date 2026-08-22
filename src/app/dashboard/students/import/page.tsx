import { requireAuth } from '@/lib/require-auth';
import { getUserAccessibleCentres } from '@/lib/permissions';
import ImportStudentsClient from './ImportStudentsClient';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function StudentImportPage() {
  // Same role rule as the rest of the Students module — see
  // project-notes/milestone-3-people-audit.md §2. Previously this page had
  // no organisation check and no role check at all.
  const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });

  const centres = await getUserAccessibleCentres(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Students
        </Link>
        <h1 className="text-2xl font-black text-foreground tracking-tight">Import Students</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV file to bulk import existing student records and parent contacts.
        </p>
      </div>

      <ImportStudentsClient centres={centres} />
    </div>
  );
}
