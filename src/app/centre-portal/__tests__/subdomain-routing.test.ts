import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { proxy } from '@/proxy';

const mockState = vi.hoisted(() => ({
    centreBySubdomain: null as Record<string, unknown> | null,
    orgById: null as Record<string, unknown> | null,
    orgBySubdomain: null as Record<string, unknown> | null,
    orgBySlug: null as Record<string, unknown> | null,
    selectOrgRows: [] as Array<Record<string, unknown>>,
    selectCentreRows: [] as Array<Record<string, unknown>>,
    findFirstCalls: [] as Array<{ table: string; arg: unknown }>,
}));

vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
    redirect: vi.fn((target: string) => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

vi.mock('@/lib/base-url', () => ({
    getTrustedApplicationUrl: vi.fn(() => 'https://app.sprintscaleit.co.uk'),
    getBaseUrl: vi.fn(() => 'https://app.sprintscaleit.co.uk'),
}));

vi.mock('@/features/bookings/components/BookingForm', () => ({
    default: ({ centreId, centreName }: { centreId: string; centreName: string }) =>
        React.createElement('div', { 'data-testid': 'booking-form', 'data-centre-id': centreId }, centreName),
}));

vi.mock('@/db', () => {
    let orgFindCallCount = 0;
    return {
        resetOrgCallCounter: () => {
            orgFindCallCount = 0;
        },
        db: {
            query: {
                centres: {
                    findFirst: vi.fn(async (arg: unknown) => {
                        mockState.findFirstCalls.push({ table: 'centres', arg });
                        return mockState.centreBySubdomain;
                    }),
                },
                organisations: {
                    findFirst: vi.fn(async (arg: { columns?: Record<string, boolean>; with?: unknown }) => {
                        mockState.findFirstCalls.push({ table: 'organisations', arg });
                        // OrgBookingPage / BookingPage generateMetadata lookup by slug
                        if (mockState.orgBySlug !== null) {
                            return mockState.orgBySlug;
                        }
                        // If a centre matched first, the 1st org lookup is by centre.organisationId,
                        // and any 2nd org lookup is the fallback by organisations.subdomain.
                        if (mockState.centreBySubdomain) {
                            orgFindCallCount += 1;
                            if (orgFindCallCount === 1) {
                                return mockState.orgById;
                            }
                        }
                        return mockState.orgBySubdomain;
                    }),
                },
            },
            select: vi.fn(() => {
                let targetTable: 'org' | 'centres' = 'org';
                const chain = {
                    from: vi.fn((tbl: { name?: string }) => {
                        const symName =
                            (tbl as Record<symbol, unknown>)[Symbol.for('drizzle:Name')] ||
                            tbl?.name ||
                            '';
                        targetTable = String(symName) === 'centres' ? 'centres' : 'org';
                        return chain;
                    }),
                    where: vi.fn(() => {
                        if (targetTable === 'centres') {
                            return Promise.resolve(mockState.selectCentreRows);
                        }
                        return chain;
                    }),
                    limit: vi.fn(async () => mockState.selectOrgRows),
                };
                return chain;
            }),
        },
    };
});

import CentrePortalLanding, {
    generateMetadata as generateLandingMetadata,
} from '../[subdomain]/page';
import CentrePortalBook, {
    generateMetadata as generateBookMetadata,
} from '../[subdomain]/book/page';
import CentrePortalRegister from '../[subdomain]/register/page';
import OrgBookingPage, {
    generateMetadata as generateOrgBookMetadata,
} from '../../book/[orgSlug]/page';
import BookingPage, {
    generateMetadata as generateCentreBookMetadata,
} from '../../book/[orgSlug]/[centreSlug]/page';

describe('Public subdomain routing, org fallback & ACTIVE gating (PR #10a: DC-01, JC-04, DC-12)', () => {
    beforeEach(async () => {
        mockState.centreBySubdomain = null;
        mockState.orgById = null;
        mockState.orgBySubdomain = null;
        mockState.orgBySlug = null;
        mockState.selectOrgRows = [];
        mockState.selectCentreRows = [];
        mockState.findFirstCalls = [];
        const dbMod = (await import('@/db')) as unknown as { resetOrgCallCounter: () => void };
        dbMod.resetOrgCallCounter();
        vi.clearAllMocks();
    });

    describe('DC-01: Subdomain /register and /book canonical redirects prevent 307 rewrite loops', () => {
        it('redirects centre subdomain /register to canonical app URL and does NOT get rewritten back by proxy', async () => {
            mockState.centreBySubdomain = {
                id: 'centre-1',
                slug: 'dagenham-club',
                organisationId: 'org-1',
            };
            mockState.orgById = {
                slug: 'sydenham-org',
                approvalStatus: 'ACTIVE',
            };

            await expect(
                CentrePortalRegister({ params: Promise.resolve({ subdomain: 'dagenham' }) })
            ).rejects.toThrow('NEXT_REDIRECT:https://app.sprintscaleit.co.uk/register/sydenham-org/dagenham-club');

            // Verify canonical target passes through proxy.ts without rewriting to /centre-portal/*
            const canonicalReq = new NextRequest(
                'https://app.sprintscaleit.co.uk/register/sydenham-org/dagenham-club',
                { headers: { host: 'app.sprintscaleit.co.uk' } }
            );
            const proxyRes = proxy(canonicalReq);
            expect(proxyRes.headers.get('x-middleware-rewrite')).toBeNull();
        });

        it('redirects org subdomain /register fallback to canonical /register/[orgSlug]', async () => {
            mockState.centreBySubdomain = null;
            mockState.orgBySubdomain = {
                slug: 'lewisham-org',
                approvalStatus: 'ACTIVE',
            };

            await expect(
                CentrePortalRegister({ params: Promise.resolve({ subdomain: 'lewisham' }) })
            ).rejects.toThrow('NEXT_REDIRECT:https://app.sprintscaleit.co.uk/register/lewisham-org');
        });

        it('redirects org subdomain /book fallback to canonical /book/[orgSlug] instead of looping relatively', async () => {
            mockState.centreBySubdomain = null;
            mockState.orgBySubdomain = {
                id: 'org-2',
                name: 'Lewisham Clubs',
                slug: 'lewisham-org',
                brandColor: '#0F5F5C',
                logoUrl: null,
                approvalStatus: 'ACTIVE',
            };

            await expect(
                CentrePortalBook({ params: Promise.resolve({ subdomain: 'lewisham' }) })
            ).rejects.toThrow('NEXT_REDIRECT:https://app.sprintscaleit.co.uk/book/lewisham-org');

            const canonicalBookReq = new NextRequest(
                'https://app.sprintscaleit.co.uk/book/lewisham-org',
                { headers: { host: 'app.sprintscaleit.co.uk' } }
            );
            const proxyRes = proxy(canonicalBookReq);
            expect(proxyRes.headers.get('x-middleware-rewrite')).toBeNull();
        });
    });

    describe('JC-04: organisations.subdomain fallback on landing and metadata', () => {
        it('renders organisation portal landing with canonical /book/[orgSlug] and /register/[orgSlug] links when centre subdomain is absent', async () => {
            mockState.centreBySubdomain = null;
            mockState.orgBySubdomain = {
                id: 'org-2',
                name: 'Lewisham After-School Club',
                slug: 'lewisham-org',
                brandColor: '#0F5F5C',
                logoUrl: null,
                address: '10 High Street, Lewisham',
                contactPhone: '02079460123',
                contactEmail: 'hello@lewishamclub.co.uk',
                approvalStatus: 'ACTIVE',
                centres: [{ id: 'c-1', name: 'Catford Centre', slug: 'catford', address: null }],
            };

            const meta = await generateLandingMetadata({
                params: Promise.resolve({ subdomain: 'lewisham' }),
            });
            expect(meta.title).toBe('Lewisham After-School Club — Book or Register');

            const bookMeta = await generateBookMetadata({
                params: Promise.resolve({ subdomain: 'lewisham' }),
            });
            expect(bookMeta.title).toBe('Book a Session — Lewisham After-School Club');

            const element = await CentrePortalLanding({
                params: Promise.resolve({ subdomain: 'lewisham' }),
            });
            const html = renderToStaticMarkup(element);

            expect(html).toContain('Lewisham After-School Club');
            expect(html).toContain('href="https://app.sprintscaleit.co.uk/book/lewisham-org"');
            expect(html).toContain('href="https://app.sprintscaleit.co.uk/register/lewisham-org"');
        });

        it('renders inline BookingForm when centre subdomain matches an ACTIVE organisation', async () => {
            mockState.centreBySubdomain = {
                id: 'centre-1',
                name: 'Dagenham Centre',
                slug: 'dagenham',
                address: '1 Heathway',
                operatingHours: '{}',
                organisationId: 'org-1',
            };
            mockState.orgById = {
                id: 'org-1',
                name: 'Sydenham Group',
                slug: 'sydenham-org',
                brandColor: '#4F46E5',
                logoUrl: null,
                approvalStatus: 'ACTIVE',
            };

            const element = await CentrePortalBook({
                params: Promise.resolve({ subdomain: 'dagenham' }),
            });
            const html = renderToStaticMarkup(element);
            expect(html).toContain('Dagenham Centre — Book a Session');
            expect(html).toContain('data-centre-id="centre-1"');
        });
    });

    describe('DC-12: Strict organisations.approvalStatus === ACTIVE gating across /centre-portal/* and /book/*', () => {
        it.each(['PENDING', 'SUSPENDED', 'REJECTED'] as const)(
            'blocks /centre-portal/* (landing, book, register) with notFound() when org status is %s',
            async (nonActiveStatus) => {
                // 1. Centre subdomain with non-ACTIVE parent org
                mockState.centreBySubdomain = {
                    id: 'centre-1',
                    name: 'Pending Centre',
                    slug: 'pending-centre',
                    organisationId: 'org-pending',
                    address: null,
                    operatingHours: null,
                    billingPhone: null,
                    billingEmail: null,
                };
                mockState.orgById = {
                    id: 'org-pending',
                    name: 'Pending Org',
                    slug: 'pending-org',
                    brandColor: '#4F46E5',
                    logoUrl: null,
                    approvalStatus: nonActiveStatus,
                };
                mockState.orgBySubdomain = null;

                await expect(
                    CentrePortalLanding({ params: Promise.resolve({ subdomain: 'pending' }) })
                ).rejects.toThrow('NEXT_NOT_FOUND');

                const dbMod = (await import('@/db')) as unknown as { resetOrgCallCounter: () => void };
                dbMod.resetOrgCallCounter();
                await expect(
                    CentrePortalBook({ params: Promise.resolve({ subdomain: 'pending' }) })
                ).rejects.toThrow('NEXT_NOT_FOUND');

                dbMod.resetOrgCallCounter();
                await expect(
                    CentrePortalRegister({ params: Promise.resolve({ subdomain: 'pending' }) })
                ).rejects.toThrow('NEXT_NOT_FOUND');

                // 2. Org subdomain fallback with non-ACTIVE org
                mockState.centreBySubdomain = null;
                mockState.orgBySubdomain = {
                    id: 'org-pending',
                    name: 'Pending Org',
                    slug: 'pending-org',
                    brandColor: '#4F46E5',
                    logoUrl: null,
                    address: null,
                    contactPhone: null,
                    contactEmail: null,
                    approvalStatus: nonActiveStatus,
                    centres: [],
                };

                await expect(
                    CentrePortalLanding({ params: Promise.resolve({ subdomain: 'pending-org' }) })
                ).rejects.toThrow('NEXT_NOT_FOUND');
                await expect(
                    CentrePortalBook({ params: Promise.resolve({ subdomain: 'pending-org' }) })
                ).rejects.toThrow('NEXT_NOT_FOUND');
                await expect(
                    CentrePortalRegister({ params: Promise.resolve({ subdomain: 'pending-org' }) })
                ).rejects.toThrow('NEXT_NOT_FOUND');
            }
        );

        it.each(['PENDING', 'SUSPENDED', 'REJECTED'] as const)(
            'blocks /book/[orgSlug] and /book/[orgSlug]/[centreSlug] with notFound() when org status is %s',
            async (nonActiveStatus) => {
                mockState.orgBySlug = {
                    id: 'org-non-active',
                    name: 'Non-Active Club',
                    slug: 'non-active-club',
                    brandColor: '#4F46E5',
                    logoUrl: null,
                    approvalStatus: nonActiveStatus,
                    centres: [{ id: 'c1', name: 'Main Centre', slug: 'main', address: null }],
                };
                mockState.selectOrgRows = [mockState.orgBySlug];

                await expect(
                    OrgBookingPage({ params: Promise.resolve({ orgSlug: 'non-active-club' }) })
                ).rejects.toThrow('NEXT_NOT_FOUND');

                const orgMeta = await generateOrgBookMetadata({
                    params: Promise.resolve({ orgSlug: 'non-active-club' }),
                });
                expect(orgMeta.title).toBe('Organisation Not Found');

                await expect(
                    BookingPage({
                        params: Promise.resolve({ orgSlug: 'non-active-club', centreSlug: 'main' }),
                        searchParams: Promise.resolve({}),
                    })
                ).rejects.toThrow('NEXT_NOT_FOUND');

                const centreMeta = await generateCentreBookMetadata({
                    params: Promise.resolve({ orgSlug: 'non-active-club', centreSlug: 'main' }),
                });
                expect(centreMeta.title).toBe('Centre Not Found');
            }
        );

        it('never compares approvalStatus against invalid enum literal APPROVED in any public route', () => {
            const root = path.resolve(__dirname, '../../../..');
            const files = [
                'src/app/centre-portal/[subdomain]/page.tsx',
                'src/app/centre-portal/[subdomain]/book/page.tsx',
                'src/app/centre-portal/[subdomain]/register/page.tsx',
                'src/app/book/[orgSlug]/page.tsx',
                'src/app/book/[orgSlug]/[centreSlug]/page.tsx',
            ];
            for (const rel of files) {
                const src = fs.readFileSync(path.join(root, rel), 'utf-8');
                expect(src, `${rel} must gate on ACTIVE`).toContain("'ACTIVE'");
                expect(src, `${rel} must never reference invalid enum APPROVED`).not.toContain("'APPROVED'");
                expect(src, `${rel} must never reference invalid enum APPROVED`).not.toContain('"APPROVED"');
            }
        });
    });
});
