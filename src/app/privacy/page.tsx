import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | SprintScale',
  description: 'SprintScale privacy policy and data protection information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#05070A] text-[#e5e2e1] px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between pb-8 mb-8 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
            <span className="text-lg">🚀</span>
            <span className="font-bold text-white">SprintScale</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/terms" className="text-white/60 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Sign Up
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
            Privacy Policy · Version 2026-09-01
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Privacy Policy</h1>
          <p className="text-sm text-white/50">
            Effective Date: 1 September 2026 · Initial Product Privacy Policy (Subject to Formal Legal Review)
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-white/80">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Overview & Scope</h2>
            <p>
              This Privacy Policy explains how SprintScale IT (&quot;SprintScale&quot;, &quot;we&quot;, &quot;us&quot;)
              collects, processes, and protects personal information when you use our SaaS management platform.
              We are committed to transparent, secure data handling compliant with the UK Data Protection Act 2018
              and UK GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Roles: Data Controller vs Data Processor</h2>
            <p className="mb-2">
              <strong>Account & Billing Information:</strong> SprintScale acts as the Data Controller for information
              collected directly from you to set up your administrator account, verify your identity, manage subscriptions,
              and communicate platform updates.
            </p>
            <p>
              <strong>Student, Parent & Operational Data:</strong> Your organisation acts as the Data Controller for student
              records, parent contact details, attendance registers, and medical notes entered into your tenant database.
              SprintScale processes this data strictly as a Data Processor on your organisation&apos;s behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Identifiers:</strong> Name, work email address, hashed passwords.</li>
              <li><strong>Organisation Details:</strong> Organisation name, centre addresses, brand colors, contact telephone.</li>
              <li><strong>Technical & Log Data:</strong> IP addresses (used for rate-limiting and fraud prevention), browser types, and timestamped security audit events.</li>
              <li><strong>Student & Parent Information:</strong> Entered by you or submitted via your centre booking portals (names, emergency contacts, medical/safeguarding notes).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. How We Use Information</h2>
            <p>
              We process personal data to: (a) provide, operate, and maintain the Service; (b) enforce tenant isolation and
              account security; (c) communicate administrative and operational notices; (d) comply with legal obligations;
              and (e) prevent abusive, fraudulent, or unauthorized access. We do not sell personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Data Security & Storage</h2>
            <p>
              All data is stored in secure managed database clusters with transport layer encryption (TLS 1.3) and
              encryption at rest. Tenant isolation boundaries prevent cross-organisation access. Access to production
              infrastructure is strictly restricted to authorised personnel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Your Rights</h2>
            <p>
              Under UK data protection law, you have rights including the right to access, rectify, or request erasure
              of your personal data. Where SprintScale acts as a processor on behalf of an organisation, data subjects
              (such as parents) should direct requests directly to the organisation managing their club or centre.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Contact Data Protection</h2>
            <p>
              For questions, data subject requests, or privacy enquiries, contact our privacy contact at{' '}
              <a href="mailto:support@sprintscaleit.co.uk" className="text-indigo-400 hover:underline">
                support@sprintscaleit.co.uk
              </a>.
            </p>
          </section>
        </div>

        <div className="pt-8 mt-12 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© 2026 SprintScale IT. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
