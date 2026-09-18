/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment configuration if available
const envFiles = ['.env.production.vercel', '.env.production', '.env.local', '.env'];
for (const f of envFiles) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    if (process.env.DATABASE_URL) break;
  }
}

// Sanitize any scrubbed placeholder strings in process.env so they don't corrupt libraries (e.g. rate-limit Redis URL)
for (const key of Object.keys(process.env)) {
  const val = process.env[key];
  if (typeof val === 'string' && (val.startsWith('[SENSITIVE') || val.startsWith('[REDACTED'))) {
    delete process.env[key];
  }
}
import { Cadence, CMSMaintenanceReport, StatusLevel, ReportSummary, CliOptions } from './types';
import { acquireLock, releaseLock } from './lib/lock';
import { redactObject } from './lib/redact';
import { determineScheduledCadence } from './lib/precedence';
import { FindingsStoreManager } from './lib/findings-store';
import { generateMarkdownReport } from './generators/markdown-report';
import { runWeeklyChecks } from './levels/weekly';
import { runMonthlyChecks } from './levels/monthly';
import { runQuarterlyChecks } from './levels/quarterly';

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let level: Cadence = 'weekly';
  let dryRun = false;
  let outputJson: string | undefined;
  let outputMd: string | undefined;
  let skipQualityGates = false;

  for (const arg of args) {
    if (arg.startsWith('--level=')) {
      const val = arg.split('=')[1].toLowerCase() as Cadence;
      if (['weekly', 'monthly', 'quarterly'].includes(val)) {
        level = val;
      }
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--auto-cadence') {
      level = determineScheduledCadence();
    } else if (arg.startsWith('--output-json=')) {
      outputJson = arg.split('=')[1];
    } else if (arg.startsWith('--output-md=')) {
      outputMd = arg.split('=')[1];
    } else if (arg === '--skip-quality-gates') {
      skipQualityGates = true;
    }
  }

  return { level, dryRun, outputJson, outputMd, skipQualityGates };
}

function getHostInfo() {
  return {
    hostname: os.hostname(),
    user: os.userInfo().username || process.env.USER || 'unknown',
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version
  };
}

function getGitHeadSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '0000000000000000000000000000000000000000';
  }
}

function getBaselineDiffCount(baselineSha: string): number {
  try {
    const diffStr = execSync(`git rev-list --count ${baselineSha}..HEAD`, { encoding: 'utf8' }).trim();
    return parseInt(diffStr, 10) || 0;
  } catch {
    return 0;
  }
}

export async function runMaintenance(options: CliOptions): Promise<{ report: CMSMaintenanceReport; exitCode: number }> {
  const rootDir = process.cwd();
  const baselineConfigPath = path.join(rootDir, 'maintenance/config/baseline.json');
  let baselineSha = '9bc1111cf2672de66c12dd4d2ce609ec4eb98b94';
  let productionUrl = 'https://after-school-club-live.vercel.app';

  if (fs.existsSync(baselineConfigPath)) {
    try {
      const bConf = JSON.parse(fs.readFileSync(baselineConfigPath, 'utf8'));
      if (bConf.lastCertifiedProductionSha) baselineSha = bConf.lastCertifiedProductionSha;
      if (bConf.productionUrl) productionUrl = bConf.productionUrl;
    } catch {
      // use defaults
    }
  }

  // 1. Acquire process lock
  const locked = acquireLock(options.level);
  if (!locked) {
    console.error(`[MAINTENANCE] Execution aborted: another maintenance process holds the lock.`);
    process.exitCode = 3;
    throw new Error('Lock contention: active maintenance process running');
  }

  try {
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const reportId = `maint-${options.level}-${timestampStr}`;
    const headSha = getGitHeadSha();
    const diffCount = getBaselineDiffCount(baselineSha);

    console.log(`[MAINTENANCE] Starting ${options.level.toUpperCase()} run (ID: ${reportId})`);
    console.log(`[MAINTENANCE] Baseline: ${baselineSha.slice(0, 7)} | HEAD: ${headSha.slice(0, 7)}`);

    let executionResult: {
      sections: CMSMaintenanceReport['sections'];
      findings: Array<{
        fingerprint: string;
        code: string;
        severity: 'INFO' | 'WARNING' | 'ACTION_REQUIRED';
        title: string;
        description: string;
        context?: Record<string, unknown>;
      }>;
      overallStatus: StatusLevel;
    };

    if (options.level === 'weekly') {
      executionResult = await runWeeklyChecks({
        productionUrl,
        certifiedBaselineSha: baselineSha,
        databaseUrl: process.env.DATABASE_URL
      });
    } else if (options.level === 'monthly') {
      executionResult = await runMonthlyChecks({
        productionUrl,
        certifiedBaselineSha: baselineSha,
        databaseUrl: process.env.DATABASE_URL,
        skipQualityGates: options.skipQualityGates
      });
    } else {
      executionResult = await runQuarterlyChecks({
        productionUrl,
        certifiedBaselineSha: baselineSha,
        databaseUrl: process.env.DATABASE_URL,
        skipQualityGates: options.skipQualityGates,
        dryRun: options.dryRun
      });
    }

    // 2. Reconcile findings with lifecycle store (scoped to executed domains)
    const executedDomains: string[] = ['PROD', 'VERCEL', 'DB'];
    if (options.level === 'monthly' || options.level === 'quarterly') {
      executedDomains.push('SCALE', 'FIN', 'DEP');
      if (!options.skipQualityGates) {
        executedDomains.push('GATE');
      }
    }

    const findingsManager = new FindingsStoreManager();
    const reconciledFindings = findingsManager.reconcileFindings(
      executionResult.findings,
      options.dryRun,
      executedDomains
    );

    // 3. Calculate summary metrics (deterministic, non-overlapping)
    let totalChecks = 0;
    let passedChecks = 0;
    let warnedChecks = 0;
    let failedChecks = 0;

    // A. Production Probes
    if (executionResult.sections.productionHealth) {
      for (const p of executionResult.sections.productionHealth.probes) {
        totalChecks++;
        if (!p.passed) {
          failedChecks++;
        } else if (p.responseTimeMs > 1500) {
          warnedChecks++;
        } else {
          passedChecks++;
        }
      }
    }

    // B. Vercel Deployment
    if (executionResult.sections.vercelDeployment) {
      totalChecks++;
      if (executionResult.sections.vercelDeployment.status === 'HEALTHY') {
        passedChecks++;
      } else if (executionResult.sections.vercelDeployment.status === 'WARNING') {
        warnedChecks++;
      } else {
        failedChecks++;
      }
    }

    // C. Database Health
    if (executionResult.sections.databaseHealth) {
      totalChecks++;
      if (executionResult.sections.databaseHealth.status === 'HEALTHY') {
        passedChecks++;
      } else if (executionResult.sections.databaseHealth.status === 'WARNING') {
        warnedChecks++;
      } else {
        failedChecks++;
      }
    }

    // D. Scale Snapshot
    if (executionResult.sections.scaleSnapshot) {
      totalChecks++;
      if (executionResult.sections.scaleSnapshot.status === 'HEALTHY') {
        passedChecks++;
      } else if (executionResult.sections.scaleSnapshot.status === 'WARNING') {
        warnedChecks++;
      } else {
        failedChecks++;
      }
    }

    // E. Finance Invariants
    if (executionResult.sections.financeInvariants) {
      for (const inv of executionResult.sections.financeInvariants.invariants) {
        totalChecks++;
        if (inv.passed) {
          passedChecks++;
        } else {
          failedChecks++;
        }
      }
    }

    // F. Dependency Audit
    if (executionResult.sections.dependencyAudit) {
      totalChecks++;
      if (executionResult.sections.dependencyAudit.status === 'HEALTHY') {
        passedChecks++;
      } else if (executionResult.sections.dependencyAudit.status === 'WARNING') {
        warnedChecks++;
      } else {
        failedChecks++;
      }
    }

    // G. Quality Gates
    if (executionResult.sections.qualityGates) {
      for (const g of executionResult.sections.qualityGates.gates) {
        totalChecks++;
        if (g.passed) {
          passedChecks++;
        } else {
          failedChecks++;
        }
      }
    }

    // H. Quarterly Deep Review
    if (executionResult.sections.quarterlyDeepReview) {
      totalChecks++;
      if (executionResult.sections.quarterlyDeepReview.status === 'HEALTHY') {
        passedChecks++;
      } else if (executionResult.sections.quarterlyDeepReview.status === 'WARNING') {
        warnedChecks++;
      } else {
        failedChecks++;
      }
    }

    const summary: ReportSummary = {
      totalChecks,
      passed: passedChecks,
      warned: warnedChecks,
      failed: failedChecks,
      findingsCount: reconciledFindings.filter((f) => f.lifecycle !== 'RESOLVED').length
    };

    const reportRaw: CMSMaintenanceReport = {
      schemaVersion: '1.0.0',
      reportId,
      cadence: options.level,
      generatedAt: now.toISOString(),
      executionHost: getHostInfo(),
      certifiedProductionBaselineSha: baselineSha,
      gitHeadSha: headSha,
      baselineDiffCount: diffCount,
      overallStatus: executionResult.overallStatus,
      summary,
      sections: executionResult.sections,
      findings: reconciledFindings
    };

    // Sanitize any remaining secrets in the report
    const sanitizedReport = redactObject(reportRaw);

    // 4. Output reports
    const reportDir = path.join(rootDir, 'maintenance/reports', options.level);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const defaultJsonPath = path.join(reportDir, `${reportId}.json`);
    const defaultMdPath = path.join(reportDir, `${reportId}.md`);

    const finalJsonPath = options.outputJson || defaultJsonPath;
    const finalMdPath = options.outputMd || defaultMdPath;

    const markdownContent = generateMarkdownReport(sanitizedReport);

    if (!options.dryRun) {
      fs.writeFileSync(finalJsonPath, JSON.stringify(sanitizedReport, null, 2), 'utf8');
      fs.writeFileSync(finalMdPath, markdownContent, 'utf8');
      console.log(`[MAINTENANCE] Saved JSON report to: ${finalJsonPath}`);
      console.log(`[MAINTENANCE] Saved Markdown report to: ${finalMdPath}`);
    } else {
      console.log(`[MAINTENANCE] [DRY RUN] Would write reports to:`);
      console.log(`  JSON: ${finalJsonPath}`);
      console.log(`  Markdown: ${finalMdPath}`);
    }

    console.log(`[MAINTENANCE] Finished ${options.level.toUpperCase()} run. Status: ${sanitizedReport.overallStatus}`);

    const actionReqs = sanitizedReport.findings.filter((f) => f.severity === 'ACTION_REQUIRED');
    if (actionReqs.length > 0) {
      console.log(`[MAINTENANCE] Action Required Findings (${actionReqs.length}):`);
      for (const f of actionReqs) {
        console.log(`  - [${f.code}] ${f.title}: ${f.description}`);
      }
    }

    let exitCode = 0;
    if (sanitizedReport.overallStatus === 'WARNING') exitCode = 1;
    if (sanitizedReport.overallStatus === 'ACTION_REQUIRED') exitCode = 2;
    if (sanitizedReport.overallStatus === 'EXECUTION_FAILURE') exitCode = 3;

    return { report: sanitizedReport, exitCode };
  } finally {
    releaseLock();
  }
}

// Direct invocation handler
if (require.main === module || (process.argv[1] && process.argv[1].endsWith('cli.ts'))) {
  const options = parseArgs();
  runMaintenance(options)
    .then(({ exitCode }) => {
      process.exit(exitCode);
    })
    .catch((err) => {
      console.error('[MAINTENANCE] Execution failed:', err);
      process.exit(3);
    });
}
