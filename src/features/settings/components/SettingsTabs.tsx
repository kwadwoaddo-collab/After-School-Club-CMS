'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import { Building2, Palette, Clock, FileText, Wallet, Tag, ShieldCheck, GraduationCap, RefreshCw } from 'lucide-react';
import OrganisationInfoForm from './OrganisationInfoForm';
import CentreHoursTab from './CentreHoursTab';
import BrandingForm from './BrandingForm';
import FinancePricingForm from './FinancePricingForm';
import RegistrationTermsForm from './RegistrationTermsForm';
import DiscountsForm from './DiscountsForm';
import GdprExportButton from '@/app/dashboard/settings/GdprExportButton';
import { rollSchoolYearsAction } from '@/features/students/roll-actions';

interface SettingsTabsProps {
    org: {
        id: string;
        name: string;
        slug: string;
        contactEmail?: string | null;
        contactPhone?: string | null;
        address?: string | null;
        brandColor?: string | null;
        logoUrl?: string | null;
    };
    centres: unknown[];
    baseUrl: string;
}

type TabType = 'general' | 'hours' | 'branding' | 'finance' | 'registration' | 'discounts';

export default function SettingsTabs({ org, centres, baseUrl }: SettingsTabsProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTabParam = searchParams.get('tab') as TabType | null;

    const [activeTab, setActiveTab] = useState<TabType>(activeTabParam || 'general');
    const { toast } = useToast();
    const [isRolling, setIsRolling] = useState(false);

    const handleRollSchoolYears = async () => {
        const confirmRoll = window.confirm(
            "Are you sure you want to roll the school years forward (+1) for all students in your organisation? " +
            "This will increment nursery, reception, and numeric years by 1, and mark Year 13 students as 'Graduated'. " +
            "This action cannot be undone."
        );
        if (!confirmRoll) return;

        setIsRolling(true);
        try {
            const res = await rollSchoolYearsAction();
            if (res.success) {
                toast({ title: 'School Years Rolled', message: res.message, variant: 'success' });
            } else {
                toast({ title: 'Error', message: res.message, variant: 'error' });
            }
        } catch (err) {
            toast({ title: 'Error', message: err.message || 'Failed to roll school years.', variant: 'error' });
        } finally {
            setIsRolling(false);
        }
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        // Update URL search parameters without full reload
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('tab', tab);
        router.push(`?${newParams.toString()}`);
    };

    const tabs = [
        { id: 'general', label: 'General Info', icon: Building2, description: 'Organization name & contact info' },
        { id: 'hours', label: 'Operating Hours', icon: Clock, description: 'Hours & session slots' },
        { id: 'branding', label: 'Branding & Theme', icon: Palette, description: 'Brand color & logotype' },
        { id: 'finance', label: 'Finance & Pricing', icon: Wallet, description: 'Standard & assisted rates' },
        { id: 'registration', label: 'Registration Form', icon: FileText, description: 'Registration form T&Cs' },
        { id: 'discounts', label: 'Discount Rules', icon: Tag, description: 'Sibling & custom discount rules' },
    ] as const;

    const formattedCentres = centres.map(c => ({
        ...c,
        feeSelfFinance: c.feeSelfFinance ? Number(c.feeSelfFinance) : null,
        feeAssistedFinance: c.feeAssistedFinance ? Number(c.feeAssistedFinance) : null,
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1 flex flex-col gap-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                                isActive
                                    ? 'bg-primary/10 border-primary/30 text-primary font-extrabold shadow-md shadow-primary/5'
                                    : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:border-border/50'
                            }`}
                        >
                            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                            <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider leading-none mb-1">{tab.label}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight truncate">{tab.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Main Content Pane */}
            <div className="lg:col-span-3 min-h-[500px]">
                <div className="bg-card border border-border shadow-sm rounded-3xl p-6 sm:p-8 shadow-xl">
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-foreground tracking-tight">Organization Profile</h2>
                                <p className="text-sm text-muted-foreground mt-1">Configure your organization details and workspace details.</p>
                            </div>
                            <OrganisationInfoForm org={org} baseUrl={baseUrl} />
                            
                            <div className="pt-6 border-t border-border/50 space-y-4">
                                <div className="flex items-center gap-2 text-foreground">
                                    <ShieldCheck className="w-5 h-5 text-success" />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Privacy &amp; Compliance</h3>
                                </div>
                                <p className="text-xs text-muted-foreground">Export all stored records for GDPR portability requests.</p>
                                <GdprExportButton />
                            </div>

                            <div className="pt-6 border-t border-border/50 space-y-4">
                                <div className="flex items-center gap-2 text-foreground">
                                    <GraduationCap className="w-5 h-5 text-primary" />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Academic Year Rollover</h3>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Increment the school year for all active students in your organisation by +1 (e.g. Year 1 ➔ Year 2, Nursery ➔ Reception, Year 13 ➔ Graduated). This happens automatically on September 1st, but you can manually trigger it here.
                                </p>
                                <button
                                    onClick={handleRollSchoolYears}
                                    disabled={isRolling}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-secondary/60 hover:bg-secondary border border-border text-foreground rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95 duration-100 cursor-pointer"
                                >
                                    {isRolling ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Rolling Years...</span>
                                        </>
                                    ) : (
                                        <>
                                            <GraduationCap className="w-3.5 h-3.5" />
                                            <span>Roll School Years (+1)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'hours' && (
                        <div className="animate-in fade-in duration-300">
                            <CentreHoursTab centres={centres} />
                        </div>
                    )}

                    {activeTab === 'branding' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-foreground tracking-tight">Branding &amp; Visual Design</h2>
                                <p className="text-sm text-muted-foreground mt-1">Customize visual styles for parent facing registration &amp; booking pages.</p>
                            </div>
                            <BrandingForm initialColor={org.brandColor || '#136dec'} logoUrl={org.logoUrl} />
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-foreground tracking-tight">Finance &amp; Pricing Rules</h2>
                                <p className="text-sm text-muted-foreground mt-1">Manage standard pricing rules and assisted session values.</p>
                            </div>
                            <FinancePricingForm centres={formattedCentres} />
                        </div>
                    )}

                    {activeTab === 'registration' && (
                        <div className="animate-in fade-in duration-300">
                            <RegistrationTermsForm />
                        </div>
                    )}

                    {activeTab === 'discounts' && (
                        <div className="animate-in fade-in duration-300">
                            <DiscountsForm />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
