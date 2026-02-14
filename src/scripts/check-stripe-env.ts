
import 'dotenv/config';

console.log('Checking Stripe Configuration...');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ DEFINED' : '❌ MISSING');
console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? '✅ DEFINED' : '❌ MISSING');
console.log('STRIPE_FREE_PRICE_ID:', process.env.STRIPE_FREE_PRICE_ID ? '✅ DEFINED' : '❌ MISSING');
console.log('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? '✅ DEFINED' : '❌ MISSING');
