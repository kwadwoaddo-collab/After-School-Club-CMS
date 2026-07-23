'use client';

import { useState, useEffect } from 'react';
import { getIncidents } from '@/features/incidents/actions';
import { Plus, ShieldAlert, Activity, FileWarning, Search, FileText } from 'lucide-react';
import NewIncidentModal from './NewIncidentModal';

export default function IncidentsClient({ centreId }: { centreId: string }) {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadIncidents();
    }, [centreId]);

    const loadIncidents = async () => {
        setIsLoading(true);
        try {
            const data = await getIncidents(centreId);
            setIncidents(data);
        } catch (error) {
            console.error('Failed to load incidents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'safeguarding': return <ShieldAlert className="w-5 h-5 text-destructive" />;
            case 'medication': return <Activity className="w-5 h-5 text-primary" />;
            case 'accident': return <FileWarning className="w-5 h-5 text-warning" />;
            default: return <FileText className="w-5 h-5 text-muted-foreground" />;
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'safeguarding': return 'bg-destructive/10 text-destructive border-destructive/20';
            case 'medication': return 'bg-primary/10 text-primary border-primary/20';
            case 'accident': return 'bg-warning/10 text-warning border-warning/20';
            default: return 'bg-secondary text-foreground border-border';
        }
    };

    const filteredIncidents = incidents.filter(i => 
        i.childFirstName.toLowerCase().includes(search.toLowerCase()) ||
        i.childLastName.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search child or description..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    />
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Log Incident
                </button>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/40 border-b border-border">
                        <tr>
                            <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Date &amp; Type</th>
                            <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Child</th>
                            <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Description</th>
                            <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                    Loading records...
                                </td>
                            </tr>
                        ) : filteredIncidents.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground italic">
                                    No records found.
                                </td>
                            </tr>
                        ) : (
                            filteredIncidents.map((incident) => (
                                <tr key={incident.id} className="hover:bg-secondary/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="font-semibold">{new Date(incident.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                            <span className={`inline-flex items-center gap-1.5 w-max px-2.5 py-1 rounded-full text-xs font-bold border ${getTypeBadge(incident.type)}`}>
                                                {getTypeIcon(incident.type)}
                                                <span className="uppercase tracking-wide">{incident.type}</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-semibold">
                                        {incident.childFirstName} {incident.childLastName}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate text-muted-foreground">
                                        {incident.description}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-primary font-semibold text-sm hover:underline">View PDF</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <NewIncidentModal 
                    centreId={centreId} 
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
