import { logger } from '@/lib/logger';

import 'dotenv/config';

logger.info('Checking Environment Variables for Google Auth...');
logger.info('AUTH_GOOGLE_ID:', process.env.AUTH_GOOGLE_ID ? '✅ DEFINED' : '❌ MISSING');
logger.info('AUTH_GOOGLE_SECRET:', process.env.AUTH_GOOGLE_SECRET ? '✅ DEFINED' : '❌ MISSING');
logger.info('NEXTAUTH_URL:', process.env.NEXTAUTH_URL ? '✅ DEFINED' : '❌ MISSING (Optional in Vercel/Next but good for local)');
logger.info('AUTH_SECRET:', process.env.AUTH_SECRET ? '✅ DEFINED' : '❌ MISSING');
