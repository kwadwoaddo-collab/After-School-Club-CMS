/**
 * PM-1.2 — Platform Admin: Organisation Management
 *
 * Lists all organisations and their current approval status.
 * Platform admin can approve, suspend, reject, or reactivate organisations.
 *
 * Auth: requirePlatformAdmin() is called in the layout — this page inherits that.
 * Calling it here again is harmless and makes the server action guard explicit.
 */

import { db } from '@/db';
import { organisations, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { approveOrg, rejectOrg, suspendOrg, reactivateOrg } from './actions';
import { requirePlatformAdmin } from '@/lib/org-approval-guard';

export default async function PlatformOrganisationsPage() {
  // Double-check: layout already enforced this, but server pages are independently callable
  await requirePlatformAdmin();

  const orgs = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      approvalStatus: organisations.approvalStatus,
      contactEmail: organisations.contactEmail,
      createdAt: organisations.createdAt,
      approvedAt: organisations.approvedAt,
      rejectionReason: organisations.rejectionReason,
    })
    .from(organisations)
    .orderBy(desc(organisations.createdAt));

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      SUSPENDED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return map[status] ?? 'bg-white/10 text-white/50 border-white/10';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 id="platform-orgs-heading" className="text-2xl font-semibold text-white">
            Organisations
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {orgs.length} total · {orgs.filter((o) => o.approvalStatus === 'PENDING').length} pending review
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const).map((s) => (
          <div key={s} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{s}</p>
            <p className="text-2xl font-bold text-white">
              {orgs.filter((o) => o.approvalStatus === s).length}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Organisation', 'Email', 'Status', 'Registered', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-left text-xs font-medium text-white/40 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-4">
                  <p className="font-medium text-white">{org.name}</p>
                  <p className="text-xs text-white/30">{org.slug}</p>
                </td>
                <td className="px-5 py-4 text-white/50">
                  {org.contactEmail ?? '—'}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(
                      org.approvalStatus
                    )}`}
                  >
                    {org.approvalStatus}
                  </span>
                  {org.rejectionReason && (
                    <p className="text-xs text-red-400/60 mt-1 max-w-[200px] truncate">
                      {org.rejectionReason}
                    </p>
                  )}
                </td>
                <td className="px-5 py-4 text-white/40 text-xs">
                  {new Date(org.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {org.approvalStatus === 'PENDING' && (
                      <>
                        <form action={approveOrg}>
                          <input type="hidden" name="orgId" value={org.id} />
                          <button
                            id={`approve-org-${org.id}`}
                            type="submit"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                          >
                            Approve
                          </button>
                        </form>
                        <form action={rejectOrg}>
                          <input type="hidden" name="orgId" value={org.id} />
                          <input
                            type="text"
                            name="reason"
                            placeholder="Reason (optional)"
                            className="px-2 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white/60 placeholder-white/20 w-36"
                          />
                          <button
                            id={`reject-org-${org.id}`}
                            type="submit"
                            className="ml-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                          >
                            Reject
                          </button>
                        </form>
                      </>
                    )}
                    {org.approvalStatus === 'ACTIVE' && (
                      <form action={suspendOrg}>
                        <input type="hidden" name="orgId" value={org.id} />
                        <button
                          id={`suspend-org-${org.id}`}
                          type="submit"
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-all"
                        >
                          Suspend
                        </button>
                      </form>
                    )}
                    {(org.approvalStatus === 'SUSPENDED' || org.approvalStatus === 'REJECTED') && (
                      <form action={reactivateOrg}>
                        <input type="hidden" name="orgId" value={org.id} />
                        <button
                          id={`reactivate-org-${org.id}`}
                          type="submit"
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
                        >
                          Reactivate
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 && (
          <div className="text-center py-16 text-white/30">No organisations registered yet.</div>
        )}
      </div>
    </div>
  );
}
