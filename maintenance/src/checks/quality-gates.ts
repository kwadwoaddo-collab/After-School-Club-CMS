import { execSync } from 'child_process';
import { QualityGatesSection, QualityGateResult, StatusLevel, FindingSeverity } from '../types';
import { createStableFingerprint, redactText } from '../lib/redact';

interface RawFinding {
  fingerprint: string;
  code: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  context?: Record<string, unknown>;
}

export interface QualityGateOptions {
  certifiedBaselineSha: string;
  includeBuild?: boolean;
  skipTests?: boolean;
}

export async function runQualityGateChecks(
  options: QualityGateOptions
): Promise<{ section: QualityGatesSection; findings: RawFinding[] }> {
  const gates: QualityGateResult[] = [];
  const findings: RawFinding[] = [];

  // 1. Git Working Tree Cleanliness
  let uncommittedChanges = false;
  let unpushedCommitsCount = 0;

  try {
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    // Ignore changes in maintenance/reports, maintenance/state, and maintenance/logs
    const relevantChanges = statusOutput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.includes('maintenance/reports') && !line.includes('maintenance/state') && !line.includes('maintenance/logs'));

    uncommittedChanges = relevantChanges.length > 0;
    if (uncommittedChanges) {
      const fp = createStableFingerprint('GATE_DIRTY_TREE', 'working_tree');
      findings.push({
        fingerprint: fp,
        code: 'GATE_DIRTY_TREE',
        severity: 'WARNING',
        title: 'Uncommitted Changes in Working Tree',
        description: `Found ${relevantChanges.length} uncommitted file change(s) in repository.`,
        context: { changes: relevantChanges.slice(0, 10) }
      });
    }
  } catch (err: unknown) {
    // Non-fatal
  }

  // 2. Baseline SHA comparison
  try {
    const baselineSha = options.certifiedBaselineSha;
    const diffCountStr = execSync(`git rev-list --count ${baselineSha}..HEAD`, { encoding: 'utf8' }).trim();
    unpushedCommitsCount = parseInt(diffCountStr, 10) || 0;

    if (unpushedCommitsCount > 0) {
      const fp = createStableFingerprint('GATE_UNRELEASED_COMMITS', baselineSha);
      findings.push({
        fingerprint: fp,
        code: 'GATE_UNRELEASED_COMMITS',
        severity: 'INFO',
        title: 'Local Commits Ahead of Certified Baseline',
        description: `Working tree is ${unpushedCommitsCount} commit(s) ahead of certified baseline (${baselineSha.slice(0, 7)}).`,
        context: { commitsAhead: unpushedCommitsCount, baseline: baselineSha }
      });
    }
  } catch {
    // If baseline commit isn't in shallow clone or range is invalid
  }

  // Helper to execute gate command
  const executeGate = (gateName: string, cmd: string, timeoutMs = 120000) => {
    const start = Date.now();
    try {
      const childEnv = { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' };
      const envRecord = childEnv as Record<string, string | undefined>;
      // Strip production-specific overrides so CI quality gates run in standard clean test isolation
      const prodKeysToStrip = [
        'DATABASE_URL',
        'AUTH_URL',
        'VERCEL_ENV',
        'VERCEL_URL',
        'VERCEL_PROJECT_PRODUCTION_URL',
        'NEXT_PUBLIC_BASE_URL',
        'NEXT_PUBLIC_APP_URL',
        'CRON_SECRET',
        'PARENT_SESSION_SECRET',
        'RESEND_API_KEY',
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN'
      ];
      for (const k of prodKeysToStrip) {
        delete envRecord[k];
      }

      execSync(cmd, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
        env: childEnv as NodeJS.ProcessEnv
      });
      const elapsed = Date.now() - start;
      gates.push({
        gate: gateName,
        passed: true,
        durationMs: elapsed,
        details: 'Passed cleanly'
      });
    } catch (err: unknown) {
      const elapsed = Date.now() - start;
      const errorMsg = err instanceof Error ? (err as { stdout?: string; stderr?: string }).stderr || err.message : String(err);
      const safeMsg = redactText(errorMsg).slice(0, 500);

      gates.push({
        gate: gateName,
        passed: false,
        durationMs: elapsed,
        details: safeMsg
      });

      const gateCode = `GATE_${gateName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      const fp = createStableFingerprint(gateCode, gateName);
      findings.push({
        fingerprint: fp,
        code: gateCode,
        severity: 'ACTION_REQUIRED',
        title: `Quality Gate Failed: ${gateName}`,
        description: `Command \`${cmd}\` failed: ${safeMsg}`,
        context: { gate: gateName, durationMs: elapsed }
      });
    }
  };

  // 3. Git Diff Formatting / Whitespace Gate
  executeGate('Git Diff Formatting', 'git diff --check', 30000);

  // 4. TypeScript Typecheck
  executeGate('TypeScript Compilation', 'NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit', 90000);

  // 5. ESLint
  executeGate('ESLint', 'npm run lint', 90000);

  // 6. Test Suite (Vitest)
  if (!options.skipTests) {
    executeGate('Vitest Unit Tests', 'npm test', 180000);
  }

  // 7. Next.js Production Build (Mandatory for Monthly and Quarterly)
  if (options.includeBuild !== false) {
    executeGate('Next.js Build', 'NODE_OPTIONS=--max-old-space-size=4096 npm run build', 240000);
  }

  const failedGates = gates.filter((g) => !g.passed).length;
  let status: StatusLevel = 'HEALTHY';
  if (failedGates > 0) {
    status = 'ACTION_REQUIRED';
  } else if (uncommittedChanges) {
    status = 'WARNING';
  }

  return {
    section: {
      status,
      gates,
      uncommittedChanges,
      unpushedCommitsCount,
      notes: `${gates.length} quality gates run: ${gates.length - failedGates} passed, ${failedGates} failed.`
    },
    findings
  };
}
