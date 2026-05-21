'use client';

import { Calendar, X } from 'lucide-react';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface FinanceDashboardFiltersProps {
    centres: { id: string; name: string }[];
}

export default function FinanceDashboardFilters({ centres }: FinanceDashboardFiltersProps) {
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const handleCentreChange = (newCentre: string) => {
        setSelectedCentreId(newCentre);
    };

    if (centres.length <= 1) return null;

    return (
        <div className="flex items-center gap-4">
            {/* Centre Filter */}
            <div className="relative min-w-[180px]">
                <select
                    value={selectedCentreId}
                    onChange={(e) => handleCentreChange(e.target.value)}
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
            
            {selectedCentreId !== 'all' && (
                <button
                    onClick={() => handleCentreChange('all')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#2a2d35] hover:bg-[#343843] rounded-2xl text-sm font-semibold text-[#FFFFFF] transition-all"
                >
                    <X className="w-4 h-4" />
                    Clear
                </button>
            )}
        </div>
    );
}
