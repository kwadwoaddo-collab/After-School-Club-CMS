'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import { Building2, Palette, Clock, FileText, Wallet, Tag, ShieldCheck, GraduationCap, RefreshCw } from 'lucide-react';
import type { InferSelectModel } from 'drizzle-orm';
import type { centres as centresTable } from '@/db/schema';
import OrganisationInfoForm from './OrganisationInfoForm';
import CentreHoursTab from './CentreHoursTab';
import BrandingForm from './BrandingForm';
import FinancePricingForm from './FinancePricingForm';
import RegistrationTermsForm from './RegistrationTermsForm';
import DiscountsForm, { type DiscountRule } from './DiscountsForm';
import GdprExportButton from '@/app/dashboard/settings/GdprExportButton';
import { rollSchoolYearsAction } from '@/features/students/roll-actions';
import ConfirmModal from '@/components/ui/ConfirmModal';

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
        registrationTerms?: string | null;
        discountRules?: DiscountRule[];
    };
    centres: InferSelectModel<typeof centresTable>[];
    baseUrl: string;
    isOwner?: boolean;
}

type TabType = 'general' | 'hours' | 'branding' | 'finance' | 'registration' | 'discounts' | 'danger_zone';

export default function SettingsTabs({ org, centres, baseUrl, isOwner = true }: SettingsTabsProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTabParam = searchParams.get('tab') as TabType | null;

    const initialTab = activeTabParam && (isOwner || (activeTabParam !== 'danger_zone' && activeTabParam !== 'branding'))
        ? activeTabParam
        : 'general';

    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const { toast } = useToast();
    const [isRolling, setIsRolling] = useState(false);
    const [isRollModalOpen, setIsRollModalOpen] = useState(false);

    const performRoll = async () => {
        setIsRolling(true);
        try {
            const res = await rollSchoolYearsAction();
            if (res.success) {
                toast({ title: 'School Years Rolled', message: res.message, variant: 'success' });
            } else {
                toast({ title: 'Error', message: res.message, variant: 'error' });
            }
        } catch (err) {
            toast({ title: 'Error', message: err instanceof Error ? err.message : 'Failed to roll school years.', variant: 'error' });
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

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        let nextIndex = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            nextIndex = (index + 1) % tabs.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            nextIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (e.key === 'Home') {
            e.preventDefault();
            nextIndex = 0;
        } else if (e.key === 'End') {
            e.preventDefault();
            nextIndex = tabs.length - 1;
        }
        if (nextIndex >= 0) {
            const nextTab = tabs[nextIndex];
            handleTabChange(nextTab.id as TabType);
            const nextEl = document.getElementById(`settings-tab-${nextTab.id}`);
            nextEl?.focus();
        }
    };


    const allTabs = [
        { id: 'general', label: 'General Info', icon: Building2, description: 'Organisation name & contact info' },
        { id: 'hours', label: 'Operating Hours', icon: Clock, description: 'Hours & session slots' },
        { id: 'branding', label: 'Branding & Theme', icon: Palette, description: 'Brand colour & logotype' },
        { id: 'finance', label: 'Finance & Pricing', icon: Wallet, description: 'Standard & assisted rates' },
        { id: 'registration', label: 'Registration Form', icon: FileText, description: 'Registration form T&Cs' },
        { id: 'discounts', label: 'Discount Rules', icon: Tag, description: 'Sibling & custom discount rules' },
        { id: 'danger_zone', label: 'Danger Zone', icon: ShieldCheck, description: 'Data management' },
    ] as const;

    const tabs = isOwner
        ? allTabs
        : allTabs.filter(t => t.id !== 'danger_zone' && t.id !== 'branding');

    const formattedCentres = centres.map(c => ({
        ...c,
        feeSelfFinance: c.feeSelfFinance ? Number(c.feeSelfFinance) : null,
        feeAssistedFinance: c.feeAssistedFinance ? Number(c.feeAssistedFinance) : null,
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div
                role="tablist"
                aria-label="Workspace settings sections"
                className="lg:col-span-1 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 -mx-1 px-1"
            >
                {tabs.map((tab, index) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`settings-tab-${tab.id}`}
                            role="tab"
                            type="button"
                            aria-selected={isActive}
                            aria-controls={`settings-panel-${tab.id}`}
                            tabIndex={isActive ? 0 : -1}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            onClick={() => handleTabChange(tab.id as TabType)}
                            className={`min-h-11 shrink-0 flex items-center lg:items-start gap-2.5 lg:gap-3 px-3.5 py-2.5 lg:p-3 rounded-lg border text-left transition-colors whitespace-nowrap lg:whitespace-normal ${
                                isActive
                                    ? 'bg-accent-soft border-accent/30 text-accent font-semibold'
                                    : 'bg-transparent border-transparent text-text-secondary hover:text-text hover:bg-surface'
                            }`}
                        >
                            <Icon className={`w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0 lg:mt-0.5 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-semibold leading-tight">{tab.label}</p>
                                <p className="hidden lg:block text-xs text-text-muted font-normal mt-0.5 truncate">{tab.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Main Content Pane */}
            <div className="lg:col-span-3 min-h-[500px]">
                <div
                    id={`settings-panel-${activeTab}`}
                    role="tabpanel"
                    aria-labelledby={`settings-tab-${activeTab}`}
                    className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs"
                >
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-text tracking-tight">Organisation Profile</h2>
                                <p className="text-sm text-text-muted mt-1">Configure your organisation details and workspace details.</p>
                            </div>
                            <OrganisationInfoForm org={org} baseUrl={baseUrl} isOwner={isOwner} />
                        </div>
                    )}

                    {activeTab === 'hours' && (
                        <div className="animate-in fade-in duration-300">
                            <CentreHoursTab centres={centres} />
                        </div>
                    )}

                    {activeTab === 'branding' && isOwner && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-text tracking-tight">Branding &amp; Visual Design</h2>
                                <p className="text-sm text-text-muted mt-1">Customize visual styles for parent facing registration &amp; booking pages.</p>
                            </div>
                            <BrandingForm initialColor={org.brandColor || '#136dec'} logoUrl={org.logoUrl} />
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-text tracking-tight">Finance &amp; Pricing Rules</h2>
                                <p className="text-sm text-text-muted mt-1">Manage standard pricing rules and assisted session values.</p>
                            </div>
                            <FinancePricingForm centres={formattedCentres} />
                        </div>
                    )}

                    {activeTab === 'registration' && (
                        <div className="animate-in fade-in duration-300">
                            <RegistrationTermsForm initialTerms={org.registrationTerms || ''} orgSlug={org.slug} />
                        </div>
                    )}

                    {activeTab === 'discounts' && (
                        <div className="animate-in fade-in duration-300">
                            <DiscountsForm initialRules={org.discountRules || []} />
                        </div>
                    )}

                    {activeTab === 'danger_zone' && isOwner && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-red-500 tracking-tight">Danger Zone</h2>
                                <p className="text-sm text-text-muted mt-1">Data management and irreversible actions.</p>
                            </div>
                            
                            <div className="pt-2 space-y-4">
                                <div className="flex items-center gap-2 text-text">
                                    <ShieldCheck className="w-5 h-5 text-success" />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Privacy &amp; Compliance</h3>
                                </div>
                                <p className="text-xs text-text-muted">Export all stored records for GDPR portability requests.</p>
                                <GdprExportButton />
                            </div>

                            <div className="pt-6 border-t border-border space-y-4">
                                <div className="flex items-center gap-2 text-text">
                                    <GraduationCap className="w-5 h-5 text-accent" />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Academic Year Rollover</h3>
                                </div>
                                <p className="text-xs text-text-muted leading-relaxed">
                                    Increment the school year for all active students in your organisation by +1 (e.g. Year 1 ➔ Year 2, Nursery ➔ Reception, Year 13 ➔ Graduated). This happens automatically on September 1st, but you can manually trigger it here.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setIsRollModalOpen(true)}
                                    disabled={isRolling}
                                    className="flex items-center gap-2 px-4 py-2.5 min-h-11 sm:min-h-9 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 rounded-md text-xs font-bold transition-all disabled:opacity-50 active:scale-95 duration-100 cursor-pointer"
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
                </div>
            </div>
            
            <ConfirmModal 
                isOpen={isRollModalOpen}
                onClose={() => setIsRollModalOpen(false)}
                onConfirm={performRoll}
                title="Roll School Years"
                description="Are you sure you want to roll the school years forward (+1) for all students in your organisation? This will increment nursery, reception, and numeric years by 1, and mark Year 13 students as 'Graduated'. This action cannot be undone."
                confirmText="Yes, Roll Years"
                variant="danger"
            />
        </div>
    );
}
