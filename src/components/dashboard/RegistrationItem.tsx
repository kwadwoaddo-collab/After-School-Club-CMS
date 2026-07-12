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
            className="block bg-card border border-border rounded-[24px] p-6 hover:border-primary/30 hover:bg-secondary/40 transition-all shadow-sm group"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <p className="text-foreground font-bold text-base truncate group-hover:text-primary transition-colors">
                            {primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Unknown Parent'}
                        </p>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadge[r.status] || ''}`}>
                            {statusLabel[r.status] ?? r.status}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-muted-foreground text-sm font-medium truncate">
                            {r.registrationChildren.length} child{r.registrationChildren.length !== 1 ? 'ren' : ''}: <span className="text-foreground/80 font-semibold">{childNames}</span>
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
                                        className="inline-flex items-center px-2.5 py-0.5 rounded-lg border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/20 hover:border-primary/30 transition-colors cursor-pointer relative z-10"
                                        title={`View ${k.submittedFirstName}'s Profile`}
                                    >
                                        View {k.submittedFirstName} ↘
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {primary?.submittedEmail && (
                        <p className="text-muted-foreground text-xs font-semibold mt-1.5 flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {primary.submittedEmail}
                        </p>
                    )}
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end justify-between self-stretch">
                    <div className="space-y-1">
                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                            Submitted: {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {r.startDate && (
                            <p className="text-muted-foreground text-xs font-semibold">
                                Start Date: <span className="text-foreground font-bold">{new Date(r.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </p>
                        )}
                    </div>
                    <div onClick={(e) => e.preventDefault()} className="mt-4">
                        <select
                            value={r.centreId || 'null'}
                            onChange={handleCentreChange}
                            disabled={isPending}
                            className={`text-xs border rounded-xl py-1.5 px-3.5 disabled:opacity-50 transition-all w-44 cursor-pointer outline-none font-bold ${
                                r.centreId 
                                    ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/15' 
                                    : 'bg-secondary border-border text-muted-foreground hover:border-border/80'
                            }`}
                        >
                            <option value="null" className="bg-card text-muted-foreground">No Centre Assigned</option>
                            {centres.map((c) => (
                                <option key={c.id} value={c.id} className="bg-card text-foreground">{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </Link>
    );
}
