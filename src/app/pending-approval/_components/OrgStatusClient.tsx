'use client';

import { useState } from 'react';

type ApprovalStatus = 'PENDING' | 'SUSPENDED' | 'REJECTED';

interface OrgStatusClientProps {
  orgName: string;
  status: ApprovalStatus;
  rejectionReason?: string;
  userEmail: string;
}

const STATUS_CONFIG: Record<
  ApprovalStatus,
  {
    icon: string;
    iconBg: string;
    iconColor: string;
    badge: string;
    badgeBg: string;
    heading: string;
    body: string;
    showTimeline: boolean;
    showReason: boolean;
  }
> = {
  PENDING: {
    icon: '⏳',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    badge: 'Pending Review',
    badgeBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    heading: 'Your account is under review',
    body: 'We have received your registration for {orgName}. Our team typically reviews new accounts within 1–2 business days. You will receive a confirmation email once your account has been approved.',
    showTimeline: true,
    showReason: false,
  },
  SUSPENDED: {
    icon: '⚠️',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    badge: 'Suspended',
    badgeBg: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    heading: 'Your account has been suspended',
    body: 'Access to your dashboard has been temporarily suspended. Please contact SprintScale support to resolve this.',
    showTimeline: false,
    showReason: false,
  },
  REJECTED: {
    icon: '✕',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-400',
    badge: 'Not Approved',
    badgeBg: 'bg-red-500/10 text-red-400 border border-red-500/20',
    heading: 'Your application was not approved',
    body: 'Unfortunately, your organisation was not approved on this occasion. Please contact SprintScale support if you believe this is an error or wish to discuss your application.',
    showTimeline: false,
    showReason: true,
  },
};

export default function OrgStatusClient({
  orgName,
  status,
  rejectionReason,
  userEmail,
}: OrgStatusClientProps) {
  const [signingOut, setSigningOut] = useState(false);
  const cfg = STATUS_CONFIG[status];

  const bodyText = cfg.body.replace('{orgName}', orgName);

  async function handleSignOut() {
    setSigningOut(true);
    // Use the built-in NextAuth sign-out
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/auth/signout';
    const csrf = document.createElement('input');
    csrf.type = 'hidden';
    csrf.name = 'csrfToken';
    // NextAuth CSRF is handled server-side; a direct POST to /api/auth/signout works
    form.appendChild(csrf);
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8 shadow-2xl shadow-black/50">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl ${cfg.iconBg} flex items-center justify-center mb-6`}>
          <span className={`text-2xl ${cfg.iconColor}`}>{cfg.icon}</span>
        </div>

        {/* Status badge */}
        <div className="mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${cfg.badgeBg}`}>
            {cfg.badge}
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold text-white mb-3">
          {cfg.heading}
        </h1>

        {/* Org name */}
        <p className="text-sm text-white/40 mb-4 font-medium">
          {orgName}
        </p>

        {/* Body */}
        <p className="text-sm text-white/60 leading-relaxed mb-6">
          {bodyText}
        </p>

        {/* Rejection reason */}
        {cfg.showReason && rejectionReason && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-red-400 mb-1">Reason provided</p>
            <p className="text-sm text-white/70">{rejectionReason}</p>
          </div>
        )}

        {/* Timeline (PENDING only) */}
        {cfg.showTimeline && (
          <div className="space-y-3 mb-8">
            {[
              { label: 'Application received', done: true },
              { label: 'Under review by SprintScale', done: false, active: true },
              { label: 'Approval decision', done: false },
              { label: 'Access granted', done: false },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  step.done
                    ? 'bg-emerald-400'
                    : step.active
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-white/20'
                }`} />
                <span className={`text-sm ${
                  step.done
                    ? 'text-emerald-400'
                    : step.active
                    ? 'text-amber-300'
                    : 'text-white/30'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Contact */}
        <div className="bg-white/[0.03] rounded-xl p-4 mb-6">
          <p className="text-xs text-white/40 mb-1">Signed in as</p>
          <p className="text-sm text-white/70 font-medium">{userEmail}</p>
          <p className="text-xs text-white/30 mt-2">
            Need help?{' '}
            <a
              href="mailto:support@sprintscaleit.co.uk"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              support@sprintscaleit.co.uk
            </a>
          </p>
        </div>

        {/* Sign out */}
        <button
          id="pending-approval-sign-out"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 border border-white/[0.08] hover:border-white/20 transition-all duration-200 disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-white/20 mt-6">
        SprintScale CMS · Organisation Approval
      </p>
    </div>
  );
}
