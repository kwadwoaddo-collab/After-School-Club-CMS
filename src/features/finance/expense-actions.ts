'use server';

import { db } from '@/db';
import { auditEvents, centres, financeExpenses, orgMemberships } from '@/db/schema';
import { logger } from '@/lib/logger';
import { isOrgOwner } from '@/lib/permissions';
import { requireTenantSession } from '@/lib/session';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { parseStrictDecimalToPence } from './domain/payment-eligibility';

const PERMITTED_EXPENSE_CATEGORIES = [
  'general',
  'supplies_snacks',
  'staff_wages',
  'premises_hire',
  'activities_equipment',
  'admin_transport',
] as const;

export type FinanceExpenseCategory = (typeof PERMITTED_EXPENSE_CATEGORIES)[number];

const MAX_EXPENSE_PENCE = 100_000_000; // £1,000,000.00
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNextControlFlowError(err: unknown): boolean {
  if (
    err &&
    typeof err === 'object' &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string'
  ) {
    return ((err as { digest: string }).digest).startsWith('NEXT_');
  }
  return false;
}

function validateIsoDateString(dateStr: string): string {
  const trimmed = typeof dateStr === 'string' ? dateStr.trim() : '';
  const match = trimmed.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (!match) {
    throw new Error('Date must be in YYYY-MM-DD format.');
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 2020 || year > 2100) {
    throw new Error('Expense date year must be between 2020 and 2100.');
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() + 1 !== month ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${trimmed}.`);
  }
  return trimmed;
}

function validateAndNormalizeCategory(raw?: string | null): FinanceExpenseCategory {
  if (!raw || typeof raw !== 'string') return 'general';
  const normalized = raw.trim().toLowerCase();
  if ((PERMITTED_EXPENSE_CATEGORIES as readonly string[]).includes(normalized)) {
    return normalized as FinanceExpenseCategory;
  }
  return 'general';
}

function validateDescription(raw: string): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length < 1) {
    throw new Error('Please enter a description for the outgoing.');
  }
  if (trimmed.length > 300) {
    throw new Error('Description cannot exceed 300 characters.');
  }
  return trimmed;
}

function validateAmountToPence(rawAmount: string): number {
  const pence = parseStrictDecimalToPence(rawAmount);
  if (pence <= 0) {
    throw new Error('Amount must be greater than £0.00.');
  }
  if (pence > MAX_EXPENSE_PENCE) {
    throw new Error('Amount cannot exceed £1,000,000.00.');
  }
  return pence;
}

export interface CreateFinanceExpenseInput {
  centreId: string; // Centre UUID or 'split_all'
  expenseDate: string; // YYYY-MM-DD
  amount: string; // Decimal string e.g. '42.50'
  description: string;
  category?: string;
}

export interface UpdateFinanceExpenseInput {
  expenseId: string;
  centreId: string;
  expenseDate: string;
  amount: string;
  description: string;
  category?: string;
}

export interface DeleteFinanceExpenseInput {
  expenseId: string;
}

export async function createFinanceExpense(
  input: CreateFinanceExpenseInput
): Promise<{ success: boolean; error?: string; createdCount?: number }> {
  try {
    const session = await requireTenantSession();
    const userId = session.user.id;
    const organisationId = session.user.organisationId;
    if (!organisationId) {
      return { success: false, error: 'Missing organisation context.' };
    }

    const ownerCheck = await isOrgOwner(userId);
    if (!ownerCheck) {
      return { success: false, error: 'Forbidden: Only Organisation Owners can record outgoings.' };
    }

    const expenseDate = validateIsoDateString(input.expenseDate);
    const amountPence = validateAmountToPence(input.amount);
    const description = validateDescription(input.description);
    const category = validateAndNormalizeCategory(input.category);
    const centreIdRaw = typeof input.centreId === 'string' ? input.centreId.trim() : '';

    if (!centreIdRaw) {
      return { success: false, error: 'Please select a centre for this outgoing.' };
    }

    const createdCount = await db.transaction(async (tx) => {
      const liveMembership = await tx.query.orgMemberships.findFirst({
        where: and(
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.organisationId, organisationId),
          eq(orgMemberships.role, 'ORG_OWNER')
        ),
      });
      if (!liveMembership) {
        throw new Error('Forbidden: Active ORG_OWNER membership required.');
      }

      if (centreIdRaw === 'split_all') {
        const orgCentres = await tx
          .select({ id: centres.id, name: centres.name })
          .from(centres)
          .where(eq(centres.organisationId, organisationId))
          .orderBy(asc(centres.name));

        if (orgCentres.length === 0) {
          throw new Error('No centres found in your organisation to split this outgoing across.');
        }

        const baseShare = Math.floor(amountPence / orgCentres.length);
        const remainder = amountPence - baseShare * orgCentres.length;
        if (baseShare <= 0) {
          throw new Error('Amount is too small to split across all centres.');
        }

        const splitDescription = description.startsWith('[Split]')
          ? description
          : `[Split] ${description}`.slice(0, 300);

        const insertedIds: string[] = [];
        for (let i = 0; i < orgCentres.length; i += 1) {
          const sharePence = i === 0 ? baseShare + remainder : baseShare;
          const [row] = await tx
            .insert(financeExpenses)
            .values({
              organisationId,
              centreId: orgCentres[i].id,
              expenseDate,
              amountPence: sharePence,
              description: splitDescription,
              category,
              createdBy: userId,
              updatedBy: userId,
            })
            .returning({ id: financeExpenses.id });
          insertedIds.push(row.id);
        }

        await tx.insert(auditEvents).values({
          organisationId,
          userId,
          eventType: 'finance_expense_recorded',
          eventData: JSON.stringify({
            mode: 'split_all',
            expenseIds: insertedIds,
            expenseDate,
            totalAmountPence: amountPence,
            description: splitDescription,
            category,
            centreCount: orgCentres.length,
          }),
        });

        return insertedIds.length;
      }

      if (!UUID_REGEX.test(centreIdRaw)) {
        throw new Error('Invalid centre selection.');
      }

      const targetCentre = await tx.query.centres.findFirst({
        where: and(eq(centres.id, centreIdRaw), eq(centres.organisationId, organisationId)),
        columns: { id: true, name: true },
      });
      if (!targetCentre) {
        throw new Error('Selected centre does not belong to your organisation.');
      }

      const [created] = await tx
        .insert(financeExpenses)
        .values({
          organisationId,
          centreId: targetCentre.id,
          expenseDate,
          amountPence,
          description,
          category,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning({ id: financeExpenses.id });

      await tx.insert(auditEvents).values({
        organisationId,
        userId,
        eventType: 'finance_expense_recorded',
        eventData: JSON.stringify({
          mode: 'single_centre',
          expenseId: created.id,
          centreId: targetCentre.id,
          centreName: targetCentre.name,
          expenseDate,
          amountPence,
          description,
          category,
        }),
      });

      return 1;
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard');

    return { success: true, createdCount };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Unable to record outgoing.';
    logger.warn('createFinanceExpense failed', { err });
    return { success: false, error: message };
  }
}

export async function updateFinanceExpense(
  input: UpdateFinanceExpenseInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireTenantSession();
    const userId = session.user.id;
    const organisationId = session.user.organisationId;
    if (!organisationId) {
      return { success: false, error: 'Missing organisation context.' };
    }

    const ownerCheck = await isOrgOwner(userId);
    if (!ownerCheck) {
      return { success: false, error: 'Forbidden: Only Organisation Owners can update outgoings.' };
    }

    const expenseId = typeof input.expenseId === 'string' ? input.expenseId.trim() : '';
    if (!UUID_REGEX.test(expenseId)) {
      return { success: false, error: 'Invalid outgoing identifier.' };
    }

    const centreId = typeof input.centreId === 'string' ? input.centreId.trim() : '';
    if (!UUID_REGEX.test(centreId)) {
      return { success: false, error: 'Please select a valid centre.' };
    }

    const expenseDate = validateIsoDateString(input.expenseDate);
    const amountPence = validateAmountToPence(input.amount);
    const description = validateDescription(input.description);
    const category = validateAndNormalizeCategory(input.category);

    await db.transaction(async (tx) => {
      const liveMembership = await tx.query.orgMemberships.findFirst({
        where: and(
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.organisationId, organisationId),
          eq(orgMemberships.role, 'ORG_OWNER')
        ),
      });
      if (!liveMembership) {
        throw new Error('Forbidden: Active ORG_OWNER membership required.');
      }

      const existing = await tx.query.financeExpenses.findFirst({
        where: and(
          eq(financeExpenses.id, expenseId),
          eq(financeExpenses.organisationId, organisationId),
          isNull(financeExpenses.deletedAt)
        ),
      });
      if (!existing) {
        throw new Error('Outgoing record not found or already deleted.');
      }

      const targetCentre = await tx.query.centres.findFirst({
        where: and(eq(centres.id, centreId), eq(centres.organisationId, organisationId)),
        columns: { id: true, name: true },
      });
      if (!targetCentre) {
        throw new Error('Selected centre does not belong to your organisation.');
      }

      await tx
        .update(financeExpenses)
        .set({
          centreId: targetCentre.id,
          expenseDate,
          amountPence,
          description,
          category,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(financeExpenses.id, expenseId),
            eq(financeExpenses.organisationId, organisationId),
            isNull(financeExpenses.deletedAt)
          )
        );

      await tx.insert(auditEvents).values({
        organisationId,
        userId,
        eventType: 'finance_expense_updated',
        eventData: JSON.stringify({
          expenseId,
          before: {
            centreId: existing.centreId,
            expenseDate: existing.expenseDate,
            amountPence: existing.amountPence,
            description: existing.description,
            category: existing.category,
          },
          after: {
            centreId: targetCentre.id,
            expenseDate,
            amountPence,
            description,
            category,
          },
        }),
      });
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Unable to update outgoing.';
    logger.warn('updateFinanceExpense failed', { err });
    return { success: false, error: message };
  }
}

export async function deleteFinanceExpense(
  input: DeleteFinanceExpenseInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireTenantSession();
    const userId = session.user.id;
    const organisationId = session.user.organisationId;
    if (!organisationId) {
      return { success: false, error: 'Missing organisation context.' };
    }

    const ownerCheck = await isOrgOwner(userId);
    if (!ownerCheck) {
      return { success: false, error: 'Forbidden: Only Organisation Owners can delete outgoings.' };
    }

    const expenseId = typeof input.expenseId === 'string' ? input.expenseId.trim() : '';
    if (!UUID_REGEX.test(expenseId)) {
      return { success: false, error: 'Invalid outgoing identifier.' };
    }

    await db.transaction(async (tx) => {
      const liveMembership = await tx.query.orgMemberships.findFirst({
        where: and(
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.organisationId, organisationId),
          eq(orgMemberships.role, 'ORG_OWNER')
        ),
      });
      if (!liveMembership) {
        throw new Error('Forbidden: Active ORG_OWNER membership required.');
      }

      const existing = await tx.query.financeExpenses.findFirst({
        where: and(
          eq(financeExpenses.id, expenseId),
          eq(financeExpenses.organisationId, organisationId),
          isNull(financeExpenses.deletedAt)
        ),
      });
      if (!existing) {
        throw new Error('Outgoing record not found or already deleted.');
      }

      const now = new Date();
      await tx
        .update(financeExpenses)
        .set({
          deletedAt: now,
          deletedBy: userId,
          updatedBy: userId,
          updatedAt: now,
        })
        .where(
          and(
            eq(financeExpenses.id, expenseId),
            eq(financeExpenses.organisationId, organisationId),
            isNull(financeExpenses.deletedAt)
          )
        );

      await tx.insert(auditEvents).values({
        organisationId,
        userId,
        eventType: 'finance_expense_deleted',
        eventData: JSON.stringify({
          expenseId,
          centreId: existing.centreId,
          expenseDate: existing.expenseDate,
          amountPence: existing.amountPence,
          description: existing.description,
          category: existing.category,
        }),
      });
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Unable to delete outgoing.';
    logger.warn('deleteFinanceExpense failed', { err });
    return { success: false, error: message };
  }
}
