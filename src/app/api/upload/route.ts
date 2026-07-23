import { NextRequest, NextResponse } from 'next/server';
import { uploadToBlob } from '@/lib/services/blob';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Generate a unique filename to prevent collisions
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `uploads/${timestamp}-${safeName}`;

        const url = await uploadToBlob(file, filename);
        
        return NextResponse.json({ url }, { status: 201 });
    } catch (error) {
        logger.error('[API /upload] File upload failed:', error);
        return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
    }
}
