import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserAccessibleCentres } from '@/lib/permissions';
import ImportStudentsClient from './ImportStudentsClient';

export default async function StudentImportPage() {
  const session = await auth();
  if (!session?.user) {
    return redirect('/login');
  }

  const centres = await getUserAccessibleCentres(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Import Students</h1>
        <p className="text-sm text-[#8c909f] mt-1">
          Upload a CSV file to bulk import existing student records and parent contacts.
        </p>
      </div>
      
      <ImportStudentsClient centres={centres} />
    </div>
  );
}
