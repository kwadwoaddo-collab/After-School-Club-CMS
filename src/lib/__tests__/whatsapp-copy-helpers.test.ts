import { describe, expect, it } from 'vitest';
import {
    buildParentGreetingMessage,
    buildParentGreetingWhatsAppUrl,
    buildWhatsAppUrl,
    formatPhoneForCopy,
} from '../whatsapp';

describe('formatPhoneForCopy', () => {
    it('formats UK mobiles as +44 7xxx xxxxxx from any accepted input style', () => {
        for (const raw of ['07700900123', '+44 7700 900123', '+44 (0) 7700 900123', '00447700900123', '7700900123']) {
            expect(formatPhoneForCopy(raw)).toBe('+44 7700 900123');
        }
    });
    it('formats other valid numbers as +digits', () => {
        expect(formatPhoneForCopy('020 7946 0000')).toBe('+442079460000');
        expect(formatPhoneForCopy('+353 87 123 4567')).toBe('+353871234567');
    });
    it('returns null for missing or invalid numbers', () => {
        expect(formatPhoneForCopy(null)).toBeNull();
        expect(formatPhoneForCopy('')).toBeNull();
        expect(formatPhoneForCopy('N/A')).toBeNull();
        expect(formatPhoneForCopy('12345')).toBeNull();
    });
});

describe('buildParentGreetingMessage', () => {
    it('is exactly the text the wa.me greeting link pre-fills (builder output unchanged)', () => {
        const withCentre = { phone: '07700900123', parentFirstName: ' Jane ', centreName: ' Dagenham Club ' };
        expect(buildParentGreetingMessage(withCentre)).toBe('Hi Jane, this is Dagenham Club. ');
        expect(buildParentGreetingWhatsAppUrl(withCentre)).toBe(
            buildWhatsAppUrl('07700900123', 'Hi Jane, this is Dagenham Club. '),
        );
        expect(buildParentGreetingWhatsAppUrl(withCentre)).toBe(
            'https://wa.me/447700900123?text=Hi%20Jane%2C%20this%20is%20Dagenham%20Club.',
        );

        const noCentre = { phone: '07700900123', parentFirstName: 'Jane' };
        expect(buildParentGreetingMessage(noCentre)).toBe('Hi Jane, ');
        expect(buildParentGreetingWhatsAppUrl(noCentre)).toBe('https://wa.me/447700900123?text=Hi%20Jane%2C');
    });
    it('returns undefined (link without text) when there is no first name', () => {
        expect(buildParentGreetingMessage({ parentFirstName: '  ', centreName: 'X' })).toBeUndefined();
        expect(buildParentGreetingWhatsAppUrl({ phone: '07700900123' })).toBe('https://wa.me/447700900123');
        expect(buildParentGreetingWhatsAppUrl({ phone: 'n/a', parentFirstName: 'Jane' })).toBeNull();
    });
});
