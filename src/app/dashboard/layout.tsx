import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { SidebarProvider } from '@/components/dashboard/SidebarContext';
import DashboardContent from '@/components/dashboard/DashboardContent';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        return redirect('/login');
    }

    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-[#f8fafc]">
                {/* Collapsible Sidebar */}
                <Sidebar userName={session.user?.name || undefined} />

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
