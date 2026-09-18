import { runProductionHealthChecks } from '../checks/production';
import { runVercelDeploymentChecks } from '../checks/vercel';
import { runDatabaseHealthAndScaleChecks } from '../checks/database';
import { MaintenanceReportSections, StatusLevel } from '../types';

export interface WeeklyRunnerOptions {
  productionUrl: string;
  certifiedBaselineSha: string;
  databaseUrl?: string;
}

export async function runWeeklyChecks(options: WeeklyRunnerOptions) {
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

  // 3. Fast Database Ping (if configured)
  const dbResult = await runDatabaseHealthAndScaleChecks(options.databaseUrl);
  allFindings.push(...dbResult.findings);

  const sections: MaintenanceReportSections = {
    productionHealth: prodResult.section,
    vercelDeployment: vercelResult.section,
    databaseHealth: dbResult.dbSection
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
