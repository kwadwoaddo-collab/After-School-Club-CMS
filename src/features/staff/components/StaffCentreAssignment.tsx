'use client';

import { MapPin, Check } from 'lucide-react';

interface Centre {
    id: string;
    name: string;
    slug: string;
}

interface StaffCentreAssignmentProps {
    staffName: string;
    allCentres: Centre[];
    selectedCentres: string[];
    onCentresChange: (centres: string[]) => void;
}

export default function StaffCentreAssignment({
    staffName,
    allCentres,
    selectedCentres,
    onCentresChange,
}: StaffCentreAssignmentProps) {

    const handleToggleCentre = (centreId: string) => {
        if (selectedCentres.includes(centreId)) {
            onCentresChange(selectedCentres.filter((id) => id !== centreId));
        } else {
            onCentresChange([...selectedCentres, centreId]);
        }
    };

    const handleSelectAll = () => {
        onCentresChange(allCentres.map(c => c.id));
    };

    const handleClearAll = () => {
        onCentresChange([]);
    };

    return (
        <div className="bg-card rounded-[24px] overflow-hidden border border-border shadow-sm animate-in fade-in duration-500">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-bold text-foreground">Centre Assignments</h2>
                </div>
                {allCentres.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSelectAll}
                            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg bg-primary/10"
                        >
                            Select All
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg bg-secondary"
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            <div className="p-6">
                {allCentres.length === 0 ? (
                    <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-foreground mb-2">No centres available</h3>
                        <p className="text-sm text-muted-foreground">Create centres first to assign staff members.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                            {allCentres.map((centre) => {
                                const isSelected = selectedCentres.includes(centre.id);
                                return (
                                    <label
                                        key={centre.id}
                                        className={`flex items-center justify-between p-3 border-2 rounded-xl cursor-pointer transition-all ${
                                            isSelected
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-border/80 bg-card'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0 pr-3">
                                            <div className="font-bold text-sm text-foreground truncate">{centre.name}</div>
                                            <div className="text-xs text-muted-foreground font-medium truncate">{centre.slug}</div>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleCentre(centre.id)}
                                                className="sr-only" // hidden but accessible
                                            />
                                            <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-primary' : 'bg-secondary border border-border'}`}>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Summary & Warning */}
                        {selectedCentres.length === 0 ? (
                            <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl">
                                <p className="text-sm text-warning font-semibold leading-relaxed">
                                    ⚠️ <span className="font-bold">{staffName}</span> won&apos;t be able to access
                                    any bookings or students without at least one centre assignment.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 bg-secondary/40 rounded-xl border border-border flex items-center gap-2 text-sm font-medium">
                                <span className="font-bold text-foreground">Selected: </span>
                                <span className="text-muted-foreground font-semibold">
                                    {selectedCentres.length === 1 ? '1 centre' : `${selectedCentres.length} centres`}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
