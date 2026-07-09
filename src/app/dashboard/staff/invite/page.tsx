'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, UserPlus, Shield, MapPin, Building2 } from 'lucide-react';

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
            .catch(console.error);
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
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const roles = [
        {
            value: 'MANAGER',
            label: 'Manager',
            description: 'Can manage bookings, students, and assigned centres',
            color: 'blue',
        },
        {
            value: 'FRONT_DESK',
            label: 'Front Desk',
            description: 'Can manage bookings and check-in students',
            color: 'green',
        },
        {
            value: 'TUTOR',
            label: 'Tutor',
            description: 'Can view sessions and add feedback',
            color: 'amber',
        },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Back Button */}
            <Link
                href="/dashboard/staff"
                className="inline-flex items-center gap-2 text-on-surface-variant hover:text-white font-medium transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Team
            </Link>

            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Invite Staff Member</h1>
                <p className="text-on-surface-variant font-medium mt-1">
                    Add a new team member and assign them to specific centres
                </p>
            </div>

            {/* Info Card */}
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6">
                <div className="flex gap-4">
                    <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                        <h3 className="font-bold text-primary mb-1">Centre-Level Access</h3>
                        <p className="text-sm text-primary/80 leading-relaxed">
                            After inviting, you'll assign this staff member to specific centres.
                            They'll only see bookings and students from their assigned centres.
                        </p>
                    </div>
                </div>
            </div>

            {/* Invitation Form */}
            <form onSubmit={handleSubmit} className="bg-surface-container-high rounded-[32px] overflow-hidden border border-outline-variant/10 shadow-xl">
                <div className="px-8 py-6 border-b border-outline-variant/10">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-on-surface-variant" />
                        <h2 className="text-lg font-bold text-white">Staff Details</h2>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {error && (
                        <div className="p-4 bg-error-container/10 border border-error/20 rounded-xl text-error font-bold text-sm">
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">
                            Email Address *
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-12 pr-4 py-3 bg-[#13151a] border border-[#2a2d35] rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                placeholder="staff@example.com"
                                required
                            />
                        </div>
                        <p className="text-xs text-on-surface-variant mt-2">
                            They'll receive an invitation email to set up their account
                        </p>
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">
                                First Name
                            </label>
                            <input
                                type="text"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                className="w-full px-4 py-3 bg-[#13151a] border border-[#2a2d35] rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                placeholder="John"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">
                                Last Name
                            </label>
                            <input
                                type="text"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                className="w-full px-4 py-3 bg-[#13151a] border border-[#2a2d35] rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                placeholder="Doe"
                            />
                        </div>
                    </div>

                    {/* Centre Selection */}
                    {centres.length > 0 && (
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">
                                <span className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-on-surface-variant" />
                                    Primary Centre (optional)
                                </span>
                            </label>
                            <select
                                value={formData.centreId}
                                onChange={(e) => setFormData({ ...formData, centreId: e.target.value })}
                                className="w-full px-4 py-3 bg-[#13151a] border border-[#2a2d35] rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all [&>option]:bg-surface-container-high"
                            >
                                <option value="" className="text-slate-500">Select a centre (optional)</option>
                                {centres.map((centre) => (
                                    <option key={centre.id} value={centre.id}>
                                        {centre.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-on-surface-variant mt-2">
                                The invitation email will mention this centre. You can assign more centres after they join.
                            </p>
                        </div>
                    )}

                    {/* Role Selection */}
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-3">
                            Role *
                        </label>
                        <div className="space-y-3">
                            {roles.map((role) => (
                                <label
                                    key={role.value}
                                    className={`flex items-start gap-4 p-4 border-2 rounded-2xl cursor-pointer transition-all ${formData.role === role.value
                                        ? 'border-primary bg-primary/10'
                                        : 'border-outline-variant/10 hover:border-outline-variant/30'
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
                                        <div className="font-bold text-white mb-1">{role.label}</div>
                                        <div className="text-sm text-slate-400">{role.description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Note about centre assignment */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                        <div className="flex gap-3">
                            <MapPin className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-amber-500 text-sm mb-1">
                                    Centre Assignment - Next Step
                                </h4>
                                <p className="text-xs text-amber-500/80 leading-relaxed font-medium">
                                    After sending the invitation, you'll be able to assign this staff member to
                                    specific centres. They'll only have access to data from those centres.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="px-8 py-6 border-t border-outline-variant/10 flex items-center justify-between">
                    <Link
                        href="/dashboard/staff"
                        className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:bg-[#2a2d35] disabled:shadow-none shadow-lg shadow-primary/30 glow-btn"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
