import Link from 'next/link';
import { CURRENT_TERMS_VERSION, CURRENT_TERMS_EFFECTIVE_DATE } from '@/lib/constants/legal';

export const metadata = {
  title: 'Terms of Service',
  description: 'SprintScale terms of service for tuition centres and childcare organisations.',
};

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]';

function BrandLockup() {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 min-h-[44px] text-text ${focusRing}`}
      aria-label="After-School Club CMS · by SprintScale IT"
    >
      <span className="w-9 h-9 rounded-lg bg-accent text-on-accent inline-flex items-center justify-center font-bold text-lg" aria-hidden="true">S</span>
      <span className="flex flex-col leading-tight text-left">
        <span className="font-bold text-sm text-text">After-School Club CMS</span>
        <span className="text-xs text-text-muted">by SprintScale IT</span>
      </span>
    </Link>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-page text-text px-4 sm:px-6 py-10">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-accent focus:text-on-accent focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="max-w-3xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-border">
          <BrandLockup />
          <nav aria-label="Legal navigation" className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className={`min-h-[44px] inline-flex items-center text-text-secondary hover:text-text transition-colors ${focusRing}`}>
              Privacy Policy
            </Link>
            <Link href="/signup" className={`min-h-[44px] inline-flex items-center font-semibold text-accent hover:text-accent-hover transition-colors ${focusRing}`}>
              Sign Up
            </Link>
          </nav>
        </header>

        <main id="main-content" tabIndex={-1} className="bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-xs">
          <div className="mb-8">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20 mb-3">
              Product Terms · Version {CURRENT_TERMS_VERSION}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-text mb-2">Terms of Service</h1>
            <p className="text-sm text-text-muted">
              Effective Date: {CURRENT_TERMS_EFFECTIVE_DATE}
            </p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed text-text-secondary">
            <section>
              <h2 className="text-lg font-bold text-text mb-2">1. Agreement to Terms</h2>
              <p>
                These Terms of Service (&quot;Terms&quot;) govern your access to and use of the SprintScale management
                platform (&quot;Platform&quot; or &quot;Service&quot;), provided by SprintScale IT. By registering an account,
                establishing an organisation, or using the Service, you agree to be bound by these Terms. If you are
                agreeing to these Terms on behalf of an organisation, tuition centre, or business entity, you represent
                that you have the authority to bind that entity.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">2. SaaS Platform Services &amp; Organisation Approval</h2>
              <p className="mb-2">
                SprintScale provides software-as-a-service tools designed for tuition centres, clubs, and educational
                providers to manage registrations, sessions, attendance, invoicing, and communications.
              </p>
              <p>
                All newly registered organisations are subject to platform review and approval prior to operational
                activation (&quot;Organisation Approval Guardrail&quot;). SprintScale reserves the right to review, approve,
                suspend, or reject any organisation registration to maintain platform integrity, security, and safeguarding
                standards.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">3. User Accounts &amp; Security</h2>
              <p>
                You must provide accurate, complete, and current information when creating an account. You are responsible
                for maintaining the confidentiality of your login credentials and for all activities that occur under your
                account. You agree to notify SprintScale immediately of any unauthorised use or security breach.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">4. Childcare, Safeguarding &amp; Regulatory Responsibility</h2>
              <p>
                SprintScale is a software technology provider and does not provide childcare, tutoring, or educational
                services directly. Your organisation remains solely and independently responsible for compliance with all
                applicable laws, health and safety regulations, DBS requirements, safeguarding duties, Ofsted/regulatory
                standards, and parent communications.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">5. Acceptable Use</h2>
              <p>
                You agree not to: (a) reverse engineer or attempt to extract the source code of the Service; (b) probe,
                scan, or test the vulnerability of the system; (c) bypass access controls or tenant boundaries; (d) submit
                malicious files, viruses, or unlawful content; or (e) use the Service for any unauthorised or unlawful purpose.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">6. Subscription &amp; Service Availability</h2>
              <p>
                During early access and initial rollout, plan limits and subscription tiers are subject to operational
                updates. SprintScale strives for high service availability but does not warrant that the Service will be
                uninterrupted or error-free. Scheduled maintenance will be communicated where practical.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">7. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by applicable law, SprintScale and its operators shall not be liable for
                any indirect, incidental, special, consequential, or punitive damages, or loss of profits or revenues,
                arising out of or related to your use of or inability to use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">8. Contact &amp; Legal Enquiries</h2>
              <p>
                For legal enquiries, support, or questions regarding these Terms, contact us at{' '}
                <a href="mailto:contact@sprintscaleit.co.uk" className={`text-accent font-medium hover:underline ${focusRing}`}>
                  contact@sprintscaleit.co.uk
                </a>.
              </p>
            </section>
          </div>
        </main>

        <footer className="pt-8 mt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>© 2026 SprintScale IT. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className={`min-h-6 inline-flex items-center hover:text-text transition-colors ${focusRing}`}>Privacy Policy</Link>
            <Link href="/" className={`min-h-6 inline-flex items-center hover:text-text transition-colors ${focusRing}`}>Home</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
