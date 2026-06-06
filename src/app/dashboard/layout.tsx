import { auth } from '@/lib/auth';
import { redirect, RedirectType } from 'next/navigation';
import { headers } from 'next/headers';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { SidebarProvider } from '@/components/dashboard/SidebarContext';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { CentreFilterProvider } from '@/components/dashboard/CentreFilterContext';
import { resolveActiveCentreId } from '@/lib/centre-filter';

// Which roles can access which route prefixes
const ROUTE_PERMISSIONS: Record<string, string[]> = {
    '/dashboard/staff': ['ORG_OWNER'],
    '/dashboard/settings': ['ORG_OWNER'],
    '/dashboard/centres': ['ORG_OWNER', 'MANAGER'],
    '/dashboard/bookings/new': ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'],
    '/dashboard/booking-link': ['ORG_OWNER', 'MANAGER'],
    // Student data — tutors cannot access
    '/dashboard/students': ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'],
    '/dashboard/registrations': ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'],
};


export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        return redirect('/login');
    }

    // Google users who haven't completed onboarding yet
    if (!(session.user as any).organisationId) {
        return redirect('/onboarding');
    }

    const userRole = (session.user as any).role || 'TUTOR';
    const organisationId = (session.user as any).organisationId as string;

    // ── Enforce route-level role restrictions ───────────────────────
    const headersList = await headers();
    const currentPath = headersList.get('x-invoke-path') || headersList.get('x-pathname') || '';
    for (const [prefix, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
        if (currentPath.startsWith(prefix) && !allowedRoles.includes(userRole)) {
            return redirect('/dashboard');
        }
    }

    // Fetch org name for sidebar branding
    let orgName = 'AfterSchool';
    try {
        const [org] = await db
            .select({ name: organisations.name })
            .from(organisations)
            .where(eq(organisations.id, organisationId))
            .limit(1);
        if (org?.name) orgName = org.name;
    } catch {
        // Non-critical — fall back to default
    }

    // Resolve user's accessible centres and selected centre
    const orgCentres = await getUserAccessibleCentres(session.user.id);
    const validCentreIds = orgCentres.map(c => c.id);
    const selectedCentreId = await resolveActiveCentreId(undefined, validCentreIds);

    return (
        <ToastProvider>
            <SidebarProvider>
                <CentreFilterProvider centres={orgCentres} defaultCentreId={selectedCentreId}>
                    {/* Skip to main content - keyboard/screen reader navigation */}
                    <a href="#main-content" className="skip-to-content">
                        Skip to main content
                    </a>
                    <div className="flex min-h-screen bg-surface text-on-surface">
                        {/* Collapsible Sidebar */}
                        <Sidebar
                            userName={session.user?.name || undefined}
                            userRole={userRole}
                            orgName={orgName}
                            centres={orgCentres}
                        />


                        {/* Main Content Area - Responsive margin */}
                        <DashboardContent>
                            {/* Header with Search and Notifications */}
                            <Header
                                userName={session.user?.name || undefined}
                                userInitial={session.user?.name?.[0]?.toUpperCase() || 'A'}
                                userRole={userRole}
                            />

                            {/* Dynamic Page Content */}
                            <main
                                id="main-content"
                                className="p-4 sm:p-8 flex-1 dashboard-main-content"
                                tabIndex={-1}
                            >
                                {children}
                            </main>
                        </DashboardContent>
                    </div>
                </CentreFilterProvider>
            </SidebarProvider>
        </ToastProvider>
    );
}

