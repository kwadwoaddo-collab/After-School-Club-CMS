import { InferSelectModel } from 'drizzle-orm';
import { bookings, bookingAttendees, centres, parents, children, users, childSubjects } from '@/db/schema';

export type Booking = InferSelectModel<typeof bookings>;
export type Parent = InferSelectModel<typeof parents>;
export type Child = InferSelectModel<typeof children>;
export type Centre = InferSelectModel<typeof centres>;
export type BookingAttendee = InferSelectModel<typeof bookingAttendees>;
export type User = InferSelectModel<typeof users>;
export type ChildSubject = InferSelectModel<typeof childSubjects>;

export interface BookingWithDetails extends Booking {
    centre: Centre;
    parent: Parent;
    attendees: (BookingAttendee & {
        child: Child & {
            subjects: ChildSubject[]
        }
    })[];
    tutor?: User | null;
    child?: Child | null; // Deprecated: for legacy bookings before multi-child feature
}
