'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertTriangle, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import StaffRoleSelector from './StaffRoleSelector';
import StaffCentreAssignment from './StaffCentreAssignment';
import { updateStaffRole } from '@/features/staff/staff-actions';

interface Centre {
    id: string;
    name: string;
    slug: string;
}

// Mirrors the StaffRole union in StaffRoleSelector.tsx (not exported from
// there, so restated here structurally rather than importing).
type StaffRole = 'TUTOR' | 'FRONT_DESK' | 'MANAGER' | 'ORG_OWNER';

interface StaffProfileFormProps {
    userId: string;
    staffName: string;
    currentRole: StaffRole;
    ownerCount: number;
    allCentres: Centre[];
    currentAssignments: string[];
}

export default function StaffProfileForm({
    userId,
    staffName,
    currentRole,
    ownerCount,
    allCentres,
    currentAssignments
}: StaffProfileFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    
    const [selectedRole, setSelectedRole] = useState(currentRole);
    const [selectedCentres, setSelectedCentres] = useState<string[]>(currentAssignments);
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

    const hasRoleChanged = selectedRole !== currentRole;
    const hasCentresChanged = JSON.stringify([...selectedCentres].sort()) !== JSON.stringify([...currentAssignments].sort());
    const isDirty = hasRoleChanged || hasCentresChanged;

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            // Save role if changed
            if (hasRoleChanged) {
                await updateStaffRole(userId, selectedRole);
            }
            // Save centres if changed (and not owner)
            if (hasCentresChanged && selectedRole !== 'ORG_OWNER') {
                const response = await fetch('/api/staff/assign-centres', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, centreIds: selectedCentres }),
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to update centre assignments');
                }
            }
            toast({
                title: 'Changes saved',
                message: 'Staff profile updated successfully.',
                variant: 'success'
            });
            router.refresh();
        } catch (err) {
            toast({
                title: 'Error saving changes',
                message: err instanceof Error ? err.message : 'Failed to save changes',
                variant: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

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
        } catch (err) {
            toast({
                title: 'Error removing staff',
                message: err instanceof Error ? err.message : 'Failed to remove staff member',
                variant: 'error'
            });
            setRemoving(false);
            setShowRemoveConfirm(false);
        }
    };

    const handleDiscard = () => {
        setSelectedRole(currentRole);
        setSelectedCentres(currentAssignments);
    };

    return (
        <div className="space-y-6 relative pb-24">
            <StaffRoleSelector 
                currentRole={currentRole}
                selectedRole={selectedRole}
                onRoleChange={setSelectedRole}
                ownerCount={ownerCount}
            />
            
            {selectedRole !== 'ORG_OWNER' && (
                <StaffCentreAssignment 
                    staffName={staffName}
                    allCentres={allCentres}
                    selectedCentres={selectedCentres}
                    onCentresChange={setSelectedCentres}
                />
            )}

            {/* Remove Staff Member */}
            <div className="bg-card rounded-[24px] p-6 border border-border shadow-sm">
                {!showRemoveConfirm ? (
                    <button
                        onClick={() => setShowRemoveConfirm(true)}
                        className="flex items-center gap-2 text-sm font-bold text-destructive hover:text-destructive/80 transition-colors cursor-pointer"
                    >
                        <Trash2 className="w-4 h-4" />
                        Remove {staffName} from organisation
                    </button>
                ) : (
                    <div className="p-5 bg-destructive/10 border border-destructive/20 rounded-2xl">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-foreground text-sm">Remove {staffName}?</p>
                                <p className="text-sm text-destructive/80 font-semibold mt-1 leading-relaxed">
                                    They will immediately lose access to the dashboard on their next page load. Their account is not deleted — they just lose access to this organisation.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleRemoveStaff}
                                disabled={removing}
                                className="flex items-center gap-2 px-4 py-2 bg-destructive hover:bg-destructive/90 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {removing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Yes, remove access
                            </button>
                            <button
                                onClick={() => setShowRemoveConfirm(false)}
                                disabled={removing}
                                className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Action Bar */}
            {isDirty && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-card border border-border shadow-2xl rounded-2xl p-4 flex items-center justify-between z-50 animate-in slide-in-from-bottom-8 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">Unsaved changes</p>
                            <p className="text-xs text-muted-foreground font-medium">You have modified this staff member&apos;s profile.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDiscard}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Discard
                        </button>
                        <button
                            onClick={handleSaveAll}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
