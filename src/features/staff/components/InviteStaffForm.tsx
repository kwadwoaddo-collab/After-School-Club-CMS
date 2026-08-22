'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Mail, UserPlus, Shield, MapPin, Building2, AlertCircle, Loader2 } from 'lucide-react';

import { logger } from '@/lib/logger';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ROLE_LABELS } from '@/lib/staff-constants';

export default function InviteStaffForm() {
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
            setError(err instanceof Error ? err.message : String(err));
            setLoading(false);
        }
    };

    const roleOptions: Array<{ value: 'MANAGER' | 'FRONT_DESK' | 'TUTOR'; description: string }> = [
        { value: 'MANAGER', description: 'Can manage bookings, students, and assigned centres' },
        { value: 'FRONT_DESK', description: 'Can manage bookings and check-in students' },
        { value: 'TUTOR', description: 'Can view sessions and add feedback' },
    ];

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <Link
                href="/dashboard/staff"
                className="inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to staff
            </Link>

            <div>
                <h1 className="text-page-title text-text">Invite staff member</h1>
                <p className="text-small-body text-text-secondary mt-1">
                    Add a new team member and assign them to specific centres
                </p>
            </div>

            {/* Info card */}
            <Card>
                <div className="p-4 flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                        <Shield className="w-4 h-4" />
                    </span>
                    <div>
                        <p className="text-small-body font-medium text-text mb-0.5">Centre-level access</p>
                        <p className="text-metadata leading-relaxed">
                            After inviting, you&apos;ll assign this staff member to specific centres. They&apos;ll only see bookings and students from their assigned centres.
                        </p>
                    </div>
                </div>
            </Card>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2.5">
                            <UserPlus className="w-4 h-4 text-text-muted" />
                            <CardTitle>Staff details</CardTitle>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {error && (
                            <div className="p-3 rounded-md bg-danger-soft border border-danger/20 text-small-body text-danger font-medium">
                                {error}
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label htmlFor="invite-email" className="block text-label text-text-muted mb-1.5">
                                Email address *
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                <input
                                    id="invite-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full h-9 pl-9 pr-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface"
                                    placeholder="staff@example.com"
                                    required
                                />
                            </div>
                            <p className="text-metadata mt-1.5">They&apos;ll receive an invitation email to set up their account</p>
                        </div>

                        {/* Name fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="invite-first-name" className="block text-label text-text-muted mb-1.5">First name</label>
                                <input
                                    id="invite-first-name"
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    className="w-full h-9 px-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface"
                                    placeholder="John"
                                />
                                <p className="text-metadata mt-1">Optional — prompted on first login</p>
                            </div>
                            <div>
                                <label htmlFor="invite-last-name" className="block text-label text-text-muted mb-1.5">Last name</label>
                                <input
                                    id="invite-last-name"
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    className="w-full h-9 px-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface"
                                    placeholder="Doe"
                                />
                                <p className="text-metadata mt-1">Optional — prompted on first login</p>
                            </div>
                        </div>

                        {/* Centre selection */}
                        {centres.length > 0 && (
                            <div>
                                <label htmlFor="invite-centre" className="block text-label text-text-muted mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5" />
                                        Primary centre (optional)
                                    </span>
                                </label>
                                <select
                                    id="invite-centre"
                                    value={formData.centreId}
                                    onChange={(e) => setFormData({ ...formData, centreId: e.target.value })}
                                    className="w-full h-9 px-3 rounded-sm text-sm text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface"
                                >
                                    <option value="">Select a centre (optional)</option>
                                    {centres.map((centre) => (
                                        <option key={centre.id} value={centre.id}>{centre.name}</option>
                                    ))}
                                </select>
                                <p className="text-metadata mt-1.5">
                                    The invitation email will mention this centre. You can assign more centres after they join.
                                </p>
                                {!formData.centreId && formData.role !== 'MANAGER' && (
                                    <p className="mt-1.5 text-metadata text-warning flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        This staff member will have no data access until you assign a centre.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Role selection */}
                        <div>
                            <label className="block text-label text-text-muted mb-2">Role *</label>
                            <div className="space-y-2">
                                {roleOptions.map((role) => (
                                    <label
                                        key={role.value}
                                        className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${formData.role === role.value
                                                ? 'border-accent bg-accent-soft'
                                                : 'border-border-subtle hover:border-border bg-page'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="role"
                                            value={role.value}
                                            checked={formData.role === role.value}
                                            onChange={(e) =>
                                                setFormData({ ...formData, role: e.target.value as any })
                                            }
                                            className="mt-1 accent-accent"
                                        />
                                        <div className="flex-1">
                                            <div className="text-small-body font-medium text-text mb-0.5">{ROLE_LABELS[role.value]}</div>
                                            <div className="text-metadata">{role.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Note about centre assignment */}
                        <div className="p-3 rounded-md bg-page border border-border-subtle flex gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning">
                                <MapPin className="w-4 h-4" />
                            </span>
                            <div>
                                <p className="text-small-body font-medium text-text mb-0.5">Centre assignment — next step</p>
                                <p className="text-metadata leading-relaxed">
                                    After sending the invitation, you&apos;ll be able to assign this staff member to specific centres. They&apos;ll only have access to data from those centres.
                                </p>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="justify-between">
                        <Button variant="ghost" asChild>
                            <Link href="/dashboard/staff">Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Sending invitation…</>
                            ) : (
                                <><Mail className="w-4 h-4" /> Send invitation</>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
