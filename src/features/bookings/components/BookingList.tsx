'use client';

import { useMemo } from 'react';
import { BookingWithDetails } from '../types';
import AppointmentScorecard from './AppointmentScorecard';
import { startOfWeek, endOfWeek, format } from 'date-fns';

interface BookingListProps {
    bookings: BookingWithDetails[];
}

export default function BookingList({ bookings }: BookingListProps) {
    // Sort bookings by start date (descending)
    const sortedBookings = useMemo(() => {
        return [...bookings].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    }, [bookings]);

    // Group by Week
    const groupedBookings = useMemo(() => {
        const groups: Record<string, BookingWithDetails[]> = {};

        sortedBookings.forEach(booking => {
            const date = new Date(booking.startAt);
            const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday start
            const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

            // Format: "9-15 Feb 2026"
            // If standard format is needed, use 'd MMM'
            const startStr = format(weekStart, 'd');
            const endStr = format(weekEnd, 'd MMM yyyy');

            // Handle cross-month/year neatly if needed, but simple is fine for now
            // "9-15 Feb 2026" logic:
            let label = '';
            if (weekStart.getMonth() === weekEnd.getMonth()) {
                label = `${startStr}-${endStr}`;
            } else {
                label = `${format(weekStart, 'd MMM')} - ${endStr}`;
            }

            if (!groups[label]) {
                groups[label] = [];
            }
            groups[label].push(booking);
        });

        return groups;
    }, [sortedBookings]);

    if (bookings.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No appointments found</h3>
                <p className="text-gray-500 max-w-xs mx-auto">Upcoming or past bookings will appear here once they are created.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {Object.entries(groupedBookings).map(([week, weekBookings]) => (
                <div key={week} className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-300 ml-1 sticky top-0 bg-slate-950/80 backdrop-blur py-2 z-10 px-2 rounded-lg inline-block text-shadow shadow-black/50">
                        {week}
                    </h2>
                    <div className="space-y-3">
                        {weekBookings.map(booking => (
                            <AppointmentScorecard key={booking.id} booking={booking} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
