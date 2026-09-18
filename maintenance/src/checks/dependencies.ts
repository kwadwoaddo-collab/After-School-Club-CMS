import fs from 'fs';
import path from 'path';
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

export interface AcceptedAdvisory {
  package: string;
  acceptedUntil: string;
  reason: string;
  disposition: 'ONGOING_ACCEPTED_RISK' | 'WATCH';
  monitoredSeverity: string;
}

export interface AcceptedAdvisoriesConfig {
  advisories?: Record<string, AcceptedAdvisory>;
}

export interface AuditVulnerability {
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

export function loadAcceptedAdvisories(configPath?: string): Record<string, AcceptedAdvisory> {
  const filePath = configPath || path.resolve(process.cwd(), 'maintenance/config/accepted-advisories.json');
  if (fs.existsSync(filePath)) {
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AcceptedAdvisoriesConfig;
      return content.advisories || {};
    } catch {
      return {};
    }
  }
  return {};
}

export function classifyDependencyVulnerability(
  pkgName: string,
  vuln: AuditVulnerability,
  acceptedAdvisories: Record<string, AcceptedAdvisory> = {}
): {
  isAccepted: boolean;
  advisory?: AcceptedAdvisory;
  findingSeverity: FindingSeverity;
  findingCode: string;
  title: string;
  description: string;
} {
  const sev = vuln.severity;
  const advisory = acceptedAdvisories[pkgName];
  const isAccepted = Boolean(
    advisory &&
    new Date(advisory.acceptedUntil).getTime() > Date.now()
  );

  if (isAccepted && advisory) {
    return {
      isAccepted: true,
      advisory,
      findingSeverity: 'INFO',
      findingCode: 'DEP_ADVISORY_ACCEPTED',
      title: `[ACCEPTED RISK] Monitored Dependency Advisory: ${pkgName}`,
      description: `Package ${pkgName} has known ${sev} advisory accepted until ${advisory.acceptedUntil}. Disposition: ${advisory.disposition}. Rationale: ${advisory.reason}`
    };
  }

  if (sev === 'critical') {
    return {
      isAccepted: false,
      findingSeverity: 'ACTION_REQUIRED',
      findingCode: 'DEP_VULN_CRITICAL',
      title: `Critical Dependency Vulnerability: ${pkgName}`,
      description: `Package ${pkgName} has unaccepted critical severity vulnerability. Direct: ${vuln.isDirect}.`
    };
  }

  if (sev === 'high') {
    return {
      isAccepted: false,
      findingSeverity: 'ACTION_REQUIRED',
      findingCode: 'DEP_VULN_HIGH',
      title: `High Dependency Vulnerability: ${pkgName}`,
      description: `Package ${pkgName} has unaccepted high severity vulnerability. Direct: ${vuln.isDirect}.`
    };
  }

  if (sev === 'moderate') {
    return {
      isAccepted: false,
      findingSeverity: 'WARNING',
      findingCode: 'DEP_VULN_MODERATE',
      title: `Moderate Dependency Vulnerability: ${pkgName}`,
      description: `Package ${pkgName} has moderate severity vulnerability.`
    };
  }

  return {
    isAccepted: false,
    findingSeverity: 'INFO',
    findingCode: 'DEP_VULN_LOW',
    title: `Low Dependency Advisory: ${pkgName}`,
    description: `Package ${pkgName} has low severity advisory.`
  };
}

export async function runDependencyAuditChecks(configPath?: string): Promise<{
  section: DependencyAuditSection;
  findings: RawFinding[];
}> {
  const findings: RawFinding[] = [];
  const acceptedAdvisories = loadAcceptedAdvisories(configPath);

  let criticalCount = 0;
  let highCount = 0;
  let moderateCount = 0;
  let lowCount = 0;
  let acceptedRiskCount = 0;
  let newActionableCount = 0;
  let notes = '';

  try {
    let auditRaw = '';
    try {
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
          acceptedRiskCount: 0,
          newActionableCount: 0,
          notes
        },
        findings
      };
    }

    const auditData: NpmAuditJson = JSON.parse(auditRaw);
    const vulns = auditData.vulnerabilities || {};

    for (const [pkgName, vuln] of Object.entries(vulns)) {
      const sev = vuln.severity;
      if (sev === 'critical') criticalCount++;
      else if (sev === 'high') highCount++;
      else if (sev === 'moderate') moderateCount++;
      else lowCount++;

      const classification = classifyDependencyVulnerability(pkgName, vuln, acceptedAdvisories);

      if (classification.isAccepted) {
        acceptedRiskCount++;
      } else if (classification.findingSeverity === 'ACTION_REQUIRED') {
        newActionableCount++;
      }

      const fp = createStableFingerprint(classification.findingCode, pkgName);
      findings.push({
        fingerprint: fp,
        code: classification.findingCode,
        severity: classification.findingSeverity,
        title: classification.title,
        description: classification.description,
        context: {
          package: pkgName,
          severity: sev,
          direct: vuln.isDirect,
          isAccepted: classification.isAccepted,
          advisory: classification.advisory
        }
      });
    }

    notes = `Audit scanned ${auditData.metadata?.dependencies?.total || 0} packages. Found: ${criticalCount} critical, ${highCount} high (${acceptedRiskCount} accepted risk, ${newActionableCount} new actionable), ${moderateCount} moderate, ${lowCount} low.`;
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
  if (newActionableCount > 0) {
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
      acceptedRiskCount,
      newActionableCount,
      notes
    },
    findings
  };
}
