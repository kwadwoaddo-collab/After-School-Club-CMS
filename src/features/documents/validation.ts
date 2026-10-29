import { z } from 'zod';
export const MAX_PDF_BYTES = 3 * 1024 * 1024;
export const MAX_CENTRE_DOCUMENTS = 20;
export const documentName = z.string().trim().min(1, 'Enter a document name.').max(120, 'Use a name of 120 characters or fewer.').refine(value => !/[\x00-\x1f\x7f]/.test(value), 'Use a name without control characters.');
export const documentIdentity = z.object({ centreId: z.string().uuid(), documentId: z.string().uuid(), version: z.number().int().positive() });
export async function validatePdf(file: unknown) {
    if (!(file instanceof File)) throw new Error('Choose a PDF file.');
    if (!file.size || file.size > MAX_PDF_BYTES) throw new Error('Choose a PDF no larger than 3 MB.');
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Only PDF files are supported.');
    const content = Buffer.from(await file.arrayBuffer());
    if (content.subarray(0, 5).toString('ascii') !== '%PDF-' || !content.subarray(-1024).includes(Buffer.from('%%EOF'))) throw new Error('This file does not appear to be a complete PDF.');
    const originalFilename = file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(-200);
    return { content, originalFilename, sizeBytes: content.length };
}
