'use client';

import { MapPin, Check } from 'lucide-react';
import { Card, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

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
        <Card>
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border-subtle px-5 py-4">
                <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-text-muted" />
                    <CardTitle>Centre assignments</CardTitle>
                </div>
                {allCentres.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleSelectAll}>Select all</Button>
                        <Button variant="ghost" size="sm" onClick={handleClearAll}>Clear all</Button>
                    </div>
                )}
            </div>

            <CardContent>
                {allCentres.length === 0 ? (
                    <EmptyState
                        icon={<MapPin className="w-8 h-8" />}
                        title="No centres available"
                        description="Create centres first to assign staff members."
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            {allCentres.map((centre) => {
                                const isSelected = selectedCentres.includes(centre.id);
                                return (
                                    <label
                                        key={centre.id}
                                        className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${isSelected
                                                ? 'border-accent bg-accent-soft'
                                                : 'border-border-subtle hover:border-border bg-page'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0 pr-3">
                                            <div className="text-small-body font-medium text-text truncate">{centre.name}</div>
                                            <div className="text-metadata truncate">{centre.slug}</div>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleCentre(centre.id)}
                                                className="sr-only"
                                            />
                                            <div className={`w-5 h-5 rounded-sm flex items-center justify-center transition-colors ${isSelected ? 'bg-accent' : 'bg-surface border border-border'}`}>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        {selectedCentres.length === 0 ? (
                            <div className="p-3 rounded-md bg-warning-soft border border-warning/20">
                                <p className="text-metadata leading-relaxed">
                                    <strong className="text-text font-medium">{staffName}</strong> won&apos;t be able to access any bookings or students without at least one centre assignment.
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 rounded-md bg-page border border-border-subtle text-small-body">
                                <span className="font-medium text-text">Selected: </span>
                                <span className="text-text-secondary">
                                    {selectedCentres.length === 1 ? '1 centre' : `${selectedCentres.length} centres`}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
