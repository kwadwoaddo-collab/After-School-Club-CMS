import { redirect } from 'next/navigation';

/**
 * Redirect /dashboard/settings/registration → /dashboard/settings?tab=registration
 * Handles legacy links and ensures deep-links into registration settings work.
 */
export default function SettingsRegistrationRedirect() {
    redirect('/dashboard/settings?tab=registration');
}
