'use client';

import { useState } from 'react';
import { Edit2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReassignCentreModal from './ReassignCentreModal';

interface ReassignCentreButtonProps {
    bookingId: string;
    currentCentreId: string;
    centres: { id: string; name: string }[];
}

export default function ReassignCentreButton({ bookingId, currentCentreId, centres }: ReassignCentreButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    if (centres.length <= 1) return null;

    return (
        <>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(true);
                }}
                className="ml-2 p-1.5 hover:bg-secondary rounded-xl text-slate-400 hover:text-primary transition-colors inline-flex items-center justify-center translate-y-[-2px]"
                title="Reassign Centre"
            >
                <Edit2 className="w-3.5 h-3.5" />
            </button>
            {isOpen && (
                <ReassignCentreModal
                    bookingId={bookingId}
                    currentCentreId={currentCentreId}
                    centres={centres}
                    onClose={() => setIsOpen(false)}
                    onSuccess={() => {
                        router.refresh();
                    }}
                />
            )}
        </>
    );
}
