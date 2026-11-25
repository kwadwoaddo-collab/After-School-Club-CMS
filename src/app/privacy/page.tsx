import Link from 'next/link';
import { CURRENT_TERMS_VERSION, CURRENT_TERMS_EFFECTIVE_DATE } from '@/lib/constants/legal';

export const metadata = {
  title: 'Privacy Policy',
  description: 'SprintScale privacy policy and data protection information.',
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

export default function PrivacyPage() {
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
            <Link href="/terms" className={`min-h-[44px] inline-flex items-center text-text-secondary hover:text-text transition-colors ${focusRing}`}>
              Terms of Service
            </Link>
            <Link href="/signup" className={`min-h-[44px] inline-flex items-center font-semibold text-accent hover:text-accent-hover transition-colors ${focusRing}`}>
              Sign Up
            </Link>
          </nav>
        </header>

        <main id="main-content" tabIndex={-1} className="bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-xs">
          <div className="mb-8">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20 mb-3">
              Privacy Policy · Version {CURRENT_TERMS_VERSION}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-text mb-2">Privacy Policy</h1>
            <p className="text-sm text-text-muted">
              Effective Date: {CURRENT_TERMS_EFFECTIVE_DATE}
            </p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed text-text-secondary">
            <section>
              <h2 className="text-lg font-bold text-text mb-2">1. Overview &amp; Scope</h2>
              <p>
                This Privacy Policy explains how SprintScale IT (&quot;SprintScale&quot;, &quot;we&quot;, &quot;us&quot;)
                processes personal information in connection with our SaaS management platform, in alignment with principles
                under the UK Data Protection Act 2018 and UK GDPR.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">2. Roles: Data Controller vs Data Processor</h2>
              <p className="mb-2">
                <strong className="text-text">Account &amp; Billing Information:</strong> SprintScale acts as the Data Controller for information
                collected directly from you to set up your administrator account, verify your identity, manage subscriptions,
                and communicate platform updates.
              </p>
              <p>
                <strong className="text-text">Student, Parent &amp; Operational Data:</strong> Your organisation acts as the Data Controller for student
                records, parent contact details, attendance registers, and medical notes entered into your tenant database.
                SprintScale processes this data strictly as a Data Processor on your organisation&apos;s behalf.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">3. Information We Collect</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-text">Account Identifiers:</strong> Name, work email address, hashed passwords.</li>
                <li><strong className="text-text">Organisation Details:</strong> Organisation name, centre addresses, brand colours, contact telephone.</li>
                <li><strong className="text-text">Technical &amp; Log Data:</strong> IP addresses (used for rate-limiting and fraud prevention), browser types, and timestamped security audit events.</li>
                <li><strong className="text-text">Student &amp; Parent Information:</strong> Entered by you or submitted via your centre booking portals (names, emergency contacts, medical/safeguarding notes).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">4. How We Use Information</h2>
              <p>
                We process personal data to: (a) provide, operate, and maintain the Service; (b) enforce tenant isolation and
                account security; (c) communicate administrative and operational notices; (d) comply with legal obligations;
                and (e) prevent abusive, fraudulent, or unauthorised access. We do not sell personal data to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">5. Data Security &amp; Storage</h2>
              <p>
                All data is stored in secure managed database clusters with transport layer encryption (TLS 1.3) and
                encryption at rest. Tenant isolation boundaries prevent cross-organisation access. Access to production
                infrastructure is strictly restricted to authorised personnel.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">6. Your Rights</h2>
              <p>
                Under UK data protection law, you have rights including the right to access, rectify, or request erasure
                of your personal data. Where SprintScale acts as a processor on behalf of an organisation, data subjects
                (such as parents) should direct requests directly to the organisation managing their club or centre.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text mb-2">7. Contact Data Protection</h2>
              <p>
                For questions, data subject requests, or privacy enquiries, contact our privacy contact at{' '}
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
            <Link href="/terms" className={`min-h-6 inline-flex items-center hover:text-text transition-colors ${focusRing}`}>Terms of Service</Link>
            <Link href="/" className={`min-h-6 inline-flex items-center hover:text-text transition-colors ${focusRing}`}>Home</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
