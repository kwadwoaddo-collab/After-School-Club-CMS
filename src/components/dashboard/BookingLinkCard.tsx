'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

interface BookingLinkCardProps {
    bookingLink: string;
}

export default function BookingLinkCard({ bookingLink }: BookingLinkCardProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(bookingLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className="relative group overflow-hidden rounded-[32px] p-8 bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-white shadow-2xl">
            {/* Background Glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-[80px] group-hover:bg-primary/30 transition-colors"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent-violet/10 rounded-full blur-[80px]"></div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                        <Share2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold tracking-tight leading-none">Public Booking Link</h3>
                        <p className="text-xs font-medium text-slate-400 mt-1">Share this with your parents</p>
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 mb-6 group/link transition-colors hover:bg-white/10 cursor-pointer" onClick={handleCopy}>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Registration URL</p>
                    <div className="font-mono text-sm text-slate-300 break-all select-all">
                        {bookingLink}
                    </div>
                </div>

                <button
                    onClick={handleCopy}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${copied
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                            : 'bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/20'
                        }`}
                >
                    {copied ? (
                        <>
                            <Check className="w-4 h-4" /> Copied to Clipboard
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4" /> Copy Secure Link
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
