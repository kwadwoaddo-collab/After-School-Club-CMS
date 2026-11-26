import { describe, expect, it } from 'vitest';
import {
    normaliseWhatsAppPhone,
    buildWhatsAppUrl,
    formatWhatsAppRecipientDisplay,
    buildInvoiceWhatsAppMessage,
    buildBroadcastWhatsAppMessage,
    buildCommunityWhatsAppCopy,
} from '../whatsapp';

describe('src/lib/whatsapp — normaliseWhatsAppPhone & message builders', () => {
    it('normalises standard UK mobile and landline formats to 44... digits', () => {
        expect(normaliseWhatsAppPhone('07700 900123')).toBe('447700900123');
        expect(normaliseWhatsAppPhone('+44 7700 900123')).toBe('447700900123');
        expect(normaliseWhatsAppPhone('+44 (0) 7700 900123')).toBe('447700900123');
        expect(normaliseWhatsAppPhone('0044 (0)7700-900-123')).toBe('447700900123');
        expect(normaliseWhatsAppPhone('4407700900123')).toBe('447700900123');
        expect(normaliseWhatsAppPhone('447700900123')).toBe('447700900123');
        expect(normaliseWhatsAppPhone('020 7946 0991')).toBe('442079460991');
    });

    it('normalises 10-digit UK mobiles with spreadsheet-stripped leading zero (e.g. 7578550316)', () => {
        expect(normaliseWhatsAppPhone('7578550316')).toBe('447578550316');
        expect(normaliseWhatsAppPhone('7578 550 316')).toBe('447578550316');
    });

    it('normalises valid international + and 00 numbers and rejects invalid strings', () => {
        expect(normaliseWhatsAppPhone('+353 87 123 4567')).toBe('353871234567');
        expect(normaliseWhatsAppPhone('00233 24 123 4567')).toBe('233241234567');

        expect(normaliseWhatsAppPhone('')).toBeNull();
        expect(normaliseWhatsAppPhone(null)).toBeNull();
        expect(normaliseWhatsAppPhone('parent@example.com')).toBeNull();
        expect(normaliseWhatsAppPhone('N/A')).toBeNull();
        expect(normaliseWhatsAppPhone('12345')).toBeNull();
        expect(normaliseWhatsAppPhone('+44 123')).toBeNull();
    });

    it('builds URL-encoded wa.me links and formats whatsapp: recipient labels', () => {
        const url = buildWhatsAppUrl('7578550316', 'Hi Nga, your invoice is ready.');
        expect(url).toBe('https://wa.me/447578550316?text=Hi%20Nga%2C%20your%20invoice%20is%20ready.');
        expect(buildWhatsAppUrl('07700900123')).toBe('https://wa.me/447700900123');
        expect(buildWhatsAppUrl('invalid')).toBeNull();

        expect(formatWhatsAppRecipientDisplay('whatsapp:+447578550316')).toBe('+44 7578 550316');
        expect(formatWhatsAppRecipientDisplay('parent@example.com')).toBe('parent@example.com');
    });

    it('generates Tuition vs Childcare invoice and receipt messages without sensitive child data', () => {
        const unpaidTuition = buildInvoiceWhatsAppMessage({
            parentFirstName: 'Nga',
            invoiceNumber: 'INV-PZRJ9Z',
            amountFormatted: '180.00',
            dueDateFormatted: '01/12/2026',
            periodFormatted: '1 Dec – 31 Dec 2026',
            serviceType: 'tuition',
            isPaid: false,
            organisationName: 'Sydenham After School Club',
        });
        expect(unpaidTuition).toContain('Tuition invoice INV-PZRJ9Z');
        expect(unpaidTuition).not.toContain('Childcare');
        expect(unpaidTuition).toContain('£180.00');
        expect(unpaidTuition).toContain('/portal/billing');

        const paidTuition = buildInvoiceWhatsAppMessage({
            parentFirstName: 'Nga',
            invoiceNumber: 'INV-VH91BK',
            amountFormatted: '180.00',
            serviceType: 'tuition',
            isPaid: true,
            organisationName: 'Sydenham After School Club',
        });
        expect(paidTuition).toContain('thank you for your payment');
        expect(paidTuition).toContain('Tuition invoice INV-VH91BK');
        expect(paidTuition).toContain('download your receipt');
    });

    it('builds 1-to-1 and Community broadcast WhatsApp copy', () => {
        const personal = buildBroadcastWhatsAppMessage({
            firstName: 'Nga',
            subject: 'Inset Day Reminder',
            message: 'Sessions run at normal times on Friday.',
            centreName: 'Sydenham After School Club',
        });
        expect(personal).toContain('Hi Nga,');
        expect(personal).toContain('*Inset Day Reminder*');
        expect(personal).toContain('— Sydenham After School Club');

        const community = buildCommunityWhatsAppCopy({
            subject: 'Inset Day Reminder',
            message: 'Sessions run at normal times on Friday.',
            centreName: 'Sydenham After School Club',
        });
        expect(community.startsWith('*Inset Day Reminder*')).toBe(true);
        expect(community).toContain('— Sydenham After School Club');
    });
});
