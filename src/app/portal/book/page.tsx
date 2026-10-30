/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, CalendarClock } from 'lucide-react';
import { db } from '@/db';
import { bookings, bookingAttendees, centres, children } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { BookingFlow } from './BookingFlow';

interface Props {
    searchParams: Promise<{ reschedule?: string }>;
}

export default async function PortalBookPage({ searchParams }: Props) {
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

    const { reschedule: rescheduleBookingId } = await searchParams;

    // Find unique centre IDs from both enrolled children and existing booking history
    const childCentreIds = (parent.children || [])
        .map((c: any) => c.centreId)
        .filter(Boolean) as string[];
    const bookingCentreIds = (parent.bookings || [])
        .map((b: any) => b.centreId)
        .filter(Boolean) as string[];
    const familyCentreIds = Array.from(new Set([...childCentreIds, ...bookingCentreIds]));

    let parentCentres: {
        id: string;
        name: string;
        address: string | null;
        sessionSlots: string | null;
    }[] = [];

    if (familyCentreIds.length > 0) {
        parentCentres = await db
            .select({
                id: centres.id,
                name: centres.name,
                address: centres.address,
                sessionSlots: centres.sessionSlots,
            })
            .from(centres)
            .where(inArray(centres.id, familyCentreIds));
    } else {
        parentCentres = await db
            .select({
                id: centres.id,
                name: centres.name,
                address: centres.address,
                sessionSlots: centres.sessionSlots,
            })
            .from(centres)
            .where(eq(centres.organisationId, parent.organisationId));
    }

    const childList = (parent.children || []).map((c: any) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        schoolYear: c.schoolYear,
        centreId: c.centreId ?? null,
    }));

    // ── Resolve booking being rescheduled ─────────────────────────────────────
    let rescheduleBooking: {
        id: string;
        startAt: Date;
        childId: string;
        centreId: string;
        confirmationCode: string | null;
    } | null = null;

    if (rescheduleBookingId) {
        const [existingBooking] = await db
            .select({
                id: bookings.id,
                startAt: bookings.startAt,
                centreId: bookings.centreId,
                confirmationCode: bookings.confirmationCode,
            })
            .from(bookings)
            .where(and(
                eq(bookings.id, rescheduleBookingId),
                eq(bookings.parentId, parent.id), // Security: only this parent's bookings
            ))
            .limit(1);

        if (existingBooking && existingBooking.centreId) {
            // Find the child from the booking attendees
            const [attendee] = await db
                .select({ childId: bookingAttendees.childId })
                .from(bookingAttendees)
                .where(eq(bookingAttendees.bookingId, existingBooking.id))
                .limit(1);

            rescheduleBooking = {
                ...existingBooking,
                centreId: existingBooking.centreId, // narrowed to string
                childId: attendee?.childId ?? '',
            };
        }
    }

    const isRescheduling = !!rescheduleBooking;

    return (
        <div className="min-h-screen bg-background text-foreground pb-12">
            {/* Header */}
            <header className="bg-card border-b border-border sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/portal"
                        className="p-2 -ml-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                            {isRescheduling
                                ? <><CalendarClock className="w-5 h-5 text-amber-500" /> Reschedule Booking</>
                                : <><CalendarPlus className="w-5 h-5 text-primary" /> Book a Session</>
                            }
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {parent.firstName} · {parentCentres.length === 1 ? parentCentres[0].name : `${parentCentres.length} centres available`}
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                {parentCentres.length === 0 ? (
                    <div className="bg-card p-10 rounded-2xl border border-dashed border-border text-center">
                        <p className="text-muted-foreground mb-2">No centres are associated with your account yet.</p>
                        <p className="text-xs text-muted-foreground">Please contact your club admin to get set up.</p>
                    </div>
                ) : (
                    <BookingFlow
                        registeredChildren={childList}
                        centres={parentCentres}
                        rescheduleBooking={rescheduleBooking}
                    />
                )}
            </main>
        </div>
    );
}
