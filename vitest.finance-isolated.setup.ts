import { vi } from 'vitest';
import { validateTestDatabaseUrl } from './src/features/finance/__tests__/helpers/test-db-guard';

// Fail-closed test database guard: verify TEST_DATABASE_URL before importing any db modules
const testDbUrl = process.env.TEST_DATABASE_URL;
const validation = validateTestDatabaseUrl(testDbUrl);

if (!validation.valid || !validation.url) {
  throw new Error(
    `[vitest.finance-isolated.setup] Isolated PostgreSQL Test DB Guard Failed:\n${validation.error}\n` +
      'Please ensure a local loopback PostgreSQL instance ending in _test is available and TEST_ALLOW_INSECURE_TLS=true is set.'
  );
}

// Redirect application DB singleton strictly to TEST_DATABASE_URL
process.env.DATABASE_URL = validation.url;

// Mock framework and non-database external side effects
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
  notFound: vi.fn(() => {
    const error = new Error('NEXT_NOT_FOUND') as Error & { digest: string };
    error.digest = 'NEXT_NOT_FOUND';
    throw error;
  }),
}));

vi.mock('@/lib/db-notifications', () => ({
  notifyOwners: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendInvoiceCreated: vi.fn().mockResolvedValue({ success: true }),
    sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
    sendVoucherPaymentVerified: vi.fn().mockResolvedValue(undefined),
    sendVoucherPaymentFailed: vi.fn().mockResolvedValue(undefined),
  },
}));
