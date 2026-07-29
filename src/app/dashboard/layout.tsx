/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';
import { SidebarProvider } from '@/components/dashboard/SidebarContext';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
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
    '/dashboard/share': ['ORG_OWNER', 'MANAGER'],
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

    const headersList = await headers();
    const currentPath = headersList.get('x-invoke-path') 
        || headersList.get('x-pathname')
        || headersList.get('next-url')
        || '';
    for (const [prefix, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
        if (currentPath.startsWith(prefix) && !allowedRoles.includes(userRole)) {
            return redirect('/dashboard');
        }
    }

    // ── Subdomain-based routing ─────────────────────────────────────
    // Middleware sets x-subdomain for org/centre-specific subdomains.
    // We resolve it here (DB access not possible in middleware Edge runtime).
    const subdomainHeader = headersList.get('x-subdomain');
    let subdomainCentreId: string | null = null;

    if (subdomainHeader) {
        // 1. Check if it matches a CENTRE subdomain (e.g. 'dagenham' or 'sydenham')
        const matchedCentre = await db.query.centres.findFirst({
            where: eq(centres.subdomain, subdomainHeader),
            columns: { id: true, organisationId: true },
        });

        if (matchedCentre) {
            // Centre found — will auto-select it if user has access
            subdomainCentreId = matchedCentre.id;
        } else {
            // 2. Check if it matches an ORG subdomain (e.g. 'lewisham')
            const matchedOrg = await db.query.organisations.findFirst({
                where: eq(organisations.subdomain, subdomainHeader),
                columns: { id: true },
            });

            if (matchedOrg && matchedOrg.id !== organisationId) {
                // Switch the user's active org in the DB
                // (session will refresh on next login; this covers the current request)
                const { users, orgMemberships } = await import('@/db/schema');
                const membership = await db.query.orgMemberships.findFirst({
                    where: (m, { and, eq: eqFn }) =>
                        and(eqFn(m.userId, session.user!.id), eqFn(m.organisationId, matchedOrg.id)),
                });
                if (membership) {
                    await db.update(users)
                        .set({ organisationId: matchedOrg.id, role: membership.role })
                        .where(eq(users.id, session.user!.id));
                    // Redirect to dashboard so session re-evaluates with new org
                    return redirect('/dashboard');
                }
            }
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

    const userOrgs = ((session.user as any).userOrgs ?? []) as { id: string; name: string; slug: string; role: string }[];

    // Resolve user's accessible centres and selected centre
    const orgCentres = await getUserAccessibleCentres(session.user.id);
    const validCentreIds = orgCentres.map(c => c.id);

    // If a centre subdomain was detected and the user has access to it, force-select it
    const forcedCentreId = subdomainCentreId && validCentreIds.includes(subdomainCentreId)
        ? subdomainCentreId
        : null;

    const selectedCentreId = forcedCentreId
        ?? await resolveActiveCentreId(undefined, validCentreIds);

    return (
        <ToastProvider>
            <SidebarProvider>
                <CentreFilterProvider centres={orgCentres} defaultCentreId={selectedCentreId}>
                    {/* Skip to main content - keyboard/screen reader navigation */}
                    <a href="#main-content" className="skip-to-content">
                        Skip to main content
                    </a>
                    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
                        {/* Collapsible Sidebar */}
                        <Sidebar
                            userName={session.user?.name || undefined}
                            userRole={userRole}
                            orgName={orgName}
                            orgId={organisationId}
                            userOrgs={userOrgs}
                            centres={orgCentres}
                        />


                        {/* Main Content Area - Responsive margin */}
                        <DashboardContent>
                            {/* Header with Search and Notifications */}
                            <Header
                                userName={session.user?.name || undefined}
                                userInitial={session.user?.name?.[0]?.toUpperCase() || 'A'}
                                userRole={userRole}
                                hideSearch={
                                    currentPath.startsWith('/dashboard/registrations') ||
                                    currentPath.startsWith('/dashboard/bookings') ||
                                    currentPath.startsWith('/dashboard/students')
                                }
                            />

                            {/* Dynamic Page Content */}
                            <main
                                id="main-content"
                                className="p-4 sm:p-8 pb-24 lg:pb-8 flex-1 min-w-0 dashboard-main-content"
                                tabIndex={-1}
                            >
                                {children}
                            </main>
                        </DashboardContent>

                        {/* Mobile Bottom Navigation — shown only on <lg screens */}
                        <MobileBottomNav userRole={userRole} />
                    </div>
                </CentreFilterProvider>
            </SidebarProvider>
        </ToastProvider>
    );
}
