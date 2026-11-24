/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
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

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let session: any;
    try {
        session = await requireTenantSession();
    } catch (err) {
        const { OrgNotActiveError } = await import('@/lib/org-approval-guard');
        if (err instanceof OrgNotActiveError) {
            return redirect('/pending-approval');
        }
        throw err;
    }

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

    // ── Subdomain-based routing (read-only — never mutate users during GET renders) ──
    const subdomainHeader = headersList.get('x-subdomain');
    let subdomainCentreId: string | null = null;

    if (subdomainHeader) {
        // 1. Check if it matches a CENTRE subdomain within the user's active organisation
        const matchedCentre = await db.query.centres.findFirst({
            where: eq(centres.subdomain, subdomainHeader),
            columns: { id: true, organisationId: true },
        });

        if (matchedCentre && matchedCentre.organisationId === organisationId) {
            subdomainCentreId = matchedCentre.id;
        } else if (!matchedCentre) {
            // 2. Check if it matches an ORG subdomain; never mutate users.organisationId on GET,
            // and redirect to /pending-approval if the subdomain belongs to an inactive org
            // that the user is a member of.
            const matchedOrg = await db.query.organisations.findFirst({
                where: eq(organisations.subdomain, subdomainHeader),
                columns: { id: true, approvalStatus: true },
            });

            if (matchedOrg && matchedOrg.approvalStatus !== 'ACTIVE') {
                if (matchedOrg.id === organisationId) {
                    return redirect('/pending-approval');
                }
                const { orgMemberships } = await import('@/db/schema');
                const membership = await db.query.orgMemberships.findFirst({
                    where: (m, { and: a, eq: eqFn }) =>
                        a(eqFn(m.userId, session.user!.id), eqFn(m.organisationId, matchedOrg.id)),
                });
                if (membership) {
                    return redirect('/pending-approval');
                }
            }
        }
    }

    // Fetch org name for sidebar branding & accessible centres concurrently
    let orgName = 'AfterSchool';
    const [orgRow, orgCentres] = await Promise.all([
        db
            .select({ name: organisations.name })
            .from(organisations)
            .where(eq(organisations.id, organisationId))
            .limit(1)
            .then(rows => rows[0])
            .catch(() => null),
        getUserAccessibleCentres(session.user.id),
    ]);
    if (orgRow?.name) orgName = orgRow.name;

    const userOrgs = ((session.user as any).userOrgs ?? []) as { id: string; name: string; slug: string; role: string }[];

    // Resolve user's accessible centres and selected centre
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
                    <div className="flex min-h-screen bg-page text-text">
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
                            />

                            {/* Dynamic Page Content */}
                            <main
                                id="main-content"
                                className="p-4 sm:p-8 flex-1 min-w-0 dashboard-main-content"
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
