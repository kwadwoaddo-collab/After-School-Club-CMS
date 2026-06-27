import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Building2, Palette, Image, Mail, Clock, FileText, Wallet } from 'lucide-react';
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
            title: 'Add Centre',
            description: 'Create a new assessment centre',
            icon: Building2,
            color: 'violet',
            href: '/dashboard/centres/add',
        },
        {
            id: 'hours',
            title: 'Opening Hours',
            description: 'Configure operating hours',
            icon: Clock,
            color: 'emerald',
            href: '/dashboard/settings/hours',
        },
        {
            id: 'branding',
            title: 'Logo & Colours',
            description: 'Customise your branding',
            icon: Palette,
            color: 'cyan',
            href: '/dashboard/settings/branding',
        },
        {
            id: 'finance',
            title: 'Finance & Pricing',
            description: 'Configure fee amounts',
            icon: Wallet,
            color: 'amber',
            href: '/dashboard/settings/finance',
        },
        {
            id: 'registration-terms',
            title: 'Registration T&Cs',
            description: 'Edit terms on the registration form',
            icon: FileText,
            color: 'blue',
            href: '/dashboard/settings/registration',
        },
    ];

    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
        cyan:    { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'border-cyan-500/20'    },
        amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20'   },
        blue:    { bg: 'bg-primary/10',      text: 'text-primary',     border: 'border-primary/20'     },
    };

    return (
        <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
                <p className="text-sm text-on-surface-variant mt-0.5">Manage your organisation settings and preferences</p>
            </div>

            {/* Organisation Info */}
            <OrganisationInfoForm
                org={{
                    name: org.name,
                    slug: org.slug,
                    contactEmail: org.contactEmail,
                    contactPhone: org.contactPhone,
                    address: org.address,
                }}
                baseUrl={process.env.NEXT_PUBLIC_BASE_URL || ''}
            />

            {/* Quick Links Grid */}
            <div>
                <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-3">Customisation</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {settingsSections.map((section) => {
                        const c = colorMap[section.color];
                        return (
                            <Link
                                key={section.id}
                                href={section.href}
                                className="bg-surface-container-high border border-outline-variant/10 rounded-2xl p-4 hover:border-outline-variant/30 transition-all group"
                            >
                                <div className={`w-9 h-9 ${c.bg} ${c.border} border rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                    <section.icon className={`w-4.5 h-4.5 ${c.text}`} />
                                </div>
                                <p className="text-sm font-bold text-white leading-tight">{section.title}</p>
                                <p className="text-xs text-on-surface-variant mt-0.5">{section.description}</p>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Data & Privacy */}
            <div>
                <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-3">Data & Privacy</h2>
                <GdprExportButton />
            </div>

            {/* Support */}
            <div className="bg-surface-container-high border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">Need help?</p>
                    <p className="text-xs text-on-surface-variant">Our support team is here for any questions.</p>
                </div>
                <a
                    href="mailto:support@sprintscaleit.co.uk"
                    className="flex-shrink-0 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-all"
                >
                    Contact Support
                </a>
            </div>
        </div>
    );
}
