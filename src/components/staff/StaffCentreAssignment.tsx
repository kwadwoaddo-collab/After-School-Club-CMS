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
        <div className="bg-white rounded-[32px] overflow-hidden border border-gray-200 shadow-sm animate-in fade-in duration-500">
            <div className="px-8 py-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <h2 className="text-lg font-bold text-gray-900">Centre Assignments</h2>
                </div>
            </div>

            <div className="p-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 font-bold text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-sm flex items-center gap-2">
                        <Check className="w-5 h-5 text-emerald-600" />
                        Centre assignments updated successfully! Redirecting...
                    </div>
                )}

                {allCentres.length === 0 ? (
                    <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No centres available</h3>
                        <p className="text-sm text-gray-500">Create centres first to assign staff members.</p>
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
                                            ? 'border-blue-600 bg-blue-50/50'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleCentre(centre.id)}
                                            className="w-5 h-5 rounded focus:ring-2 focus:ring-blue-500/20 accent-blue-600"
                                        />
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-900">{centre.name}</div>
                                            <div className="text-sm text-gray-500 font-semibold">{centre.slug}</div>
                                        </div>
                                        {isSelected && (
                                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </label>
                                );
                            })}
                        </div>

                        {/* Summary */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="text-sm font-medium">
                                <span className="font-bold text-gray-900">Selected: </span>
                                <span className="text-gray-500 font-semibold">
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
                                <p className="text-sm text-amber-700 font-semibold leading-relaxed">
                                    ⚠️ <span className="font-bold">{staffName}</span> won&apos;t be able to access
                                    any bookings or students without at least one centre assignment.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Remove Staff Member */}
            <div className="px-8 py-6 border-t border-gray-200">
                {!showRemoveConfirm ? (
                    <button
                        onClick={() => setShowRemoveConfirm(true)}
                        className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                    >
                        <Trash2 className="w-4 h-4" />
                        Remove {staffName} from organisation
                    </button>
                ) : (
                    <div className="p-5 bg-red-50 border border-red-200 rounded-2xl">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-red-900 text-sm">Remove {staffName}?</p>
                                <p className="text-sm text-red-700 font-semibold mt-1 leading-relaxed">
                                    They will immediately lose access to the dashboard on their next page load. Their account is not deleted — they just lose access to this organisation.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleRemoveStaff}
                                disabled={removing}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
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
                                className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Save / Cancel Buttons */}
            {allCentres.length > 0 && (
                <div className="px-8 py-6 border-t border-gray-200 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/dashboard/staff')}
                        className="px-6 py-3 text-gray-500 hover:text-gray-900 font-bold transition-colors cursor-pointer"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || loading}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 shadow-sm shadow-blue-100 cursor-pointer"
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
