import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Building2, Palette, Image, Mail, Clock, FileText, Wallet } from 'lucide-react';
import OrganisationInfoForm from '@/components/settings/OrganisationInfoForm';
import GdprExportButton from './GdprExportButton';

export default async function SettingsPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    if ((session.user as any).role !== 'ORG_OWNER') return redirect('/dashboard');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    const settingsSections = [
        {
            id: 'centres',
            title: 'Add Another Centre',
            description: 'Create a new assessment centre for your organisation',
            icon: Building2,
            color: 'violet',
            href: '/dashboard/centres/add',
        },
        {
            id: 'hours',
            title: 'Centre Opening Hours',
            description: 'Configure operating hours and available time slots',
            icon: Clock,
            color: 'emerald',
            href: '/dashboard/settings/hours',
        },
        {
            id: 'logo',
            title: 'Upload Logo',
            description: 'Customise your organisation\'s branding with a logo',
            icon: Image,
            color: 'cyan',
            href: '/dashboard/settings/branding',
        },
        {
            id: 'colors',
            title: 'Brand Colours',
            description: 'Customise the colour scheme for your booking pages',
            icon: Palette,
            color: 'amber',
            href: '/dashboard/settings/branding',
        },
        {
            id: 'finance',
            title: 'Finance & Pricing',
            description: 'Configure fee amounts for your locations',
            icon: Wallet,
            color: 'emerald',
            href: '/dashboard/settings/finance',
        },
        {
            id: 'registration-terms',
            title: 'Registration Terms & Conditions',
            description: 'Edit the T&Cs shown on the public student registration form',
            icon: FileText,
            color: 'blue',
            href: '/dashboard/settings/registration',
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
                <p className="text-on-surface-variant font-medium mt-1">
                    Manage your organisation settings and preferences
                </p>
            </div>

            {/* Organisation Info Card */}
            <OrganisationInfoForm org={org} baseUrl={process.env.NEXT_PUBLIC_BASE_URL || ''} />

            {/* Settings Options Grid */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4">Customisation Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {settingsSections.map((section) => {
                        const colorClasses = {
                            violet: {
                                bg: 'bg-accent-violet/10',
                                text: 'text-accent-violet',
                                border: 'border-accent-violet/20',
                                hover: 'hover:shadow-[0_0_15px_rgba(167,139,250,0.1)] hover:border-accent-violet/30',
                            },
                            emerald: {
                                bg: 'bg-emerald-500/10',
                                text: 'text-emerald-400',
                                border: 'border-emerald-500/20',
                                hover: 'hover:shadow-[0_0_15px_rgba(52,211,153,0.1)] hover:border-emerald-500/30',
                            },
                            cyan: {
                                bg: 'bg-accent-cyan/10',
                                text: 'text-accent-cyan',
                                border: 'border-accent-cyan/20',
                                hover: 'hover:shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:border-accent-cyan/30',
                            },
                            amber: {
                                bg: 'bg-accent-amber/10',
                                text: 'text-accent-amber',
                                border: 'border-accent-amber/20',
                                hover: 'hover:shadow-[0_0_15px_rgba(251,191,36,0.1)] hover:border-accent-amber/30',
                            },
                            blue: {
                                bg: 'bg-primary/10',
                                text: 'text-primary',
                                border: 'border-primary/20',
                                hover: 'hover:shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:border-primary/30',
                            },
                        };

                        const colors = colorClasses[section.color as keyof typeof colorClasses];

                        return (
                            <Link
                                key={section.id}
                                href={section.href}
                                className={`bg-surface-container-high border border-outline-variant/10 rounded-3xl p-6 transition-all group cursor-pointer ${colors.hover}`}
                            >
                                <div className={`w-12 h-12 ${colors.bg} ${colors.border} rounded-2xl flex items-center justify-center mb-4 border group-hover:scale-110 transition-transform`}>
                                    <section.icon className={`w-6 h-6 ${colors.text}`} />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">
                                    {section.title}
                                </h3>
                                <p className="text-sm text-on-surface-variant font-medium">{section.description}</p>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Data & Privacy */}
            <div>
                <h2 className="text-lg font-bold text-white mb-4">Data &amp; Privacy</h2>
                <GdprExportButton />
            </div>

            {/* Support Section */}
            <div className="bg-surface-container-high rounded-3xl p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">
                            Need Help with Bookings or Payments?
                        </h3>
                        <p className="text-sm text-on-surface-variant font-medium mb-4">
                            Our support team is here to help you with any questions or issues you might have.
                        </p>
                        <a
                            href="mailto:support@afterschool.com"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                        >
                            <Mail className="w-4 h-4" /> Contact Support
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
