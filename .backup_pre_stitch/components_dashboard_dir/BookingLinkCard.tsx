'use client';

import { useState } from 'react';

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
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg text-white p-6 relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-lg font-semibold mb-1 opacity-90">Your Booking Link</h3>
                <p className="text-sm opacity-70 mb-6">Share this with parents</p>

                <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20 mb-4 break-all font-mono text-sm">
                    {bookingLink}
                </div>

                <button
                    onClick={handleCopy}
                    className="w-full py-2 bg-white text-indigo-700 font-semibold rounded-lg hover:bg-opacity-90 transition-all text-center cursor-pointer flex items-center justify-center gap-2"
                >
                    {copied ? (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy Link
                        </>
                    )}
                </button>
            </div>

            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-purple-500 opacity-20 rounded-full blur-xl"></div>
        </div>
    );
}
