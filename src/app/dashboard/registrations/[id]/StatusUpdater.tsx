'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'pending' | 'approved' | 'rejected';

const OPTIONS: { value: Status; label: string; cls: string }[] = [
    { value: 'pending', label: 'Pending', cls: 'text-amber-700 hover:bg-amber-50' },
    { value: 'approved', label: 'Approved', cls: 'text-green-700 hover:bg-green-50' },
    { value: 'rejected', label: 'Rejected', cls: 'text-red-700  hover:bg-red-50' },
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
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50 border border-slate-200"
            >
                {saving ? 'Saving…' : 'Update Status ▾'}
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
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
