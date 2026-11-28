import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ContractDocument } from '@/features/contracts/ContractDocument';
import { lookupContractForSigning } from '@/features/contracts/sign';
import { formatContractDate } from '@/features/contracts/template';
import { apiRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { SignForm } from './SignForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Sign your agreement',
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
};

const MESSAGES = {
    expired: ['This link has expired', 'Please ask your centre to send you a new link.'],
    signed: ['This agreement has already been signed', 'No further action is needed.'],
    revoked: ['This link is no longer valid', 'Please ask your centre to send you a new link.'],
    unavailable: ['This link is not valid', 'Check you used the latest link from your email, or ask your centre to send a new one.'],
    limited: ['Too many attempts', 'Please wait a minute and try again.'],
} as const;

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <main id="main-content" className="mx-auto min-h-screen max-w-3xl space-y-6 bg-page px-4 py-8 text-text">
            {children}
        </main>
    );
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const h = await headers();
    const ip = getClientIP(new Request('http://local', { headers: h }));
    const limit = await checkRateLimit(apiRateLimit, `contract-view:${ip}`, { fallbackPolicy: 'fail-safe-local', localLimit: 30 });
    const result = limit.success ? await lookupContractForSigning(token) : null;
    if (!result || result.state !== 'valid') {
        const [title, body] = MESSAGES[result ? (result.state as keyof typeof MESSAGES) : 'limited'];
        return (
            <Shell>
                <div role="status" className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                    <h1 className="text-xl font-bold text-text">{title}</h1>
                    <p className="mt-2 text-text-muted">{body}</p>
                </div>
            </Shell>
        );
    }
    return (
        <Shell>
            <div className="sm:hidden flex justify-end">
                <a
                    href="#sign-form"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-xs font-semibold text-accent shadow-sm hover:bg-page transition-colors"
                >
                    Jump to signature ↓
                </a>
            </div>
            <ContractDocument values={result.view.values} />
            <SignForm token={token} todayLabel={formatContractDate(new Date())} />
        </Shell>
    );
}
