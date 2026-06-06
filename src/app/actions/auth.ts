'use server';

import { signIn as nextAuthSignIn } from '@/lib/auth';

export async function signInWithGoogle(callbackUrl?: string) {
  await nextAuthSignIn('google', { 
    redirectTo: callbackUrl || '/dashboard' 
  });
}
