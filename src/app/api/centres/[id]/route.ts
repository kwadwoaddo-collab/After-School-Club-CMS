import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (session.user as any).role;
        if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        // Ensure the centre belongs to the user's organisation
        const existingCentre = await db.query.centres.findFirst({
            where: and(
                eq(centres.id, id),
                eq(centres.organisationId, session.user.organisationId)
            ),
        });

        if (!existingCentre) {
            return NextResponse.json({ error: 'Centre not found or access denied' }, { status: 404 });
        }

        // Validate and update fields
        // Validate and update fields
        const { sessionSlots, operatingHours, feeSelfFinance, feeAssistedFinance } = body;

        const updateData: any = {};
        if (sessionSlots !== undefined) {
            updateData.sessionSlots = Array.isArray(sessionSlots) ? JSON.stringify(sessionSlots) : null;
        }
        if (operatingHours !== undefined) {
            updateData.operatingHours = operatingHours ? JSON.stringify(operatingHours) : null;
        }
        if (feeSelfFinance !== undefined) {
            updateData.feeSelfFinance = feeSelfFinance === '' ? null : feeSelfFinance;
        }
        if (feeAssistedFinance !== undefined) {
            updateData.feeAssistedFinance = feeAssistedFinance === '' ? null : feeAssistedFinance;
        }

        const [updatedCentre] = await db
            .update(centres)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(centres.id, id))
            .returning();

        return NextResponse.json({ success: true, centre: updatedCentre });
    } catch (error) {
        console.error('Update centre error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
