import { db } from '@/db';
import { organisations } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { approveOrg, rejectOrg, suspendOrg, reactivateOrg } from './actions';
import { requirePlatformAdmin } from '@/lib/org-approval-guard';

export default async function PlatformOrganisationsPage() {
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
      PENDING: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
      ACTIVE: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
      SUSPENDED: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
      REJECTED: 'bg-red-500/10 text-red-300 border-red-500/25',
    };
    return map[status] ?? 'bg-white/10 text-white/75 border-white/15';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 id="platform-orgs-heading" className="text-2xl font-semibold text-white">
            Organisations
          </h1>
          <p className="text-sm text-white/70 mt-1">
            {orgs.length} total · {orgs.filter((o) => o.approvalStatus === 'PENDING').length} pending review
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const).map((s) => (
          <div key={s} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-xs text-white/70 uppercase tracking-wider mb-1">{s}</p>
            <p className="text-2xl font-bold text-white">
              {orgs.filter((o) => o.approvalStatus === s).length}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {['Organisation', 'Email', 'Status', 'Registered', 'Actions'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-5 py-3.5 text-left text-xs font-medium text-white/70 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{org.name}</p>
                    <p className="text-xs text-white/70">{org.slug}</p>
                  </td>
                  <td className="px-5 py-4 text-white/75">
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
                      <p className="text-xs text-red-300 mt-1 max-w-[200px] truncate">
                        {org.rejectionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-white/70 text-xs whitespace-nowrap">
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
                              className="min-h-11 px-3.5 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/25 transition-colors"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={rejectOrg} className="flex items-center gap-1.5 flex-wrap">
                            <input type="hidden" name="orgId" value={org.id} />
                            <input
                              type="text"
                              name="reason"
                              aria-label={`Rejection reason for ${org.name}`}
                              placeholder="Reason (optional)"
                              className="min-h-11 px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.12] text-white placeholder-white/60 w-40"
                            />
                            <button
                              id={`reject-org-${org.id}`}
                              type="submit"
                              className="min-h-11 px-3.5 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/25 transition-colors"
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
                            className="min-h-11 px-3.5 py-2 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 border border-orange-500/25 transition-colors"
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
                            className="min-h-11 px-3.5 py-2 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 border border-teal-500/25 transition-colors"
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
        </div>
        {orgs.length === 0 && (
          <div className="text-center py-16 text-white/70">No organisations registered yet.</div>
        )}
      </div>
    </div>
  );
}
