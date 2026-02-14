
import 'dotenv/config';

console.log('Checking Environment Variables for Google Auth...');
console.log('AUTH_GOOGLE_ID:', process.env.AUTH_GOOGLE_ID ? '✅ DEFINED' : '❌ MISSING');
console.log('AUTH_GOOGLE_SECRET:', process.env.AUTH_GOOGLE_SECRET ? '✅ DEFINED' : '❌ MISSING');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL ? '✅ DEFINED' : '❌ MISSING (Optional in Vercel/Next but good for local)');
console.log('AUTH_SECRET:', process.env.AUTH_SECRET ? '✅ DEFINED' : '❌ MISSING');
