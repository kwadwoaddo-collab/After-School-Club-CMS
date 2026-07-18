'use client';

import { useState } from 'react';
import { 
    CreditCard, 
    Users, 
    History, 
    ChevronRight, 
    Mail, 
    Phone, 
    MapPin,
    Baby,
    TrendingUp,
    AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { InvoiceTable } from '@/features/finance/components/FinanceDashboardClient';

interface ParentProfileClientProps {
    parent: any;
    invoices: any[];
    stats: {
        totalOwed: number;
        totalPaid: number;
        outstanding: number;
    };
    isOwner?: boolean;
}

export default function ParentProfileClient({ parent, invoices, stats, isOwner }: ParentProfileClientProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'finance'>('finance'); // Default to finance as per Task 73

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 bg-card rounded-2xl w-fit border border-outline-variant/10">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        activeTab === 'overview' 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    Overview
                </button>
                <button 
                    onClick={() => setActiveTab('finance')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        activeTab === 'finance' 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    Finance / Ledger
                </button>
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Contact Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="glassmorphic-card rounded-[40px] p-8 space-y-6">
                            <h3 className="text-sm font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">Contact Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-secondary/40 flex items-center justify-center text-primary">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Email Address</p>
                                        <p className="font-bold text-white">{parent.email || 'Not provided'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-secondary/40 flex items-center justify-center text-primary">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Phone Number</p>
                                        <p className="font-bold text-white">{parent.phone || 'Not provided'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 md:col-span-2">
                                    <div className="w-10 h-10 rounded-xl bg-secondary/40 flex items-center justify-center text-primary">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Billing Address</p>
                                        <p className="font-bold text-white">
                                            {parent.addressLine1 ? `${parent.addressLine1}, ${parent.city || ''} ${parent.postcode || ''}` : 'No address on file'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Children List */}
                        <div className="glassmorphic-card rounded-[40px] p-8">
                            <h3 className="text-sm font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">Associated Children</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {parent.children?.map((child: any) => (
                                    <Link 
                                        key={child.id}
                                        href={`/dashboard/students/${child.id}`}
                                        className="flex items-center justify-between p-4 bg-secondary/40 border border-outline-variant/5 rounded-2xl hover:bg-primary/5 hover:border-primary/20 transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-secondary/40 flex items-center justify-center text-emerald-400">
                                                <Baby className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{child.firstName} {child.lastName}</p>
                                                <p className="text-xs text-on-surface-variant">Year {child.schoolYear}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-all" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-primary/10 border border-primary/20 rounded-[40px] p-8 text-center relative overflow-hidden ring-1 ring-primary/30">
                            <div className="relative z-10">
                                <TrendingUp className="w-10 h-10 text-primary mx-auto mb-4" />
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Current Balance</p>
                                <h2 className={`text-4xl font-black ${stats.outstanding > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                                    £{stats.outstanding.toFixed(2)}
                                </h2>
                                <p className="text-xs text-on-surface-variant mt-2 font-bold uppercase tracking-widest">Outstanding amount</p>
                            </div>
                        </div>

                        <div className="glassmorphic-card rounded-[40px] p-6 space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Invoiced</span>
                                <span className="font-bold text-white">£{stats.totalOwed.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-border/30" />
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Paid</span>
                                <span className="font-bold text-emerald-400">£{stats.totalPaid.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'finance' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats strip for Finance tab */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glassmorphic-card p-6 rounded-3xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Family Billing</p>
                                <p className="text-xl font-black text-white mt-1">£{stats.totalOwed.toFixed(2)}</p>
                            </div>
                            <CreditCard className="w-8 h-8 text-primary/40" />
                        </div>
                        <div className="glassmorphic-card p-6 rounded-3xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Paid to Date</p>
                                <p className="text-xl font-black text-emerald-400 mt-1">£{stats.totalPaid.toFixed(2)}</p>
                            </div>
                            <History className="w-8 h-8 text-emerald-400/40" />
                        </div>
                        <div className={`p-6 border rounded-3xl flex items-center justify-between ${stats.outstanding > 0 ? 'bg-rose-500/5 border-rose-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${stats.outstanding > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>Amount Due</p>
                                <p className={`text-xl font-black mt-1 ${stats.outstanding > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>£{stats.outstanding.toFixed(2)}</p>
                            </div>
                            <AlertCircle className={`w-8 h-8 ${stats.outstanding > 0 ? 'text-rose-500/40' : 'text-emerald-400/40'}`} />
                        </div>
                    </div>

                    {/* Full Ledger Table */}
                    <div className="glassmorphic-card rounded-[40px] overflow-hidden">
                        <div className="px-8 py-6 border-b border-outline-variant/5 bg-secondary/40/50">
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Transaction History</h3>
                            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">Consolidated family invoices and payments</p>
                        </div>
                        <InvoiceTable invoices={invoices} isOwner={isOwner} />
                    </div>
                </div>
            )}
        </div>
    );
}
