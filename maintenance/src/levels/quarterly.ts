import { runProductionHealthChecks } from '../checks/production';
import { runVercelDeploymentChecks } from '../checks/vercel';
import { runDatabaseHealthAndScaleChecks } from '../checks/database';
import { runFinanceInvariantChecks } from '../checks/finance';
import { runDependencyAuditChecks } from '../checks/dependencies';
import { runQualityGateChecks } from '../checks/quality-gates';
import { enforceReportRetention } from '../lib/retention';
import { MaintenanceReportSections, StatusLevel } from '../types';

export interface QuarterlyRunnerOptions {
  productionUrl: string;
  certifiedBaselineSha: string;
  databaseUrl?: string;
  skipQualityGates?: boolean;
  dryRun?: boolean;
}

export async function runQuarterlyChecks(options: QuarterlyRunnerOptions) {
  const allFindings: Array<{
    fingerprint: string;
    code: string;
    severity: 'INFO' | 'WARNING' | 'ACTION_REQUIRED';
    title: string;
    description: string;
    context?: Record<string, unknown>;
  }> = [];

  // 1. Production Health Probes
  const prodResult = await runProductionHealthChecks({
    baseUrl: options.productionUrl
  });
  allFindings.push(...prodResult.findings);

  // 2. Vercel Deployment Check
  const vercelResult = await runVercelDeploymentChecks(options.certifiedBaselineSha);
  allFindings.push(...vercelResult.findings);

  // 3. Database Health & Table Scale Snapshot
  const dbResult = await runDatabaseHealthAndScaleChecks(options.databaseUrl);
  allFindings.push(...dbResult.findings);

  // 4. Financial Integrity Invariants
  const finResult = await runFinanceInvariantChecks(options.databaseUrl);
  allFindings.push(...finResult.findings);

  // 5. Dependency Vulnerability Audit
  const depResult = await runDependencyAuditChecks();
  allFindings.push(...depResult.findings);

  // 6. Deep Quality Gates (including Next.js production build)
  let qgSection = undefined;
  if (!options.skipQualityGates) {
    const qgResult = await runQualityGateChecks({
      certifiedBaselineSha: options.certifiedBaselineSha,
      includeBuild: true,
      skipTests: false
    });
    allFindings.push(...qgResult.findings);
    qgSection = qgResult.section;
  }

  // 7. Enforce Report Retention
  enforceReportRetention(undefined, undefined, options.dryRun);

  const sections: MaintenanceReportSections = {
    productionHealth: prodResult.section,
    vercelDeployment: vercelResult.section,
    databaseHealth: dbResult.dbSection,
    scaleSnapshot: dbResult.scaleSection,
    financeInvariants: finResult.section,
    dependencyAudit: depResult.section,
    qualityGates: qgSection
  };

  const hasActionRequired = allFindings.some((f) => f.severity === 'ACTION_REQUIRED');
  const hasWarning = allFindings.some((f) => f.severity === 'WARNING');

  const overallStatus: StatusLevel = hasActionRequired
    ? 'ACTION_REQUIRED'
    : hasWarning
    ? 'WARNING'
    : 'HEALTHY';

  return {
    sections,
    findings: allFindings,
    overallStatus
  };
}
