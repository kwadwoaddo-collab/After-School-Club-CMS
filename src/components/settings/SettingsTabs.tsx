'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Building2, Palette, Clock, FileText, Wallet, Tag, ShieldCheck } from 'lucide-react';
import OrganisationInfoForm from './OrganisationInfoForm';
import CentreHoursTab from './CentreHoursTab';
import BrandingForm from './BrandingForm';
import FinancePricingForm from './FinancePricingForm';
import RegistrationTermsForm from './RegistrationTermsForm';
import DiscountsForm from './DiscountsForm';
import GdprExportButton from '@/app/dashboard/settings/GdprExportButton';

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
    centres: any[];
    baseUrl: string;
}

type TabType = 'general' | 'hours' | 'branding' | 'finance' | 'registration' | 'discounts';

export default function SettingsTabs({ org, centres, baseUrl }: SettingsTabsProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTabParam = searchParams.get('tab') as TabType | null;

    const [activeTab, setActiveTab] = useState<TabType>(activeTabParam || 'general');

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
                                    : 'bg-transparent border-transparent text-[#8c909f] hover:text-white hover:bg-white/5 hover:border-white/5'
                            }`}
                        >
                            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-[#8c909f]'}`} />
                            <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider leading-none mb-1">{tab.label}</p>
                                <p className="text-[10px] text-[#8c909f] leading-tight truncate">{tab.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Main Content Pane */}
            <div className="lg:col-span-3 min-h-[500px]">
                <div className="glassmorphic-card rounded-3xl p-6 sm:p-8 shadow-xl">
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Organization Profile</h2>
                                <p className="text-sm text-[#8c909f] mt-1">Configure your organization details and workspace details.</p>
                            </div>
                            <OrganisationInfoForm org={org} baseUrl={baseUrl} />
                            
                            <div className="pt-6 border-t border-white/5 space-y-4">
                                <div className="flex items-center gap-2 text-white">
                                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Privacy &amp; Compliance</h3>
                                </div>
                                <p className="text-xs text-[#8c909f]">Export all stored records for GDPR portability requests.</p>
                                <GdprExportButton />
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
                                <h2 className="text-xl font-bold text-white tracking-tight">Branding &amp; Visual Design</h2>
                                <p className="text-sm text-[#8c909f] mt-1">Customize visual styles for parent facing registration &amp; booking pages.</p>
                            </div>
                            <BrandingForm initialColor={org.brandColor || '#136dec'} logoUrl={org.logoUrl} />
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Finance &amp; Pricing Rules</h2>
                                <p className="text-sm text-[#8c909f] mt-1">Manage standard pricing rules and assisted session values.</p>
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
