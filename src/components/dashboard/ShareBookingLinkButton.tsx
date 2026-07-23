'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import { Link2, Check } from 'lucide-react';

interface ShareBookingLinkButtonProps {
    bookingUrl: string;
}

export default function ShareBookingLinkButton({ bookingUrl }: ShareBookingLinkButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(bookingUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            logger.error('Failed to copy:', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-lg ${copied
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-purple-500/30'
                }`}
        >
            {copied ? (
                <>
                    <Check className="w-4 h-4" /> Copied!
                </>
            ) : (
                <>
                    <Link2 className="w-4 h-4" /> Booking Link
                </>
            )}
        </button>
    );
}
