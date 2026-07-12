import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { children } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/cron/school-year-roll
 *
 * Secure global cron endpoint to roll all student school years forward by 1 year.
 * Executes automatically on September 1st.
 *
 * Secured by Authorization: Bearer <CRON_SECRET> header.
 */
export async function GET(req: NextRequest) {
  // 1. Authenticate cron caller
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron Roll] CRON_SECRET is not set — endpoint locked.');
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    // 2. Fetch all children globally
    const allChildren = await db
      .select({ id: children.id, schoolYear: children.schoolYear })
      .from(children);

    let rolledCount = 0;

    // 3. Perform updates inside transaction
    await db.transaction(async (tx) => {
      for (const child of allChildren) {
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

    console.log(`[Cron Roll] September 1st Rollover Completed: updated ${rolledCount} students.`);
    return NextResponse.json({ success: true, rolledCount });
  } catch (err: any) {
    console.error('[Cron Roll] Failed to run rollover cron:', err);
    return NextResponse.json({ error: err.message || 'Internal database error' }, { status: 500 });
  }
}

// Support POST requests as fallback for cron platforms that trigger via POST
export async function POST(req: NextRequest) {
  return GET(req);
}
