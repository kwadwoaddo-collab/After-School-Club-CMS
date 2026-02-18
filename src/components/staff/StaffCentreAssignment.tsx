'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Check, Save, Trash2, AlertTriangle } from 'lucide-react';

interface Centre {
    id: string;
    name: string;
    slug: string;
}

interface StaffCentreAssignmentProps {
    userId: string;
    staffName: string;
    staffRole: string;
    allCentres: Centre[];
    currentAssignments: string[];
}

export default function StaffCentreAssignment({
    userId,
    staffName,
    staffRole,
    allCentres,
    currentAssignments,
}: StaffCentreAssignmentProps) {
    const router = useRouter();
    const [selectedCentres, setSelectedCentres] = useState<string[]>(currentAssignments);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [removing, setRemoving] = useState(false);

    const handleToggleCentre = (centreId: string) => {
        setSelectedCentres((prev) =>
            prev.includes(centreId) ? prev.filter((id) => id !== centreId) : [...prev, centreId]
        );
        setSuccess(false);
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const response = await fetch('/api/staff/assign-centres', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    centreIds: selectedCentres,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update centre assignments');
            }

            setSuccess(true);

            // Refresh the page data
            router.refresh();

            // Redirect back to staff list after a delay
            setTimeout(() => {
                router.push('/dashboard/staff');
            }, 1500);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const hasChanges = JSON.stringify([...selectedCentres].sort()) !== JSON.stringify([...currentAssignments].sort());

    const handleRemoveStaff = async () => {
        setRemoving(true);
        try {
            const res = await fetch('/api/staff/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to remove staff member');
            }
            router.push('/dashboard/staff');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            setRemoving(false);
            setShowRemoveConfirm(false);
        }
    };

    return (
        <div className="glass-card rounded-[32px] overflow-hidden border border-slate-200">
            <div className="px-8 py-6 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-bold text-slate-900">Centre Assignments</h2>
                </div>
            </div>

            <div className="p-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        Centre assignments updated successfully! Redirecting...
                    </div>
                )}

                {allCentres.length === 0 ? (
                    <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No centres available</h3>
                        <p className="text-slate-600">Create centres first to assign staff members.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3 mb-6">
                            {allCentres.map((centre) => {
                                const isSelected = selectedCentres.includes(centre.id);
                                return (
                                    <label
                                        key={centre.id}
                                        className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${isSelected
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleCentre(centre.id)}
                                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-semibold text-slate-900">{centre.name}</div>
                                            <div className="text-sm text-slate-600">{centre.slug}</div>
                                        </div>
                                        {isSelected && (
                                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </label>
                                );
                            })}
                        </div>

                        {/* Summary */}
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="text-sm">
                                <span className="font-semibold text-slate-700">Selected: </span>
                                <span className="text-slate-600">
                                    {selectedCentres.length === 0
                                        ? 'No centres selected - user will have no access'
                                        : selectedCentres.length === 1
                                            ? '1 centre'
                                            : `${selectedCentres.length} centres`}
                                </span>
                            </div>
                        </div>

                        {/* Warning for no selection */}
                        {selectedCentres.length === 0 && (
                            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-sm text-amber-700">
                                    ⚠️ <span className="font-semibold">{staffName}</span> won't be able to access
                                    any bookings or students without at least one centre assignment.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Remove Staff Member */}
            <div className="px-8 py-6 border-t border-slate-200">
                {!showRemoveConfirm ? (
                    <button
                        onClick={() => setShowRemoveConfirm(true)}
                        className="flex items-center gap-2 text-sm font-semibold text-red-500 hover:text-red-700 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Remove {staffName} from organisation
                    </button>
                ) : (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-red-900 text-sm">Remove {staffName}?</p>
                                <p className="text-sm text-red-700 mt-1">
                                    They will immediately lose access to the dashboard on their next page load. Their account is not deleted — they just lose access to this organisation.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleRemoveStaff}
                                disabled={removing}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {removing ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Yes, remove access
                            </button>
                            <button
                                onClick={() => setShowRemoveConfirm(false)}
                                disabled={removing}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Save / Cancel Buttons */}
            {allCentres.length > 0 && (
                <div className="px-8 py-6 border-t border-slate-200 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/dashboard/staff')}
                        className="px-6 py-3 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || loading}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
