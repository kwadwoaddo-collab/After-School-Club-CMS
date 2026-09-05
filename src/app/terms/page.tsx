import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | SprintScale',
  description: 'SprintScale terms of service for tuition centres and childcare organisations.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#05070A] text-[#e5e2e1] px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between pb-8 mb-8 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
            <span className="text-lg">🚀</span>
            <span className="font-bold text-white">SprintScale</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="text-white/60 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Sign Up
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
            Product Terms · Version 2026-09-01
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Terms of Service</h1>
          <p className="text-sm text-white/50">
            Effective Date: 1 September 2026 · Initial Product Terms (Subject to Formal Legal Review)
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-white/80">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Agreement to Terms</h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the SprintScale management
              platform (&quot;Platform&quot; or &quot;Service&quot;), provided by SprintScale IT. By registering an account,
              establishing an organisation, or using the Service, you agree to be bound by these Terms. If you are
              agreeing to these Terms on behalf of an organisation, tuition centre, or business entity, you represent
              that you have the authority to bind that entity.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. SaaS Platform Services & Organisation Approval</h2>
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
            <h2 className="text-lg font-bold text-white mb-2">3. User Accounts & Security</h2>
            <p>
              You must provide accurate, complete, and current information when creating an account. You are responsible
              for maintaining the confidentiality of your login credentials and for all activities that occur under your
              account. You agree to notify SprintScale immediately of any unauthorised use or security breach.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Childcare, Safeguarding & Regulatory Responsibility</h2>
            <p>
              SprintScale is a software technology provider and does not provide childcare, tutoring, or educational
              services directly. Your organisation remains solely and independently responsible for compliance with all
              applicable laws, health and safety regulations, DBS requirements, safeguarding duties, Ofsted/regulatory
              standards, and parent communications.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Acceptable Use</h2>
            <p>
              You agree not to: (a) reverse engineer or attempt to extract the source code of the Service; (b) probe,
              scan, or test the vulnerability of the system; (c) bypass access controls or tenant boundaries; (d) submit
              malicious files, viruses, or unlawful content; or (e) use the Service for any unauthorised or unlawful purpose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Subscription & Service Availability</h2>
            <p>
              During early access and initial rollout, plan limits and subscription tiers are subject to operational
              updates. SprintScale strives for high service availability but does not warrant that the Service will be
              uninterrupted or error-free. Scheduled maintenance will be communicated where practical.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, SprintScale and its operators shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages, or loss of profits or revenues,
              arising out of or related to your use of or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. Contact & Legal Enquiries</h2>
            <p>
              For legal enquiries, support, or questions regarding these Terms, contact us at{' '}
              <a href="mailto:support@sprintscaleit.co.uk" className="text-indigo-400 hover:underline">
                support@sprintscaleit.co.uk
              </a>.
            </p>
          </section>
        </div>

        <div className="pt-8 mt-12 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© 2026 SprintScale IT. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
