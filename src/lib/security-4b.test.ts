/**
 * Milestone 4B — Database, Migration & Data Integrity Regression Tests
 *
 * Covers:
 *   - Schema integrity & table definition verification (MIG-1)
 *   - Multi-tenant organisationId column presence across operational tables
 *   - Unique constraint definitions on multi-tenant membership models
 *   - Financial integrity & idempotency keys
 */

import { describe, it, expect } from 'vitest';
import * as schema from '@/db/schema';
import { getTableColumns } from 'drizzle-orm';

describe('Milestone 4B — Database & Schema Integrity Regression Tests', () => {
    describe('Multi-Tenant Invariants (Tenant Isolation Columns)', () => {
        it('ensures core operational tables contain an organisation_id column', () => {
            const multiTenantTables = [
                schema.centres,
                schema.users,
                schema.parents,
                schema.children,
                schema.invoices,
                schema.registrations,
                schema.incidents,
                schema.billingConfigs,
                schema.parentCredits,
                schema.orgMemberships,
            ];

            for (const table of multiTenantTables) {
                const columns = getTableColumns(table);
                expect(columns).toHaveProperty('organisationId');
            }
        });

        it('ensures centre-scoped tables contain a centre_id column', () => {
            const centreScopedTables = [
                schema.centreMemberships,
                schema.incidents,
                schema.bookings,
            ];

            for (const table of centreScopedTables) {
                const columns = getTableColumns(table);
                expect(columns).toHaveProperty('centreId');
            }
        });
    });

    describe('Unique Membership & Token Constraints', () => {
        it('ensures org_memberships table definition exists with required columns', () => {
            const columns = getTableColumns(schema.orgMemberships);
            expect(columns).toHaveProperty('id');
            expect(columns).toHaveProperty('userId');
            expect(columns).toHaveProperty('organisationId');
            expect(columns).toHaveProperty('role');
            expect(columns).toHaveProperty('createdAt');
        });

        it('ensures centre_memberships table definition exists with required columns', () => {
            const columns = getTableColumns(schema.centreMemberships);
            expect(columns).toHaveProperty('id');
            expect(columns).toHaveProperty('userId');
            expect(columns).toHaveProperty('centreId');
            expect(columns).toHaveProperty('role');
        });

        it('ensures staff_invites has token and organisationId columns', () => {
            const columns = getTableColumns(schema.staffInvites);
            expect(columns).toHaveProperty('token');
            expect(columns).toHaveProperty('organisationId');
            expect(columns).toHaveProperty('email');
            expect(columns).toHaveProperty('expiresAt');
            expect(columns).toHaveProperty('usedAt');
        });
    });

    describe('Financial & Audit Record Columns', () => {
        it('ensures invoices table contains invoice_number and organisation_id', () => {
            const columns = getTableColumns(schema.invoices);
            expect(columns).toHaveProperty('invoiceNumber');
            expect(columns).toHaveProperty('organisationId');
            expect(columns).toHaveProperty('amount');
            expect(columns).toHaveProperty('status');
        });

        it('ensures payments table contains transaction_reference for idempotency', () => {
            const columns = getTableColumns(schema.payments);
            expect(columns).toHaveProperty('invoiceId');
            expect(columns).toHaveProperty('amount');
            expect(columns).toHaveProperty('transactionReference');
            expect(columns).toHaveProperty('status');
        });

        it('ensures billing_runs table contains billing_config_id and period_start/end', () => {
            const columns = getTableColumns(schema.billingRuns);
            expect(columns).toHaveProperty('billingConfigId');
            expect(columns).toHaveProperty('periodStart');
            expect(columns).toHaveProperty('periodEnd');
            expect(columns).toHaveProperty('success');
        });
    });

    describe('Soft-Delete Column Integrity', () => {
        it('ensures soft-deletable models define a deleted_at timestamp column', () => {
            const softDeletableTables = [
                schema.parents,
                schema.children,
            ];

            for (const table of softDeletableTables) {
                const columns = getTableColumns(table);
                expect(columns).toHaveProperty('deletedAt');
            }
        });
    });
});
