import { logger } from '@/lib/logger';

import 'dotenv/config';

logger.info('Checking Stripe Configuration...');
logger.info('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ DEFINED' : '❌ MISSING');
logger.info('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? '✅ DEFINED' : '❌ MISSING');
logger.info('STRIPE_FREE_PRICE_ID:', process.env.STRIPE_FREE_PRICE_ID ? '✅ DEFINED' : '❌ MISSING');
logger.info('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? '✅ DEFINED' : '❌ MISSING');
