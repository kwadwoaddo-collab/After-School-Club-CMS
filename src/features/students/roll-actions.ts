'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { children } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export interface RollResult {
  success: boolean;
  rolledCount: number;
  message: string;
}

export async function rollSchoolYearsAction(): Promise<RollResult> {
  const session = await auth();
  if (!session?.user?.organisationId) {
    throw new Error('Unauthorized');
  }

  // Only ORG_OWNER can roll school years
  if ((session.user as any).role !== 'ORG_OWNER') {
    throw new Error('Forbidden');
  }

  const organisationId = session.user.organisationId;

  try {
    // 1. Fetch all children belonging strictly to this organisation
    const orgChildren = await db
      .select({ id: children.id, schoolYear: children.schoolYear })
      .from(children)
      .where(eq(children.organisationId, organisationId));

    let rolledCount = 0;

    // 2. Perform updates inside a transaction
    await db.transaction(async (tx) => {
      for (const child of orgChildren) {
        let newYear = child.schoolYear;
        const cleanYear = child.schoolYear.trim().toLowerCase();

        if (cleanYear === 'nursery') {
          newYear = 'Reception';
        } else if (cleanYear === 'reception') {
          newYear = '1';
        } else {
          // Parse numeric year
          const numericYear = parseInt(cleanYear.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(numericYear)) {
            if (numericYear >= 13) {
              newYear = 'Graduated';
            } else {
              newYear = (numericYear + 1).toString();
            }
          }
        }

        if (newYear !== child.schoolYear) {
          await tx
            .update(children)
            .set({ schoolYear: newYear, updatedAt: new Date() })
            .where(eq(children.id, child.id));
          rolledCount++;
        }
      }
    });

    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      rolledCount,
      message: `Successfully rolled school years forward for ${rolledCount} student${rolledCount !== 1 ? 's' : ''}.`,
    };
  } catch (err: any) {
    console.error('[Roll Action] Failed to roll school years:', err);
    return {
      success: false,
      rolledCount: 0,
      message: err.message || 'Failed to roll school years. Check system logs.',
    };
  }
}
