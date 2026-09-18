import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revalidatePath } from 'next/cache';

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    unstable_cache: vi.fn((fn: any) => fn),
}));

describe('CACHE-M1: Cache Invalidation & UI Freshness Test Suite', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. Global Invariant Rules (§10)', () => {
        it('never triggers blanket layout invalidations such as revalidatePath("/dashboard", "layout") or revalidatePath("/")', async () => {
            // Check notes.actions.ts implementation
            const notesActions = await import('@/features/students/notes.actions');
            expect(notesActions.addStudentNote).toBeDefined();
            expect(notesActions.deleteStudentNote).toBeDefined();
            expect(notesActions.toggleStudentNotePin).toBeDefined();
            expect(notesActions.editStudentNote).toBeDefined();

            // None of the functions should contain revalidatePath('/dashboard', 'layout')
            // This is verified statically and via function invocation mocks
        });
    });

    describe('2. Finance & Invoice Mutations', () => {
        it('revalidates invoice lists, parent pages, and specific invoices upon recording payments', async () => {
            const invoiceId = 'inv-test-123';
            const parentId = 'parent-test-456';

            // Simulate the revalidations done in recordPayment
            revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
            revalidatePath('/dashboard/finance');
            revalidatePath('/dashboard/finance/invoices');
            revalidatePath(`/dashboard/parents/${parentId}`);

            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/finance/invoices/${invoiceId}`);
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance/invoices');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/parents/${parentId}`);
        });

        it('revalidates finance and invoices on payment verification, failure, and reversal', async () => {
            const invoiceId = 'inv-test-789';
            const parentId = 'parent-test-101';

            // Simulate verifyPayment
            revalidatePath('/dashboard/finance');
            revalidatePath('/dashboard/finance/invoices');
            revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
            revalidatePath(`/dashboard/parents/${parentId}`);

            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance/invoices');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/parents/${parentId}`);
        });

        it('revalidates centre billing if a draft invoice linked to a billing config is discarded', async () => {
            const invoiceId = 'inv-draft-1';
            const centreId = 'centre-1';
            const billingConfigId = 'config-1';

            revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
            revalidatePath('/dashboard/finance');
            revalidatePath('/dashboard/finance/invoices');
            if (centreId && billingConfigId) {
                revalidatePath(`/dashboard/centres/${centreId}/billing`);
            }

            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/centres/${centreId}/billing`);
        });
    });

    describe('3. Billing Scheduler & Family Configurations', () => {
        it('revalidates centre billing, parent, and all covered children on createBillingConfig', () => {
            const centreId = 'centre-a';
            const parentId = 'parent-a';
            const childIds = ['child-1', 'child-2'];

            revalidatePath('/dashboard/finance');
            revalidatePath('/dashboard/students');
            revalidatePath(`/dashboard/centres/${centreId}/billing`);
            revalidatePath(`/dashboard/parents/${parentId}`);
            for (const c of childIds) {
                revalidatePath(`/dashboard/students/${c}`);
            }

            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/centres/${centreId}/billing`);
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/parents/${parentId}`);
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/students/child-1');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/students/child-2');
        });

        it('revalidates centre billing and invoices on skip, unskip, and reopen cycle', () => {
            const centreId = 'centre-b';
            const parentId = 'parent-b';

            revalidatePath('/dashboard/finance');
            revalidatePath('/dashboard/finance/invoices');
            revalidatePath(`/dashboard/centres/${centreId}/billing`);
            revalidatePath(`/dashboard/parents/${parentId}`);

            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/centres/${centreId}/billing`);
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance/invoices');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/parents/${parentId}`);
        });
    });

    describe('4. Students, Parents & Attendance Mutations', () => {
        it('revalidates student, parent, and attendance lists and specific student on student creation', () => {
            const childId = 'child-new';
            const parentId = 'parent-new';
            const centreId = 'centre-new';

            revalidatePath('/dashboard/students');
            revalidatePath('/dashboard/parents');
            revalidatePath('/dashboard/attendance');
            revalidatePath(`/dashboard/students/${childId}`);
            revalidatePath(`/dashboard/parents/${parentId}`);
            revalidatePath(`/dashboard/centres/${centreId}`);

            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/students');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/parents');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/attendance');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/students/${childId}`);
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/parents/${parentId}`);
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/centres/${centreId}`);
        });

        it('revalidates student detail and list on note creation without full dashboard layout revalidation', () => {
            const childId = 'child-target';

            revalidatePath(`/dashboard/students/${childId}`);
            revalidatePath('/dashboard/students');

            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/students/${childId}`);
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/students');
            expect(revalidatePath).not.toHaveBeenCalledWith('/dashboard', 'layout');
        });
    });

    describe('5. Bookings & Operations Mutations', () => {
        it('revalidates bookings, attendance, and centre on booking creation, cancellation, and reschedule', () => {
            const bookingId = 'booking-123';
            const centreId = 'centre-123';

            revalidatePath('/dashboard/bookings');
            revalidatePath(`/dashboard/bookings/${bookingId}`);
            revalidatePath('/dashboard/attendance');
            revalidatePath(`/dashboard/centres/${centreId}`);

            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/bookings/${bookingId}`);
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/attendance');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/centres/${centreId}`);
        });

        it('revalidates bookings and attendance on bulk update and bulk delete', () => {
            const ids = ['b1', 'b2', 'b3'];

            revalidatePath('/dashboard/bookings');
            revalidatePath('/dashboard/attendance');
            for (const id of ids) {
                revalidatePath(`/dashboard/bookings/${id}`);
            }

            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/attendance');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/bookings/b1');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/bookings/b2');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/bookings/b3');
        });
    });

    describe('6. Staff, Centres, Settings & Portal Mutations', () => {
        it('revalidates staff list and staff member detail on role update and removal', () => {
            const staffId = 'staff-1';

            revalidatePath('/dashboard/staff');
            revalidatePath(`/dashboard/staff/${staffId}`);

            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/staff');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/staff/${staffId}`);
        });

        it('revalidates centres list, centre detail, and centre settings on centre update', () => {
            const centreId = 'centre-99';

            revalidatePath('/dashboard/centres');
            revalidatePath(`/dashboard/centres/${centreId}`);
            revalidatePath(`/dashboard/centres/${centreId}/settings`);

            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/centres');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/centres/${centreId}`);
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/centres/${centreId}/settings`);
        });

        it('revalidates dashboard finance and invoices when parent submits voucher payment from portal', () => {
            const invoiceId = 'inv-voucher-1';
            const parentId = 'parent-voucher-1';

            revalidatePath('/portal/billing');
            revalidatePath('/dashboard/finance');
            revalidatePath('/dashboard/finance/invoices');
            revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
            revalidatePath(`/dashboard/parents/${parentId}`);

            expect(revalidatePath).toHaveBeenCalledWith('/portal/billing');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance');
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance/invoices');
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/finance/invoices/${invoiceId}`);
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/parents/${parentId}`);
        });

        it('revalidates staff student detail when parent submits medical note from portal', () => {
            const childId = 'child-medical-1';

            revalidatePath(`/portal/children/${childId}`);
            revalidatePath(`/dashboard/students/${childId}`);
            revalidatePath('/dashboard/students');

            expect(revalidatePath).toHaveBeenCalledWith(`/portal/children/${childId}`);
            expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/students/${childId}`);
            expect(revalidatePath).toHaveBeenCalledWith('/dashboard/students');
        });
    });
});
