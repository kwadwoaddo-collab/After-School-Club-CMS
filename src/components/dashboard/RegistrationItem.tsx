'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { assignRegistrationCentre } from '@/app/dashboard/registrations/actions';

interface RegistrationItemProps {
    registration: {
        id: string;
        status: string;
        createdAt: Date;
        startDate: Date | null;
        centreId: string | null;
        registrationChildren: {
              childId: string | null;
              submittedFirstName: string;
              submittedLastName: string;
        }[];
        registrationParents: {
              isPrimary: boolean | null;
              submittedFirstName: string;
              submittedLastName: string;
              submittedEmail: string | null;
        }[];
    };
    statusBadge: Record<string, string>;
    statusLabel: Record<string, string>;
    centres: { id: string; name: string }[];
}

export default function RegistrationItem({ registration: r, statusBadge, statusLabel, centres }: RegistrationItemProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleCentreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value === 'null' ? null : e.target.value;
        startTransition(async () => {
            try {
                await assignRegistrationCentre(r.id, value);
            } catch (err) {
                console.error(err);
            }
        });
    };

    const primary = r.registrationParents.find((p) => p.isPrimary) ?? r.registrationParents[0];
    const childNames = r.registrationChildren.map((k) => `${k.submittedFirstName} ${k.submittedLastName}`).join(', ');

    return (
        <Link 
            href={`/dashboard/registrations/${r.id}`}
            className="block bg-surface-container-high border border-outline-variant/10 rounded-2xl p-5 hover:border-primary/30 hover:bg-surface-bright transition-all"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <p className="text-white font-medium truncate">
                            {primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Unknown Parent'}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.status] || ''}`}>
                            {statusLabel[r.status] ?? r.status}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-on-surface-variant text-sm truncate">
                            {r.registrationChildren.length} child{r.registrationChildren.length !== 1 ? 'ren' : ''}: {childNames}
                        </p>
                        {r.registrationChildren.some((k) => k.childId) && (
                            <div className="flex flex-wrap items-center gap-1.5 ml-2">
                                {r.registrationChildren.filter((k) => k.childId).map((k) => (
                                    <button
                                        key={k.childId}
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            router.push(`/dashboard/students/${k.childId}`);
                                        }}
                                        className="inline-flex items-center px-2 py-0.5 rounded border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/20 hover:border-primary/30 transition-colors cursor-pointer relative z-10"
                                        title={`View ${k.submittedFirstName}'s Profile`}
                                    >
                                        View {k.submittedFirstName} ↘
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {primary?.submittedEmail && (
                        <p className="text-on-surface-variant opacity-80 text-xs mt-1">{primary.submittedEmail}</p>
                    )}
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-on-surface-variant text-xs">
                        {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {r.startDate && (
                        <p className="text-on-surface-variant text-xs mt-1 mb-2">
                            Start: {new Date(r.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    )}
                    <div onClick={(e) => e.preventDefault()} className="mt-2">
                        <select
                            value={r.centreId || 'null'}
                            onChange={handleCentreChange}
                            disabled={isPending}
                            className={`text-xs border rounded py-1 px-2 disabled:opacity-50 transition-colors w-32 ${
                                r.centreId 
                                    ? 'bg-primary/10 border-primary/20 text-primary font-medium' 
                                    : 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
                            }`}
                        >
                            <option value="null">No Centre Assigned</option>
                            {centres.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </Link>
    );
}
