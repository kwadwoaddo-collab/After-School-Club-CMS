import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveActiveCentreId } from './centre-filter';
import { cookies } from 'next/headers';

vi.mock('next/headers', () => {
    const mockCookieStore = {
        get: vi.fn(),
    };
    return {
        cookies: vi.fn().mockImplementation(() => Promise.resolve(mockCookieStore)),
    };
});

describe('resolveActiveCentreId', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should default to first accessible centre if no URL param or cookie is present', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue(undefined);

        const result = await resolveActiveCentreId(undefined, ['centre-1', 'centre-2']);
        expect(result).toBe('centre-1');
    });

    it('should default to all if no URL param or cookie is present and accessible centre is empty', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue(undefined);

        const result = await resolveActiveCentreId(undefined, []);
        expect(result).toBe('all');
    });

    it('should resolve to URL param if valid', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue(undefined);

        const result = await resolveActiveCentreId('centre-2', ['centre-1', 'centre-2']);
        expect(result).toBe('centre-2');
    });

    it('should resolve to cookie if valid and no URL param is present', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue({ name: 'selected_centre_id', value: 'centre-2' });

        const result = await resolveActiveCentreId(undefined, ['centre-1', 'centre-2']);
        expect(result).toBe('centre-2');
    });

    it('should prioritize URL param over cookie', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue({ name: 'selected_centre_id', value: 'centre-1' });

        const result = await resolveActiveCentreId('centre-2', ['centre-1', 'centre-2']);
        expect(result).toBe('centre-2');
    });

    it('should fall back to first accessible centre if URL param is invalid', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue(undefined);

        const result = await resolveActiveCentreId('invalid-centre', ['centre-1', 'centre-2']);
        expect(result).toBe('centre-1');
    });

    it('should fall back to first accessible centre if cookie is invalid', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue({ name: 'selected_centre_id', value: 'invalid-centre' });

        const result = await resolveActiveCentreId(undefined, ['centre-1', 'centre-2']);
        expect(result).toBe('centre-1');
    });

    it('should allow all as a valid active centre if accessible centres exist', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue(undefined);

        const result = await resolveActiveCentreId('all', ['centre-1', 'centre-2']);
        expect(result).toBe('all');
    });

    it('should allow all as a valid active centre if resolved from cookie', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue({ name: 'selected_centre_id', value: 'all' });

        const result = await resolveActiveCentreId(undefined, ['centre-1', 'centre-2']);
        expect(result).toBe('all');
    });

    it('should handle URL parameters that are arrays', async () => {
        const mockCookies = await cookies();
        vi.mocked(mockCookies.get).mockReturnValue(undefined);

        const result = await resolveActiveCentreId(['centre-2', 'centre-1'], ['centre-1', 'centre-2']);
        expect(result).toBe('centre-2');
    });
});
