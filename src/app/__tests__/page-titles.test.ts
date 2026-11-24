import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
vi.mock('geist/font/sans', () => ({ GeistSans: { variable: '' } }));
vi.mock('@/components/providers/SessionProvider', () => ({ default: () => null }));
import { metadata as root } from '../layout';
import { metadata as login } from '../login/layout';
import { metadata as staff } from '../staff-login/layout';
import { metadata as portal } from '../portal/login/layout';
import { metadata as signup } from '../signup/layout';

describe('Distinct page titles (X-03a)', () => {
    it('root defines a title template', () => {
        expect(root.title).toEqual({
            default: 'After School Club CMS',
            template: '%s · After-School Club CMS',
        });
    });
    it('auth doors have distinct titles', () => {
        const titles = [login, staff, portal, signup].map((m) => m.title);
        expect(new Set(titles).size).toBe(4);
    });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) return n === '__tests__' ? [] : walk(p);
        return /(page|layout)\.tsx$/.test(n) ? [p] : [];
    });
}

describe('No hard-coded brand suffix in titles (X-03a)', () => {
    it('no title string contains "| SprintScale"', () => {
        const offenders = walk(join(__dirname, '..')).filter((f) =>
            /title:[^\n]*\| SprintScale/.test(readFileSync(f, 'utf8')),
        );
        expect(offenders).toEqual([]);
    });
});
