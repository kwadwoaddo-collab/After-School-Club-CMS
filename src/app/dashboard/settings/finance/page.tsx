import { redirect } from 'next/navigation';

/**
 * Redirect /dashboard/settings/finance → /dashboard/settings?tab=finance
 * Handles links from the Finance page "Configure Billing" CTA.
 */
export default function SettingsFinanceRedirect() {
    redirect('/dashboard/settings?tab=finance');
}
