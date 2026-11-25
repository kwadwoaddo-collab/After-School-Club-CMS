/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { isValidUuid } from '@/lib/uuid';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, CalendarClock } from 'lucide-react';
import { db } from '@/db';
import { bookings, bookingAttendees, centres } from '@/db/schema';
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

    const centresPromise = familyCentreIds.length > 0
        ? db
            .select({
                id: centres.id,
                name: centres.name,
                address: centres.address,
                sessionSlots: centres.sessionSlots,
            })
            .from(centres)
            .where(inArray(centres.id, familyCentreIds))
        : db
            .select({
                id: centres.id,
                name: centres.name,
                address: centres.address,
                sessionSlots: centres.sessionSlots,
            })
            .from(centres)
            .where(eq(centres.organisationId, parent.organisationId));

    // Guard rescheduleBookingId with isValidUuid (W4-D12) and join bookingAttendees in 1 RTT (FE P2-1)
    const reschedulePromise = isValidUuid(rescheduleBookingId)
        ? db
            .select({
                id: bookings.id,
                startAt: bookings.startAt,
                centreId: bookings.centreId,
                confirmationCode: bookings.confirmationCode,
                childId: bookingAttendees.childId,
            })
            .from(bookings)
            .leftJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
            .where(and(
                eq(bookings.id, rescheduleBookingId),
                eq(bookings.parentId, parent.id), // Security: only this parent's bookings
            ))
            .limit(1)
        : Promise.resolve([]);

    const [parentCentres, rescheduleRows] = await Promise.all([centresPromise, reschedulePromise]);

    const childList = (parent.children || []).map((c: any) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        schoolYear: c.schoolYear,
        centreId: c.centreId ?? null,
    }));

    // ── Resolve booking being rescheduled ─────────────────────────────────────
    const existingBooking = rescheduleRows[0];
    const rescheduleBooking: {
        id: string;
        startAt: Date;
        childId: string;
        centreId: string;
        confirmationCode: string | null;
    } | null = existingBooking && existingBooking.centreId
        ? {
            id: existingBooking.id,
            startAt: existingBooking.startAt,
            centreId: existingBooking.centreId,
            confirmationCode: existingBooking.confirmationCode,
            childId: existingBooking.childId ?? '',
        }
        : null;

    const isRescheduling = !!rescheduleBooking;

    return (
        <div className="min-h-screen bg-background text-foreground pb-12">
            {/* Header */}
            <header className="bg-card border-b border-border sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/portal"
                        aria-label="Back to Parent Portal"
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                            {isRescheduling
                                ? <><CalendarClock className="w-5 h-5 text-warning" aria-hidden="true" /> Reschedule Booking</>
                                : <><CalendarPlus className="w-5 h-5 text-primary" aria-hidden="true" /> Book a Session</>
                            }
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {parent.firstName} · {parentCentres.length === 1 ? parentCentres[0].name : `${parentCentres.length} centres available`}
                        </p>
                    </div>
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8">
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
