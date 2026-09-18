import { execSync } from 'child_process';
import { DependencyAuditSection, StatusLevel, FindingSeverity } from '../types';
import { createStableFingerprint, redactText } from '../lib/redact';

interface RawFinding {
  fingerprint: string;
  code: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  context?: Record<string, unknown>;
}

interface AuditVulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  isDirect: boolean;
  via: Array<string | { title?: string; url?: string; name?: string; severity?: string }>;
  effects: string[];
  range: string;
  nodes?: string[];
  fixAvailable?: boolean | { name: string; version: string; isSemVerMajor: boolean };
}

interface NpmAuditJson {
  auditReportVersion?: number;
  vulnerabilities?: Record<string, AuditVulnerability>;
  metadata?: {
    vulnerabilities?: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
    dependencies?: {
      prod: number;
      dev: number;
      optional: number;
      peer: number;
      peerOptional: number;
      total: number;
    };
  };
}

export async function runDependencyAuditChecks(): Promise<{
  section: DependencyAuditSection;
  findings: RawFinding[];
}> {
  const findings: RawFinding[] = [];
  let criticalCount = 0;
  let highCount = 0;
  let moderateCount = 0;
  let lowCount = 0;
  let reachableVulnerabilitiesCount = 0;
  let notes = '';

  try {
    let auditRaw = '';
    try {
      // npm audit exits with non-zero if vulnerabilities are found, so catch stdout
      auditRaw = execSync('npm audit --json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 45000
      });
    } catch (err: unknown) {
      const execErr = err as { stdout?: string };
      auditRaw = execErr.stdout || '';
    }

    if (!auditRaw) {
      notes = 'No npm audit output received.';
      return {
        section: {
          status: 'HEALTHY',
          criticalCount: 0,
          highCount: 0,
          moderateCount: 0,
          lowCount: 0,
          reachableVulnerabilitiesCount: 0,
          notes
        },
        findings
      };
    }

    const auditData: NpmAuditJson = JSON.parse(auditRaw);
    const vulns = auditData.vulnerabilities || {};

    for (const [pkgName, vuln] of Object.entries(vulns)) {
      const sev = vuln.severity;
      const isReachable = vuln.isDirect;

      if (sev === 'critical') {
        criticalCount++;
        if (isReachable) reachableVulnerabilitiesCount++;
        const fp = createStableFingerprint('DEP_VULN_CRITICAL', pkgName);
        findings.push({
          fingerprint: fp,
          code: 'DEP_VULN_CRITICAL',
          severity: 'ACTION_REQUIRED',
          title: `Critical Dependency Vulnerability: ${pkgName}`,
          description: `Package ${pkgName} has critical severity vulnerability. Direct dependency: ${vuln.isDirect}.`,
          context: { package: pkgName, severity: sev, direct: vuln.isDirect }
        });
      } else if (sev === 'high') {
        highCount++;
        if (isReachable) reachableVulnerabilitiesCount++;
        const fp = createStableFingerprint('DEP_VULN_HIGH', pkgName);
        findings.push({
          fingerprint: fp,
          code: 'DEP_VULN_HIGH',
          severity: 'ACTION_REQUIRED',
          title: `High Dependency Vulnerability: ${pkgName}`,
          description: `Package ${pkgName} has high severity vulnerability. Direct dependency: ${vuln.isDirect}.`,
          context: { package: pkgName, severity: sev, direct: vuln.isDirect }
        });
      } else if (sev === 'moderate') {
        moderateCount++;
        const fp = createStableFingerprint('DEP_VULN_MODERATE', pkgName);
        findings.push({
          fingerprint: fp,
          code: 'DEP_VULN_MODERATE',
          severity: 'WARNING',
          title: `Moderate Dependency Vulnerability: ${pkgName}`,
          description: `Package ${pkgName} has moderate severity vulnerability.`,
          context: { package: pkgName, severity: sev }
        });
      } else {
        lowCount++;
      }
    }

    notes = `Audit scanned ${auditData.metadata?.dependencies?.total || 0} packages. Found: ${criticalCount} critical, ${highCount} high, ${moderateCount} moderate, ${lowCount} low.`;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    notes = `Failed to parse npm audit: ${redactText(errorMsg)}`;
    findings.push({
      fingerprint: createStableFingerprint('DEP_AUDIT_ERROR', 'parse'),
      code: 'DEP_AUDIT_ERROR',
      severity: 'WARNING',
      title: 'Failed to run dependency security audit',
      description: `npm audit error: ${redactText(errorMsg)}`
    });
  }

  let status: StatusLevel = 'HEALTHY';
  if (criticalCount > 0 || highCount > 0) {
    status = 'ACTION_REQUIRED';
  } else if (moderateCount > 0) {
    status = 'WARNING';
  }

  return {
    section: {
      status,
      criticalCount,
      highCount,
      moderateCount,
      lowCount,
      reachableVulnerabilitiesCount,
      notes
    },
    findings
  };
}
