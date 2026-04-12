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
        const { 
            sessionSlots, 
            operatingHours, 
            feeSelfFinance, 
            feeAssistedFinance,
            bankName,
            sortCode,
            accountNo,
            ofstedId,
            managerName,
            billingPhone,
            billingEmail,
            signatureUrl
        } = body;

        // Strict RBAC: Only ORG_OWNER can update billing details
        const isUpdatingBilling = bankName !== undefined || 
                                 sortCode !== undefined || 
                                 accountNo !== undefined || 
                                 ofstedId !== undefined || 
                                 managerName !== undefined || 
                                 billingPhone !== undefined ||
                                 billingEmail !== undefined ||
                                 signatureUrl !== undefined ||
                                 feeSelfFinance !== undefined ||
                                 feeAssistedFinance !== undefined;

        if (isUpdatingBilling && userRole !== 'ORG_OWNER') {
            return NextResponse.json({ error: 'Only organisation owners can update billing settings' }, { status: 403 });
        }

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
        if (bankName !== undefined) updateData.bankName = bankName;
        if (sortCode !== undefined) updateData.sortCode = sortCode;
        if (accountNo !== undefined) updateData.accountNo = accountNo;
        if (ofstedId !== undefined) updateData.ofstedId = ofstedId;
        if (managerName !== undefined) updateData.managerName = managerName;
        if (billingPhone !== undefined) updateData.billingPhone = billingPhone;
        if (billingEmail !== undefined) updateData.billingEmail = billingEmail;
        if (signatureUrl !== undefined) updateData.signatureUrl = signatureUrl;

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
