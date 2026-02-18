import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { SidebarProvider } from '@/components/dashboard/SidebarContext';
import DashboardContent from '@/components/dashboard/DashboardContent';

// Which roles can access which route prefixes
const ROUTE_PERMISSIONS: Record<string, string[]> = {
    '/dashboard/staff': ['ORG_OWNER'],
    '/dashboard/settings': ['ORG_OWNER'],
    '/dashboard/centres': ['ORG_OWNER', 'MANAGER'],
    '/dashboard/bookings/new': ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'],
    '/dashboard/booking-link': ['ORG_OWNER', 'MANAGER'],
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

    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-[#f8fafc]">
                {/* Collapsible Sidebar */}
                <Sidebar
                    userName={session.user?.name || undefined}
                    userRole={userRole}
                />

                {/* Main Content Area - Responsive margin */}
                <DashboardContent>
                    {/* Header with Search and Notifications */}
                    <Header
                        userName={session.user?.name || undefined}
                        userInitial={session.user?.name?.[0].toUpperCase() || 'A'}
                    />

                    {/* Dynamic Page Content */}
                    <main className="p-4 sm:p-8 flex-1">
                        {children}
                    </main>
                </DashboardContent>
            </div>
        </SidebarProvider>
    );
}
