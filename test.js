import { auth } from '@/lib/auth';
import FinancePage from './src/app/dashboard/finance/page';

// Mock auth
jest.mock('@/lib/auth', () => ({
    auth: jest.fn().mockResolvedValue({
        user: { organisationId: 'org_123', role: 'ORG_OWNER' }
    })
}));

async function runTest() {
    try {
        const page = await FinancePage({ searchParams: Promise.resolve({}) });
        console.log("Success");
    } catch (e) {
        console.error("Crash", e);
    }
}
runTest();
