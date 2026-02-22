'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'pending' | 'approved' | 'rejected';

const OPTIONS: { value: Status; label: string; cls: string }[] = [
    { value: 'pending', label: 'Pending', cls: 'text-amber-300 hover:bg-amber-500/10' },
    { value: 'approved', label: 'Approved', cls: 'text-green-300 hover:bg-green-500/10' },
    { value: 'rejected', label: 'Rejected', cls: 'text-red-300  hover:bg-red-500/10' },
];

export default function RegistrationStatusUpdater({
    registrationId, currentStatus,
}: { registrationId: string; currentStatus: Status }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    const update = async (status: Status) => {
        if (status === currentStatus) { setOpen(false); return; }
        setSaving(true);
        await fetch(`/api/register/${registrationId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        setOpen(false);
        setSaving(false);
        router.refresh();
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 transition-colors disabled:opacity-50"
            >
                {saving ? 'Saving…' : 'Update Status ▾'}
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-[#0d1117] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden">
                    {OPTIONS.map(o => (
                        <button key={o.value} onClick={() => update(o.value)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${o.cls} ${o.value === currentStatus ? 'opacity-40 cursor-default' : ''}`}>
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
