'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getIncidents } from '@/features/incidents/actions';
import { Plus, ShieldAlert, Activity, FileWarning, Search, FileText, AlertTriangle, X, Printer } from 'lucide-react';
import NewIncidentModal from './NewIncidentModal';
import { logger } from '@/lib/logger';

type Incident = Awaited<ReturnType<typeof getIncidents>>[number];

export default function IncidentsClient({ centreId, centreName, userRole }: { centreId: string; centreName?: string; userRole?: string }) {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!selectedIncident) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedIncident(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIncident]);

    const loadIncidents = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getIncidents(centreId);
            setIncidents(data);
        } catch (error) {
            logger.error('Failed to load incidents', error);
        } finally {
            setIsLoading(false);
        }
    }, [centreId]);

    useEffect(() => {
        loadIncidents();
    }, [loadIncidents]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'safeguarding': return <ShieldAlert className="w-4 h-4 text-destructive" />;
            case 'medication': return <Activity className="w-4 h-4 text-accent" />;
            case 'accident': return <FileWarning className="w-4 h-4 text-warning" />;
            default: return <FileText className="w-4 h-4 text-text-muted" />;
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'safeguarding': return 'bg-destructive/10 text-destructive border-destructive/20';
            case 'medication':   return 'bg-accent/10 text-accent border-accent/20';
            case 'accident':     return 'bg-warning/10 text-warning border-warning/20';
            default:             return 'bg-page text-text-secondary border-border';
        }
    };

    const filteredIncidents = incidents.filter(i =>
        i.childFirstName.toLowerCase().includes(search.toLowerCase()) ||
        i.childLastName.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Search + Action bar */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    <input
                        id="incidents-search"
                        type="text"
                        placeholder="Search child or description…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all"
                    />
                </div>
                <button
                    id="log-incident-btn"
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-colors shadow-sm text-sm shrink-0"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Log Incident
                </button>
            </div>

            {/* Incidents table */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[600px]">
                        <thead className="bg-page border-b border-border">
                            <tr>
                                <th className="px-5 py-3.5 font-semibold text-text-muted text-xs uppercase tracking-wider">Date &amp; Type</th>
                                <th className="px-5 py-3.5 font-semibold text-text-muted text-xs uppercase tracking-wider">Child</th>
                                <th className="px-5 py-3.5 font-semibold text-text-muted text-xs uppercase tracking-wider">Description</th>
                                <th className="px-5 py-3.5 font-semibold text-text-muted text-xs uppercase tracking-wider">Logged</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                /* Loading skeleton rows */
                                [1, 2, 3].map(i => (
                                    <tr key={i}>
                                        <td className="px-5 py-4">
                                            <div className="space-y-1.5 animate-pulse">
                                                <div className="h-4 w-28 bg-page rounded" />
                                                <div className="h-5 w-20 bg-page rounded-full" />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4"><div className="h-4 w-32 bg-page rounded animate-pulse" /></td>
                                        <td className="px-5 py-4"><div className="h-4 w-48 bg-page rounded animate-pulse" /></td>
                                        <td className="px-5 py-4"><div className="h-4 w-20 bg-page rounded animate-pulse" /></td>
                                    </tr>
                                ))
                            ) : filteredIncidents.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-page border border-border flex items-center justify-center">
                                                <AlertTriangle className="w-6 h-6 text-text-muted" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-text">
                                                    {search ? 'No matching records' : 'No incidents yet'}
                                                </p>
                                                <p className="text-sm text-text-muted mt-0.5">
                                                    {search
                                                        ? 'Try a different search term.'
                                                        : 'Log your first incident or accident record.'}
                                                </p>
                                            </div>
                                            {!search && (
                                                <button
                                                    onClick={() => setIsModalOpen(true)}
                                                    className="mt-1 px-5 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors"
                                                >
                                                    Log Incident
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredIncidents.map((incident) => (
                                    <tr
                                        key={incident.id}
                                        onClick={() => setSelectedIncident(incident)}
                                        className="hover:bg-page/60 transition-colors cursor-pointer"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="font-medium text-text text-xs">
                                                    {new Date(incident.date).toLocaleString('en-GB', {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short',
                                                    })}
                                                </span>
                                                <span className={`inline-flex items-center gap-1.5 w-max px-2 py-0.5 rounded-full text-xs font-semibold border ${getTypeBadge(incident.type)}`}>
                                                    {getTypeIcon(incident.type)}
                                                    <span className="capitalize">{incident.type}</span>
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 font-medium text-text">
                                            <Link
                                                href={`/dashboard/students/${incident.childId}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="hover:text-accent hover:underline transition-colors"
                                            >
                                                {incident.childFirstName} {incident.childLastName}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-4 max-w-xs truncate text-text-secondary text-sm">
                                            {incident.description}
                                        </td>
                                        <td className="px-5 py-4 text-text-muted text-xs whitespace-nowrap">
                                            {new Date(incident.createdAt).toLocaleDateString('en-GB', {
                                                dateStyle: 'short',
                                            })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Incident & Safeguarding Detail Drawer */}
            {selectedIncident && (
                <div
                    className="fixed inset-0 z-50 flex justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="incident-detail-title"
                >
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setSelectedIncident(null)}
                    />
                    <div className="relative w-full max-w-lg bg-surface shadow-[var(--shadow-popover)] h-full flex flex-col border-l border-border">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                            <div>
                                <h2 id="incident-detail-title" className="text-base font-bold text-text">
                                    Incident &amp; Safeguarding Record
                                </h2>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {centreName ? `${centreName} · ` : ''}Logged {new Date(selectedIncident.createdAt).toLocaleString('en-GB')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedIncident(null)}
                                aria-label="Close incident details"
                                className="p-2 hover:bg-page rounded-md transition-colors text-text-muted hover:text-text"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto space-y-5">
                            {centreName && (
                                <div>
                                    <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                        Centre
                                    </span>
                                    <p className="text-sm font-semibold text-text">{centreName}</p>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                        Student
                                    </span>
                                    <Link
                                        href={`/dashboard/students/${selectedIncident.childId}`}
                                        className="text-base font-semibold text-accent hover:underline"
                                    >
                                        {selectedIncident.childFirstName} {selectedIncident.childLastName}
                                    </Link>
                                </div>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getTypeBadge(selectedIncident.type)}`}>
                                    {getTypeIcon(selectedIncident.type)}
                                    <span className="capitalize">{selectedIncident.type}</span>
                                </span>
                            </div>

                            <div>
                                <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                    Date &amp; Time of Incident
                                </span>
                                <p className="text-sm text-text font-medium">
                                    {new Date(selectedIncident.date).toLocaleString('en-GB', {
                                        dateStyle: 'full',
                                        timeStyle: 'short',
                                    })}
                                </p>
                            </div>

                            <div>
                                <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                    Full Description
                                </span>
                                <div className="p-4 rounded-lg bg-page border border-border text-sm text-text whitespace-pre-wrap leading-relaxed">
                                    {selectedIncident.description}
                                </div>
                            </div>

                            <div>
                                <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                    Action / First Aid Given
                                </span>
                                <div className="p-4 rounded-lg bg-page border border-border text-sm text-text whitespace-pre-wrap leading-relaxed">
                                    {selectedIncident.treatment || 'None recorded'}
                                </div>
                            </div>

                            <div>
                                <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                    Witnesses
                                </span>
                                <div className="p-3.5 rounded-lg bg-page border border-border text-sm text-text">
                                    {selectedIncident.witnesses || 'None recorded'}
                                </div>
                            </div>

                            <div>
                                <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                    Recorded Staff Signature
                                </span>
                                {(selectedIncident as { staffSignature?: string | null }).staffSignature ? (
                                    <div className="p-3 rounded-lg bg-white border border-border inline-block">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={(selectedIncident as { staffSignature?: string | null }).staffSignature!}
                                            alt="Staff signature"
                                            className="max-h-24 w-auto object-contain"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-muted">No signature image attached</p>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-surface hover:bg-page text-sm font-semibold text-text transition-colors"
                            >
                                <Printer className="w-4 h-4" />
                                Print Incident Report
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedIncident(null)}
                                className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <NewIncidentModal
                    centreId={centreId}
                    userRole={userRole}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        loadIncidents();
                    }}
                />
            )}
        </div>
    );
}
