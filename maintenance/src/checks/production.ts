import { ProbeResult, ProductionHealthSection, StatusLevel, FindingSeverity } from '../types';
import { createStableFingerprint, redactText } from '../lib/redact';

export interface ProductionCheckConfig {
  baseUrl: string;
  timeoutMs?: number;
  warnLatencyMs?: number;
}

interface RawFinding {
  fingerprint: string;
  code: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  context?: Record<string, unknown>;
}

interface ProbeDefinition {
  name: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  expectedStatus: number | number[];
  redirect?: RequestRedirect;
}

const DEFAULT_PROBES: ProbeDefinition[] = [
  // Tier 1: Shallow health
  { name: 'Shallow Health API', path: '/api/health', expectedStatus: 200 },
  // Tier 2: Deep health
  { name: 'Deep System Health API', path: '/api/health/deep', expectedStatus: 200 },
  // Tier 3: Public UI Routes
  { name: 'Public Landing Page', path: '/', expectedStatus: 200 },
  { name: 'Public Privacy Policy', path: '/privacy', expectedStatus: 200 },
  { name: 'Public Terms Page', path: '/terms', expectedStatus: 200 },
  { name: 'Public Login Page', path: '/login', expectedStatus: 200 },
  // Tier 4: Auth Redirect Protection
  { name: 'Finance Dashboard Auth Redirect', path: '/dashboard/finance', expectedStatus: [302, 307, 308], redirect: 'manual' },
  // Tier 5: Negative Security Probes
  { name: 'Negative: Removed Test Endpoint', path: '/auth-test', expectedStatus: 404 },
  { name: 'Negative: Cron Unauthenticated Request', path: '/api/cron/billing', expectedStatus: 401 },
  { name: 'Negative: Stripe Webhook Missing Signature', path: '/api/webhooks/stripe-invoice', method: 'POST', body: '{}', expectedStatus: 400 }
];

export async function runProductionHealthChecks(
  config: ProductionCheckConfig
): Promise<{ section: ProductionHealthSection; findings: RawFinding[] }> {
  const timeoutMs = config.timeoutMs || 10000;
  const warnLatencyMs = config.warnLatencyMs || 1500;
  const probeResults: ProbeResult[] = [];
  const findings: RawFinding[] = [];

  for (const probe of DEFAULT_PROBES) {
    const url = `${config.baseUrl.replace(/\/$/, '')}${probe.path}`;
    const startTime = Date.now();
    let status = 0;
    let passed = false;
    let notes = '';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: probe.method || 'GET',
        headers: probe.headers || {},
        body: probe.body,
        redirect: probe.redirect || 'follow',
        signal: controller.signal
      });

      clearTimeout(timer);
      const elapsed = Date.now() - startTime;
      status = response.status;

      const expectedList = Array.isArray(probe.expectedStatus) ? probe.expectedStatus : [probe.expectedStatus];
      passed = expectedList.includes(status);

      if (!passed) {
        notes = `Expected HTTP ${expectedList.join('/')} but received ${status}`;
        const fingerprint = createStableFingerprint('PROD_HTTP_STATUS', `${probe.path}:${status}`);
        findings.push({
          fingerprint,
          code: 'PROD_HTTP_STATUS',
          severity: 'ACTION_REQUIRED',
          title: `Production probe failed: ${probe.name}`,
          description: `Route ${probe.path} returned HTTP ${status}, expected ${expectedList.join('/')}. Response time: ${elapsed}ms.`,
          context: { url: redactText(url), status, elapsed, expected: expectedList }
        });
      } else if (elapsed > warnLatencyMs) {
        notes = `Passed but latency high: ${elapsed}ms > ${warnLatencyMs}ms`;
        const fingerprint = createStableFingerprint('PROD_HIGH_LATENCY', probe.path);
        findings.push({
          fingerprint,
          code: 'PROD_HIGH_LATENCY',
          severity: 'WARNING',
          title: `High latency on production probe: ${probe.name}`,
          description: `Route ${probe.path} took ${elapsed}ms to respond (threshold: ${warnLatencyMs}ms).`,
          context: { url: redactText(url), status, elapsed, threshold: warnLatencyMs }
        });
      } else {
        notes = `OK (${elapsed}ms)`;
      }

      probeResults.push({
        url: redactText(url),
        status,
        expectedStatus: probe.expectedStatus,
        responseTimeMs: elapsed,
        passed,
        notes
      });
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = redactText(errorMsg);

      probeResults.push({
        url: redactText(url),
        status: 0,
        expectedStatus: probe.expectedStatus,
        responseTimeMs: elapsed,
        passed: false,
        notes: `Network/Fetch error: ${safeMsg}`
      });

      const fingerprint = createStableFingerprint('PROD_PROBE_ERROR', probe.path);
      findings.push({
        fingerprint,
        code: 'PROD_PROBE_ERROR',
        severity: 'ACTION_REQUIRED',
        title: `Production probe error: ${probe.name}`,
        description: `Failed to probe ${probe.path}: ${safeMsg}`,
        context: { url: redactText(url), error: safeMsg, elapsed }
      });
    }
  }

  const failedCount = probeResults.filter((p) => !p.passed).length;
  const warnedCount = findings.filter((f) => f.severity === 'WARNING').length;

  let sectionStatus: StatusLevel = 'HEALTHY';
  if (failedCount > 0) {
    sectionStatus = 'ACTION_REQUIRED';
  } else if (warnedCount > 0) {
    sectionStatus = 'WARNING';
  }

  return {
    section: {
      status: sectionStatus,
      probes: probeResults,
      notes: `${probeResults.length} probes evaluated: ${probeResults.length - failedCount} passed, ${failedCount} failed.`
    },
    findings
  };
}
