'use client';

import { ChevronDown, X } from 'lucide-react';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface FinanceDashboardFiltersProps {
    centres: { id: string; name: string }[];
}

export default function FinanceDashboardFilters({ centres }: FinanceDashboardFiltersProps) {
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    if (centres.length <= 1) return null;

    return (
        <div className="flex items-center gap-3">
            {/* Centre Filter */}
            <div className="relative min-w-[180px]">
                <select
                    value={selectedCentreId}
                    onChange={(e) => setSelectedCentreId(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 rounded-2xl text-sm font-semibold
                               bg-card border border-border text-foreground
                               focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                               transition-all outline-none appearance-none cursor-pointer"
                >
                    <option value="all">All Centres</option>
                    {centres.map(centre => (
                        <option key={centre.id} value={centre.id}>
                            {centre.name}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            {selectedCentreId !== 'all' && (
                <button
                    onClick={() => setSelectedCentreId('all')}
                    className="flex items-center gap-1.5 px-3 py-2.5 bg-secondary hover:bg-secondary/80
                               rounded-2xl text-sm font-semibold text-foreground transition-all border border-border"
                >
                    <X className="w-3.5 h-3.5" />
                    Clear
                </button>
            )}
        </div>
    );
}
