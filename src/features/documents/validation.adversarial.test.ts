import { describe, expect, it } from 'vitest';
import { documentName, MAX_PDF_BYTES, validatePdf } from './validation';
const pdf = (name = 'policy.pdf', type = 'application/pdf', bytes = '%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF') => new File([bytes], name, { type });
describe('centre PDF validation adversarial inputs', () => {
    it('accepts ordinary staff document names rather than matching literal escape characters', () => {
        expect(documentName.parse('First aid policy 2026')).toBe('First aid policy 2026');
    });
    it.each(['Policy\u0000hidden', 'Policy\u001fhidden', 'Policy\u007fhidden'])('rejects control characters in names', name => {
        expect(documentName.safeParse(name).success).toBe(false);
    });
    it('sanitises path and control filename characters', async () => {
        const result = await validatePdf(pdf('../folder\\policy\u0000.pdf'));
        expect(result.originalFilename).not.toMatch(/[\u0000-\u001f\u007f/\\]/);
        expect(result.originalFilename).toContain('policy');
    });
    it('rejects empty and oversized uploads before content parsing', async () => {
        await expect(validatePdf(new File([], 'empty.pdf', { type: 'application/pdf' }))).rejects.toThrow('3 MB');
        await expect(validatePdf(new File([new Uint8Array(MAX_PDF_BYTES + 1)], 'large.pdf', { type: 'application/pdf' }))).rejects.toThrow('3 MB');
    });
    it('requires filename, MIME, PDF signature and end marker together', async () => {
        await expect(validatePdf(pdf('policy.html'))).rejects.toThrow('Only PDF');
        await expect(validatePdf(pdf('policy.pdf', 'text/html'))).rejects.toThrow('Only PDF');
        await expect(validatePdf(pdf('policy.pdf', 'application/pdf', '<html>%%EOF'))).rejects.toThrow('complete PDF');
        await expect(validatePdf(pdf('policy.pdf', 'application/pdf', '%PDF-1.7 incomplete'))).rejects.toThrow('complete PDF');
    });
});
