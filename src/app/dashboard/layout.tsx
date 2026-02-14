import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    School,
    Users,
    CalendarCheck,
    CreditCard,
    Settings,
    Search,
    Bell,
    User,
    PlusCircle,
    CheckCircle2
} from 'lucide-react';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        return redirect('/login');
    }

    const navItems = [
        { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
        { name: 'Centres', icon: School, href: '/dashboard/centres' },
        { name: 'Students', icon: Users, href: '/dashboard/students' },
        // { name: 'Attendance', icon: CalendarCheck, href: '/dashboard/attendance' },
        // { name: 'Payments', icon: CreditCard, href: '/dashboard/payments' },
        { name: 'Settings', icon: Settings, href: '/dashboard/settings' },
    ];

    return (
        <div className="flex min-h-screen bg-[#f8fafc]">
            {/* Sidebar - Midnight Blue Gradient */}
            <aside className="w-64 sidebar-gradient text-white flex flex-col fixed inset-y-0 left-0 z-50">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20">
                            AS
                        </div>
                        <span className="text-xl font-bold tracking-tight">AfterSchool</span>
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all group"
                            >
                                <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span className="font-medium">{item.name}</span>
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-6">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">Quick Support</p>
                        <p className="text-sm text-slate-300">Need help with bookings or payments?</p>
                        <button className="mt-3 text-xs font-bold text-primary hover:text-blue-400 transition-colors">
                            CONTACT SUPPORT →
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 ml-64 flex flex-col">
                {/* Header - Glassmorphism */}
                <header className="h-20 glass-panel sticky top-0 z-40 px-8 flex items-center justify-between border-b border-slate-200/50">
                    <div className="flex-1 max-w-xl">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search students, bookings (Cmd + K)"
                                className="w-full pl-11 pr-4 py-2.5 bg-slate-100/50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 relative transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3 pl-2">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-900 leading-none">{session.user?.name || 'Admin User'}</p>
                                <p className="text-xs font-medium text-slate-500 mt-1">Admin</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                                {session.user?.name?.[0].toUpperCase() || 'A'}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dynamic Page Content */}
                <main className="p-8 flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
}
