/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AddCentreForm from './AddCentreForm';
 
export default async function AddCentrePage() {
    const session = await auth();
 
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
 
    const userRole = (session.user as any).role;
    if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) {
        return redirect('/dashboard');
    }
 
    return <AddCentreForm />;
}
