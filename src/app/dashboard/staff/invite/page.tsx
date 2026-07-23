'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, UserPlus, Shield, MapPin, Building2, AlertCircle } from 'lucide-react';

import { logger } from '@/lib/logger';

export default function InviteStaffPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: '',
        role: 'FRONT_DESK' as 'MANAGER' | 'FRONT_DESK' | 'TUTOR',
        firstName: '',
        lastName: '',
        centreId: '',
    });
    const [centres, setCentres] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Fetch centres for the dropdown
        fetch('/api/centres')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCentres(data);
                else if (data.centres) setCentres(data.centres);
            })
            .catch(err => logger.error('Failed to fetch centres:', err));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/staff/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to send invitation');
            }

            router.push('/dashboard/staff?invited=true');
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const roles = [
        {
            value: 'MANAGER',
            label: 'Manager',
            description: 'Can manage bookings, students, and assigned centres',
        },
        {
            value: 'FRONT_DESK',
            label: 'Front Desk',
            description: 'Can manage bookings and check-in students',
        },
        {
            value: 'TUTOR',
            label: 'Tutor',
            description: 'Can view sessions and add feedback',
        },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Back Button */}
            <Link
                href="/dashboard/staff"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-medium transition-all active:scale-95 duration-100"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Team
            </Link>

            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Invite Staff Member</h1>
                <p className="text-muted-foreground font-medium mt-1">
                    Add a new team member and assign them to specific centres
                </p>
            </div>

            {/* Info Card */}
            <div className="bg-card border border-border shadow-sm rounded-2xl p-6">
                <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground mb-1">Centre-Level Access</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            After inviting, you'll assign this staff member to specific centres.
                            They'll only see bookings and students from their assigned centres.
                        </p>
                    </div>
                </div>
            </div>

            {/* Invitation Form */}
            <form onSubmit={handleSubmit} className="bg-card rounded-3xl overflow-hidden border border-border shadow-xl">
                <div className="px-8 py-6 border-b border-border">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-muted-foreground" />
                        <h2 className="text-lg font-bold text-foreground">Staff Details</h2>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {error && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-bold text-sm">
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-bold text-foreground mb-2">
                            Email Address *
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-12 pr-4 py-3 bg-secondary border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                placeholder="staff@example.com"
                                required
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            They'll receive an invitation email to set up their account
                        </p>
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-foreground mb-2">
                                First Name
                            </label>
                            <input
                                type="text"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                className="w-full px-4 py-3 bg-secondary border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                placeholder="John"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                                Optional — invitee will be prompted on first login
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-foreground mb-2">
                                Last Name
                            </label>
                            <input
                                type="text"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                className="w-full px-4 py-3 bg-secondary border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                placeholder="Doe"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                                Optional — invitee will be prompted on first login
                            </p>
                        </div>
                    </div>

                    {/* Centre Selection */}
                    {centres.length > 0 && (
                        <div>
                            <label className="block text-sm font-bold text-foreground mb-2">
                                <span className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                    Primary Centre (optional)
                                </span>
                            </label>
                            <select
                                value={formData.centreId}
                                onChange={(e) => setFormData({ ...formData, centreId: e.target.value })}
                                className="w-full px-4 py-3 bg-secondary border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all [&>option]:bg-card"
                            >
                                <option value="" className="text-muted-foreground">Select a centre (optional)</option>
                                {centres.map((centre) => (
                                    <option key={centre.id} value={centre.id}>
                                        {centre.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground mt-2">
                                The invitation email will mention this centre. You can assign more centres after they join.
                            </p>
                            {!formData.centreId && formData.role !== 'MANAGER' && (
                                <p className="mt-1.5 text-[10px] font-bold text-warning flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    This staff member will have no data access until you assign a centre.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Role Selection */}
                    <div>
                        <label className="block text-sm font-bold text-foreground mb-3">
                            Role *
                        </label>
                        <div className="space-y-3">
                            {roles.map((role) => (
                                <label
                                    key={role.value}
                                    className={`flex items-start gap-4 p-4 border-2 rounded-2xl cursor-pointer transition-all active:scale-[0.99] duration-100 ${formData.role === role.value
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/30'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={role.value}
                                        checked={formData.role === role.value}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                role: e.target.value as any,
                                            })
                                        }
                                        className="mt-1 accent-primary"
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold text-foreground mb-1">{role.label}</div>
                                        <div className="text-sm text-muted-foreground">{role.description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Note about centre assignment */}
                    <div className="bg-card border border-border shadow-sm rounded-2xl p-4">
                        <div className="flex gap-3">
                            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground text-sm mb-1">
                                    Centre Assignment - Next Step
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                    After sending the invitation, you'll be able to assign this staff member to
                                    specific centres. They'll only have access to data from those centres.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="px-8 py-6 border-t border-border flex items-center justify-between">
                    <Link
                        href="/dashboard/staff"
                        className="px-6 py-3 text-muted-foreground hover:text-foreground font-bold transition-all active:scale-95 duration-100"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-all active:scale-95 duration-100 disabled:opacity-50 disabled:bg-secondary disabled:shadow-none shadow-lg shadow-primary/30 glow-btn"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                Sending Invitation...
                            </>
                        ) : (
                            <>
                                <Mail className="w-5 h-5" />
                                Send Invitation
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
