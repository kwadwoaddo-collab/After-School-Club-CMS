'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
        <div className="space-y-5 relative pb-24">
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

            {/* Remove staff member */}
            <Card>
                <div className="p-5">
                    <button
                        type="button"
                        onClick={() => setShowRemoveConfirm(true)}
                        className="flex items-center gap-2 text-small-body font-medium text-danger hover:opacity-80 transition-opacity"
                    >
                        <Trash2 className="w-4 h-4" />
                        Remove {staffName} from organisation
                    </button>
                </div>
            </Card>

            {/* Remove confirmation modal — same pattern as the Parents module's
                destructive-action dialogs (BinActions / DeleteParentButton). */}
            {showRemoveConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full">
                        <div className="w-11 h-11 bg-danger-soft rounded-md flex items-center justify-center mb-4">
                            <AlertTriangle className="w-5 h-5 text-danger" />
                        </div>
                        <h3 className="text-section-title text-text mb-2">Remove {staffName}?</h3>
                        <p className="text-small-body text-text-secondary mb-6">
                            They will immediately lose access to the dashboard on their next page load. Their account is not deleted — they just lose access to this organisation.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowRemoveConfirm(false)} disabled={removing}>
                                Cancel
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={handleRemoveStaff} disabled={removing}>
                                {removing ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing…</> : 'Yes, remove access'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky action bar */}
            {isDirty && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-surface border border-border shadow-[var(--shadow-popover)] rounded-lg p-4 flex items-center justify-between z-40 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                            <p className="text-small-body font-medium text-text">Unsaved changes</p>
                            <p className="text-metadata">You have modified this staff member&apos;s profile.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={handleDiscard} disabled={saving}>
                            Discard
                        </Button>
                        <Button onClick={handleSaveAll} disabled={saving}>
                            {saving ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                            ) : (
                                <><Save className="w-4 h-4" /> Save changes</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
