import { NextRequest, NextResponse } from 'next/server';
import { registrationSchema } from '@/lib/validations/registration';
import { db } from '@/db';
import { studentRegistrations } from '@/db/schema';
import { z } from 'zod';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate input
        const validatedData = registrationSchema.parse(body);

        // Save to database
        // Note: We are using "mock" IDs in the frontend demo. 
        // In production, ensure the centreId is a valid UUID existing in your database.
        // If you haven't seeded centres yet, this might fail on foreign key constraint.

        // For now, we'll try to insert. If foreign key fails, we catch it.

        const result = await db.insert(studentRegistrations).values({
            centreId: validatedData.centreId,
            parentFirstName: validatedData.parent.firstName,
            parentLastName: validatedData.parent.lastName,
            email: validatedData.parent.email,
            phone: validatedData.parent.phone,
            relationship: validatedData.parent.relationship,
            childFirstName: validatedData.child.firstName,
            childLastName: validatedData.child.lastName,
            dateOfBirth: new Date(validatedData.child.dateOfBirth),
            schoolYear: validatedData.child.schoolYear,
            notes: validatedData.child.notes,
            subjects: validatedData.child.subjects,
            preferredDays: validatedData.preferences.preferredDays,
            preferredTimes: validatedData.preferences.preferredTimes,
            lessonType: validatedData.preferences.lessonType,
            marketingConsent: validatedData.consent.marketing || false,
            status: 'pending',
        }).returning();

        return NextResponse.json({ success: true, message: 'Registration received', registrationId: result[0].id });

    } catch (error) {
        console.error('Registration error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
