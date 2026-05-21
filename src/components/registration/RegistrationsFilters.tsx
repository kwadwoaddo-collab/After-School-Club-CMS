'use client';

import { Calendar, X } from 'lucide-react';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface RegistrationsFiltersProps {
    centres: { id: string; name: string }[];
    resultsCount?: number;
}

export default function RegistrationsFilters({ centres, resultsCount = 0 }: RegistrationsFiltersProps) {
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const hasActiveFilters = selectedCentreId !== 'all';

    const handleClearFilters = () => {
        setSelectedCentreId('all');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
                {/* Centre Filter */}
                <div className="relative min-w-[180px]">
                    <select
                        value={selectedCentreId}
                        onChange={(e) => {
                            setSelectedCentreId(e.target.value);
                        }}
                        className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer"
                        style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                    >
                        <option value="all">All Centres</option>
                        {centres.map(centre => (
                            <option key={centre.id} value={centre.id}>
                                {centre.name}
                            </option>
                        ))}
                    </select>
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#2a2d35] hover:bg-[#343843] rounded-2xl text-sm font-semibold text-[#FFFFFF] transition-all"
                    >
                        <X className="w-4 h-4" />
                        Clear
                    </button>
                )}
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Active Filters:
                    </span>
                    {selectedCentreId !== 'all' && (
                        <span className="px-3 py-1 bg-accent-cyan/10 text-accent-cyan text-xs font-semibold rounded-full">
                            Centre: {centres.find(c => c.id === selectedCentreId)?.name} ({resultsCount} results)
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
