import { CMSMaintenanceReport } from '../types';
import { redactText } from '../lib/redact';

export function generateMarkdownReport(report: CMSMaintenanceReport): string {
  const lines: string[] = [];

  const statusBadge =
    report.overallStatus === 'HEALTHY'
      ? '🟢 HEALTHY'
      : report.overallStatus === 'WARNING'
      ? '🟡 WARNING'
      : report.overallStatus === 'ACTION_REQUIRED'
      ? '🔴 ACTION REQUIRED'
      : '❌ EXECUTION FAILURE';

  lines.push(`# CMS Automated Maintenance Report`);
  lines.push(`**Report ID:** \`${report.reportId}\`  `);
  lines.push(`**Cadence:** \`${report.cadence.toUpperCase()}\`  `);
  lines.push(`**Timestamp:** ${report.generatedAt}  `);
  lines.push(`**Overall Status:** ${statusBadge}  `);
  lines.push('');

  lines.push('## 1. Execution Environment & Baseline');
  lines.push(`- **Host:** \`${report.executionHost.user}@${report.executionHost.hostname}\` (${report.executionHost.os})`);
  lines.push(`- **Node:** \`${report.executionHost.nodeVersion}\``);
  lines.push(`- **Certified Production Baseline SHA:** \`${report.certifiedProductionBaselineSha}\``);
  lines.push(`- **Local HEAD SHA:** \`${report.gitHeadSha}\` (${report.baselineDiffCount} commit(s) difference)`);
  lines.push('');

  lines.push('## 2. Executive Summary');
  lines.push('| Metric | Count |');
  lines.push('| :--- | :--- |');
  lines.push(`| Total Probes & Checks | **${report.summary.totalChecks}** |`);
  lines.push(`| Passed | **${report.summary.passed}** |`);
  lines.push(`| Warnings | **${report.summary.warned}** |`);
  lines.push(`| Failed / Action Required | **${report.summary.failed}** |`);
  lines.push(`| Active Findings | **${report.summary.findingsCount}** |`);
  lines.push('');

  // 3. Production Health Probes
  if (report.sections.productionHealth) {
    lines.push('## 3. Production Health Probes');
    lines.push(`*Status: ${report.sections.productionHealth.status}*  `);
    if (report.sections.productionHealth.notes) {
      lines.push(`*${report.sections.productionHealth.notes}*`);
    }
    lines.push('');
    lines.push('| Probe / Target | Status | Response Time | Result | Notes |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    for (const p of report.sections.productionHealth.probes) {
      const resultIcon = p.passed ? '✅ PASS' : '❌ FAIL';
      lines.push(`| \`${p.url}\` | ${p.status} | ${p.responseTimeMs}ms | ${resultIcon} | ${p.notes || '-'} |`);
    }
    lines.push('');
  }

  // 4. Vercel Deployment
  if (report.sections.vercelDeployment) {
    lines.push('## 4. Vercel Deployment Status');
    lines.push(`*Status: ${report.sections.vercelDeployment.status}*  `);
    const dep = report.sections.vercelDeployment.productionDeployment;
    if (dep) {
      lines.push(`- **Deployment URL:** ${dep.url || 'N/A'}`);
      lines.push(`- **State:** \`${dep.state || 'UNKNOWN'}\``);
      if (dep.id) lines.push(`- **Deployment ID:** \`${dep.id}\``);
    }
    if (report.sections.vercelDeployment.notes) {
      lines.push(`- **Notes:** ${report.sections.vercelDeployment.notes}`);
    }
    lines.push('');
  }

  // 5. Database & Scale Snapshot
  if (report.sections.databaseHealth || report.sections.scaleSnapshot) {
    lines.push('## 5. Database Health & Scale Snapshot');
    if (report.sections.databaseHealth) {
      lines.push(`*Database Status: ${report.sections.databaseHealth.status}*  `);
      lines.push(`- Connection Pool: ${report.sections.databaseHealth.connectionPoolOk ? 'Connected' : 'Unavailable'}`);
      lines.push(`- Ping Latency: ${report.sections.databaseHealth.connectionLatencyMs}ms`);
      if (report.sections.databaseHealth.databaseSizeMb !== undefined) {
        lines.push(`- Database Size: ${report.sections.databaseHealth.databaseSizeMb} MB`);
      }
      if (report.sections.databaseHealth.activeConnections !== undefined) {
        lines.push(`- Active Connections: ${report.sections.databaseHealth.activeConnections}`);
      }
    }
    if (report.sections.scaleSnapshot) {
      lines.push('');
      lines.push(`### MAINT-PERF-1 Authoritative Performance Trigger`);
      lines.push(`- **Trigger Status:** \`${report.sections.scaleSnapshot.maintPerf1.status}\``);
      lines.push(`- **Recommendation:** \`${report.sections.scaleSnapshot.maintPerf1TriggerRecommendation}\``);
      lines.push(`- **Max Invoices for Single Organisation:** **${report.sections.scaleSnapshot.maintPerf1.maxInvoicesForAnyOrganisation}** (Threshold: ${report.sections.scaleSnapshot.maintPerf1.invoiceCountThreshold})`);
      lines.push(`- **Active Billing Configurations:** **${report.sections.scaleSnapshot.maintPerf1.activeBillingConfigs}** (Threshold: ${report.sections.scaleSnapshot.maintPerf1.activeBillingConfigThreshold})`);
      lines.push(`- **Invoice-History Query p95 Latency:** ${report.sections.scaleSnapshot.maintPerf1.observedP95Ms !== null ? `${report.sections.scaleSnapshot.maintPerf1.observedP95Ms}ms` : 'Not Measured / Null (Reliable telemetry currently unavailable)'} (Threshold: ${report.sections.scaleSnapshot.maintPerf1.p95ThresholdMs}ms)`);
      if (report.sections.scaleSnapshot.maintPerf1.triggerReasons.length > 0) {
        lines.push(`- **Trigger Reasons:** ${report.sections.scaleSnapshot.maintPerf1.triggerReasons.join('; ')}`);
      }
      lines.push('');
      lines.push('| Table | Row Count | Scale Status |');
      lines.push('| :--- | :--- | :--- |');
      for (const t of report.sections.scaleSnapshot.tables) {
        lines.push(`| \`${t.tableName}\` | ${t.rowCount >= 0 ? t.rowCount.toLocaleString() : 'N/A'} | ${t.status} |`);
      }
    }
    lines.push('');
  }

  // 6. Financial Integrity Invariants
  if (report.sections.financeInvariants) {
    lines.push('## 6. Financial Invariants Verification');
    lines.push(`*Status: ${report.sections.financeInvariants.status}*  `);
    lines.push('');
    lines.push('| Invariant | Result | Discrepancies | Details |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const inv of report.sections.financeInvariants.invariants) {
      const icon = inv.passed ? '✅ PASS' : '❌ VIOLATION';
      lines.push(`| ${inv.name} | ${icon} | ${inv.discrepanciesCount} | ${inv.details || '-'} |`);
    }
    lines.push('');
  }

  // 7. Dependency Security Audit
  if (report.sections.dependencyAudit) {
    lines.push('## 7. Dependency Security Audit');
    lines.push(`*Status: ${report.sections.dependencyAudit.status}*  `);
    lines.push(`- Critical: **${report.sections.dependencyAudit.criticalCount}**`);
    lines.push(`- High: **${report.sections.dependencyAudit.highCount}** (Accepted Ongoing Risks: **${report.sections.dependencyAudit.acceptedRiskCount}**, New Actionable: **${report.sections.dependencyAudit.newActionableCount}**)`);
    lines.push(`- Moderate: **${report.sections.dependencyAudit.moderateCount}**`);
    lines.push(`- Low: **${report.sections.dependencyAudit.lowCount}**`);
    lines.push('');
  }

  // 8. Quality Gates
  if (report.sections.qualityGates) {
    lines.push('## 8. Quality Gates (Codebase & Build)');
    lines.push(`*Status: ${report.sections.qualityGates.status}*  `);
    lines.push(`- Working tree clean: ${report.sections.qualityGates.uncommittedChanges ? '⚠️ Uncommitted changes detected' : '✅ Clean'}`);
    lines.push(`- Unreleased commits ahead of baseline: ${report.sections.qualityGates.unpushedCommitsCount}`);
    lines.push('');
    lines.push('| Quality Gate | Result | Duration | Details |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const g of report.sections.qualityGates.gates) {
      const icon = g.passed ? '✅ PASS' : '❌ FAIL';
      lines.push(`| ${g.gate} | ${icon} | ${g.durationMs}ms | ${g.details || '-'} |`);
    }
    lines.push('');
  }

  // 9. Quarterly Deep Engineering Review
  if (report.sections.quarterlyDeepReview) {
    lines.push('## 9. Quarterly Deep Engineering Review');
    lines.push(`*Status: ${report.sections.quarterlyDeepReview.status}*  `);
    lines.push(`- **Architecture & Config Drift:** \`${report.sections.quarterlyDeepReview.architectureDrift.status}\` — ${report.sections.quarterlyDeepReview.architectureDrift.details}`);
    lines.push(`- **Tenancy & RBAC Review:** \`${report.sections.quarterlyDeepReview.tenancyRbacReview.status}\` — ${report.sections.quarterlyDeepReview.tenancyRbacReview.details}`);
    lines.push(`- **Recovery Readiness:** \`${report.sections.quarterlyDeepReview.recoveryReadiness.status}\` — ${report.sections.quarterlyDeepReview.recoveryReadiness.details}`);
    lines.push(`- **Technical Debt & Deferred Work:** ${report.sections.quarterlyDeepReview.technicalDebtReview.recommendation}`);
    for (const item of report.sections.quarterlyDeepReview.technicalDebtReview.deferredCandidates) {
      lines.push(`  - ${item}`);
    }
    lines.push('');
  }
  // 10. Findings & Action Items
  lines.push('## 10. Findings & Action Items');
  if (report.findings.length === 0) {
    lines.push('✅ **No findings detected. System is in certified optimal condition.**');
  } else {
    for (const f of report.findings) {
      const sevIcon = f.severity === 'ACTION_REQUIRED' ? '🔴' : f.severity === 'WARNING' ? '🟡' : 'ℹ️';
      lines.push(`### ${sevIcon} [${f.code}] ${f.title}`);
      lines.push(`- **Fingerprint:** \`${f.fingerprint}\``);
      lines.push(`- **Severity:** \`${f.severity}\` | **Lifecycle:** \`${f.lifecycle}\` | **Occurrences:** ${f.occurrences}`);
      lines.push(`- **First Detected:** ${f.firstDetectedAt} | **Last Observed:** ${f.lastObservedAt}`);
      lines.push(`- **Description:** ${f.description}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`*Generated by CMS Automated Preventive Maintenance Framework (MAINT-AUTO-1)*`);

  return redactText(lines.join('\n'));
}
