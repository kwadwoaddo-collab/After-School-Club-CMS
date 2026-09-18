import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { redactText, redactObject, createStableFingerprint } from '../src/lib/redact';
import { determineScheduledCadence } from '../src/lib/precedence';
import { acquireLock, releaseLock } from '../src/lib/lock';
import { FindingsStoreManager } from '../src/lib/findings-store';
import { enforceReportRetention } from '../src/lib/retention';
import { evaluateMaintPerf1 } from '../src/checks/database';
import { classifyDependencyVulnerability, AcceptedAdvisory } from '../src/checks/dependencies';
import { DEFAULT_PROBES } from '../src/checks/production';

describe('MAINT-AUTO-1R Maintenance Framework Unit & Contract Tests', () => {
  const testLockPath = path.resolve(process.cwd(), 'maintenance/state/test-maintenance.lock');
  const testStorePath = path.resolve(process.cwd(), 'maintenance/state/test-findings-state.json');

  afterEach(() => {
    if (fs.existsSync(testLockPath)) fs.unlinkSync(testLockPath);
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
  });

  describe('1. Secret Redaction & Sanitization', () => {
    it('redacts database URL credentials safely', () => {
      const input = 'Connection string: postgresql://admin:SuperSecret123!@ep-xyz.aws.neon.tech/neondb?sslmode=require';
      const output = redactText(input);
      expect(output).not.toContain('SuperSecret123!');
      expect(output).toContain('postgresql://admin:[REDACTED]@ep-xyz.aws.neon.tech/neondb?sslmode=require');
    });

    it('redacts Stripe API keys', () => {
      const input = 'Stripe webhook using key sk_live_51ABCDEF1234567890abcdefghijklmnopqrstuvwxyz';
      const output = redactText(input);
      expect(output).not.toContain('sk_live_51ABCDEF');
      expect(output).toContain('[STRIPE_KEY_REDACTED]');
    });

    it('redacts Resend API keys', () => {
      const input = 'Email sent with re_1234567890abcdefghijklmn';
      const output = redactText(input);
      expect(output).not.toContain('re_1234567890');
      expect(output).toContain('[RESEND_KEY_REDACTED]');
    });

    it('redacts dynamic secrets from process.env', () => {
      process.env.TEST_CUSTOM_SECRET = 'SuperUniqSecret987654';
      const input = 'Error reported with token: SuperUniqSecret987654 in request';
      const output = redactText(input);
      expect(output).not.toContain('SuperUniqSecret987654');
      expect(output).toContain('[REDACTED_SECRET]');
      delete process.env.TEST_CUSTOM_SECRET;
    });

    it('redacts nested objects deeply', () => {
      const obj = {
        name: 'Report',
        details: {
          url: 'postgresql://usr:pwd123@localhost/cms',
          nestedSecretKey: 'SensitiveValueHere'
        }
      };
      const sanitized = redactObject(obj);
      expect(sanitized.details.url).toContain('[REDACTED]');
      expect(sanitized.details.url).not.toContain('pwd123');
    });
  });

  describe('2. Calendar Precedence Logic (All Representative Dates)', () => {
    it('resolves 1st Monday of January (Jan 5) to quarterly', () => {
      const jan5 = new Date('2026-01-05T08:00:00Z');
      expect(determineScheduledCadence(jan5)).toBe('quarterly');
    });

    it('resolves 1st Monday of April (Apr 6) to quarterly', () => {
      const apr6 = new Date('2026-04-06T08:00:00Z');
      expect(determineScheduledCadence(apr6)).toBe('quarterly');
    });

    it('resolves 1st Monday of July (Jul 6) to quarterly', () => {
      const jul6 = new Date('2026-07-06T08:00:00Z');
      expect(determineScheduledCadence(jul6)).toBe('quarterly');
    });

    it('resolves 1st Monday of October (Oct 5) to quarterly', () => {
      const oct5 = new Date('2026-10-05T08:00:00Z');
      expect(determineScheduledCadence(oct5)).toBe('quarterly');
    });

    it('resolves 1st Monday of February (Feb 2) to monthly', () => {
      const feb2 = new Date('2026-02-02T08:00:00Z');
      expect(determineScheduledCadence(feb2)).toBe('monthly');
    });

    it('resolves 1st Monday of March (Mar 2) to monthly', () => {
      const mar2 = new Date('2026-03-02T08:00:00Z');
      expect(determineScheduledCadence(mar2)).toBe('monthly');
    });

    it('resolves 2nd Monday of February (Feb 9) to weekly', () => {
      const feb9 = new Date('2026-02-09T08:00:00Z');
      expect(determineScheduledCadence(feb9)).toBe('weekly');
    });

    it('resolves 3rd Monday of October (Oct 19) to weekly', () => {
      const oct19 = new Date('2026-10-19T08:00:00Z');
      expect(determineScheduledCadence(oct19)).toBe('weekly');
    });
  });

  describe('3. Process Locking & Stale Recovery', () => {
    it('acquires lock and releases cleanly', () => {
      const acquired = acquireLock('weekly', testLockPath);
      expect(acquired).toBe(true);
      expect(fs.existsSync(testLockPath)).toBe(true);

      releaseLock(testLockPath);
      expect(fs.existsSync(testLockPath)).toBe(false);
    });

    it('rejects concurrent lock acquisition when process is alive', () => {
      const first = acquireLock('weekly', testLockPath);
      expect(first).toBe(true);

      const second = acquireLock('monthly', testLockPath);
      expect(second).toBe(false);

      releaseLock(testLockPath);
    });

    it('recovers from stale lock when PID is dead or timestamp is ancient', () => {
      const staleData = {
        pid: 99999999,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        cadence: 'weekly'
      };
      fs.writeFileSync(testLockPath, JSON.stringify(staleData));

      const acquired = acquireLock('monthly', testLockPath);
      expect(acquired).toBe(true);
      releaseLock(testLockPath);
    });
  });

  describe('4. Finding Lifecycle & Domain Scoping', () => {
    it('tracks finding transitions: NEW -> PERSISTENT -> RESOLVED', () => {
      const manager = new FindingsStoreManager(testStorePath);
      const testFinding = {
        fingerprint: 'PROD_TEST:12345678',
        code: 'PROD_TEST',
        severity: 'WARNING' as const,
        title: 'Test Finding',
        description: 'First occurrence'
      };

      const run1 = manager.reconcileFindings([testFinding]);
      expect(run1).toHaveLength(1);
      expect(run1[0].lifecycle).toBe('NEW');
      expect(run1[0].occurrences).toBe(1);

      const run2 = manager.reconcileFindings([testFinding]);
      expect(run2).toHaveLength(1);
      expect(run2[0].lifecycle).toBe('PERSISTENT');
      expect(run2[0].occurrences).toBe(2);

      const run3 = manager.reconcileFindings([]);
      expect(run3).toHaveLength(1);
      expect(run3[0].lifecycle).toBe('RESOLVED');
      expect(run3[0].title).toContain('[RESOLVED]');
    });

    it('prevents cross-cadence thrashing: does not resolve unexecuted domains', () => {
      const manager = new FindingsStoreManager(testStorePath);
      const finFinding = {
        fingerprint: 'FIN_TEST:abcdef12',
        code: 'FIN_TEST',
        severity: 'ACTION_REQUIRED' as const,
        title: 'Finance Discrepancy',
        description: 'Orphan payment detected'
      };

      // Monthly run creates FIN_TEST
      manager.reconcileFindings([finFinding], false, ['PROD', 'VERCEL', 'DB', 'FIN']);
      expect(manager.getStoredFindings()['FIN_TEST:abcdef12'].status).toBe('ACTIVE');

      // Weekly run executes ONLY ['PROD', 'VERCEL', 'DB']
      const weeklyRun = manager.reconcileFindings([], false, ['PROD', 'VERCEL', 'DB']);
      // Must NOT resolve FIN_TEST because FIN was not executed
      expect(weeklyRun).toHaveLength(0);
      expect(manager.getStoredFindings()['FIN_TEST:abcdef12'].status).toBe('ACTIVE');

      // Subsequent Monthly run executes FIN with finding cleared
      const monthlyRunResolved = manager.reconcileFindings([], false, ['PROD', 'VERCEL', 'DB', 'FIN']);
      expect(monthlyRunResolved).toHaveLength(1);
      expect(monthlyRunResolved[0].lifecycle).toBe('RESOLVED');
      expect(manager.getStoredFindings()['FIN_TEST:abcdef12'].status).toBe('RESOLVED');
    });
  });

  describe('5. Authoritative MAINT-PERF-1 Trigger Boundary Tests', () => {
    it('499 invoices for an organisation does NOT trigger MAINT-PERF-1', () => {
      const res = evaluateMaintPerf1(499, 10, null);
      expect(res.status).toBe('NOT_TRIGGERED');
      expect(res.maxInvoicesForAnyOrganisation).toBe(499);
      expect(res.triggerReasons).toHaveLength(0);
    });

    it('500 invoices for an organisation DOES trigger MAINT-PERF-1', () => {
      const res = evaluateMaintPerf1(500, 10, null);
      expect(res.status).toBe('TRIGGERED');
      expect(res.maxInvoicesForAnyOrganisation).toBe(500);
      expect(res.triggerReasons[0]).toContain('Invoice count for organisation (500) >= 500 threshold');
    });

    it('49 active billing configs does NOT trigger MAINT-PERF-1', () => {
      const res = evaluateMaintPerf1(100, 49, null);
      expect(res.status).toBe('NOT_TRIGGERED');
      expect(res.activeBillingConfigs).toBe(49);
      expect(res.triggerReasons).toHaveLength(0);
    });

    it('50 active billing configs DOES trigger MAINT-PERF-1', () => {
      const res = evaluateMaintPerf1(100, 50, null);
      expect(res.status).toBe('TRIGGERED');
      expect(res.activeBillingConfigs).toBe(50);
      expect(res.triggerReasons[0]).toContain('Active billing configurations (50) >= 50 threshold');
    });

    it('p95 latency exactly 250ms does NOT trigger MAINT-PERF-1', () => {
      const res = evaluateMaintPerf1(100, 10, 250);
      expect(res.status).toBe('NOT_TRIGGERED');
      expect(res.observedP95Ms).toBe(250);
      expect(res.measurementAvailable).toBe(true);
      expect(res.triggerReasons).toHaveLength(0);
    });

    it('p95 latency of 251ms DOES trigger MAINT-PERF-1', () => {
      const res = evaluateMaintPerf1(100, 10, 251);
      expect(res.status).toBe('TRIGGERED');
      expect(res.observedP95Ms).toBe(251);
      expect(res.measurementAvailable).toBe(true);
      expect(res.triggerReasons[0]).toContain('p95 invoice-history query response time (251ms) > 250ms threshold');
    });

    it('unavailable p95 latency is reported honestly as null and does not trigger alone', () => {
      const res = evaluateMaintPerf1(100, 10, null);
      expect(res.status).toBe('NOT_TRIGGERED');
      expect(res.observedP95Ms).toBeNull();
      expect(res.measurementAvailable).toBe(false);
    });
  });

  describe('6. Dependency Classification & Accepted Risk Semantics', () => {
    const mockAcceptedRegistry: Record<string, AcceptedAdvisory> = {
      nodemailer: {
        package: 'nodemailer',
        acceptedUntil: '2027-01-01',
        reason: 'Required by next-auth EmailProvider; removing breaks Vercel build',
        disposition: 'ONGOING_ACCEPTED_RISK',
        monitoredSeverity: 'high'
      }
    };

    it('classifies reviewed advisory as ONGOING_ACCEPTED_RISK with INFO severity', () => {
      const res = classifyDependencyVulnerability(
        'nodemailer',
        {
          name: 'nodemailer',
          severity: 'high',
          isDirect: true,
          via: [],
          effects: [],
          range: '<6.9.9'
        },
        mockAcceptedRegistry
      );

      expect(res.isAccepted).toBe(true);
      expect(res.findingSeverity).toBe('INFO');
      expect(res.findingCode).toBe('DEP_ADVISORY_ACCEPTED');
      expect(res.title).toContain('[ACCEPTED RISK]');
      expect(res.description).toContain('ONGOING_ACCEPTED_RISK');
    });

    it('classifies genuinely new unaccepted high-severity vulnerability as ACTION_REQUIRED', () => {
      const res = classifyDependencyVulnerability(
        'some-vulnerable-package',
        {
          name: 'some-vulnerable-package',
          severity: 'high',
          isDirect: true,
          via: [],
          effects: [],
          range: '*'
        },
        mockAcceptedRegistry
      );

      expect(res.isAccepted).toBe(false);
      expect(res.findingSeverity).toBe('ACTION_REQUIRED');
      expect(res.findingCode).toBe('DEP_VULN_HIGH');
      expect(res.title).toContain('High Dependency Vulnerability');
    });
  });

  describe('7. Weekly Cron Boundary Coverage Probes', () => {
    it('includes all three unauthorized cron probes expecting 401', () => {
      const billingProbe = DEFAULT_PROBES.find((p) => p.path === '/api/cron/billing');
      const digestProbe = DEFAULT_PROBES.find((p) => p.path === '/api/cron/digest');
      const rollProbe = DEFAULT_PROBES.find((p) => p.path === '/api/cron/school-year-roll');

      expect(billingProbe).toBeDefined();
      expect(billingProbe?.expectedStatus).toBe(401);

      expect(digestProbe).toBeDefined();
      expect(digestProbe?.expectedStatus).toBe(401);

      expect(rollProbe).toBeDefined();
      expect(rollProbe?.expectedStatus).toBe(401);
    });

    it('includes negative probes for auth-test (404) and invalid stripe webhook (400)', () => {
      const authTestProbe = DEFAULT_PROBES.find((p) => p.path === '/auth-test');
      const stripeProbe = DEFAULT_PROBES.find((p) => p.path === '/api/webhooks/stripe-invoice');

      expect(authTestProbe).toBeDefined();
      expect(authTestProbe?.expectedStatus).toBe(404);

      expect(stripeProbe).toBeDefined();
      expect(stripeProbe?.expectedStatus).toBe(400);
    });
  });

  describe('8. Quality Gates & Scheduler Command Inspection', () => {
    it('prohibits scheduled automated run from using --skip-quality-gates', () => {
      const wrapperContent = fs.readFileSync(
        path.resolve(process.cwd(), 'maintenance/scripts/scheduler-wrapper.sh'),
        'utf8'
      );
      expect(wrapperContent).not.toContain('--skip-quality-gates');
      expect(wrapperContent).toContain('--auto-cadence');
    });

    it('launchd plist points to wrapper and runs every Monday at 08:00', () => {
      const plistContent = fs.readFileSync(
        path.resolve(process.cwd(), 'maintenance/scripts/launchd/com.afterschoolclub.cms-maintenance.plist'),
        'utf8'
      );
      expect(plistContent).toContain('scheduler-wrapper.sh');
      expect(plistContent).toContain('<key>Weekday</key>');
      expect(plistContent).toContain('<integer>1</integer>');
      expect(plistContent).toContain('<key>Hour</key>');
      expect(plistContent).toContain('<integer>8</integer>');
      expect(plistContent).toContain('<key>RunAtLoad</key>');
      expect(plistContent).toContain('<false/>');
    });
  });

  describe('9. Report Retention & Cleanup', () => {
    it('identifies aged reports for retention and preserves .gitkeep', () => {
      const tempReportsDir = path.resolve(process.cwd(), 'maintenance/reports/temp_test_retention');
      const weeklyDir = path.join(tempReportsDir, 'weekly');
      fs.mkdirSync(weeklyDir, { recursive: true });

      const gitkeepPath = path.join(weeklyDir, '.gitkeep');
      fs.writeFileSync(gitkeepPath, '');

      const oldReportPath = path.join(weeklyDir, 'maint-weekly-old.json');
      fs.writeFileSync(oldReportPath, '{}');
      const oldTime = (Date.now() - 95 * 24 * 60 * 60 * 1000) / 1000;
      fs.utimesSync(oldReportPath, oldTime, oldTime);

      const freshReportPath = path.join(weeklyDir, 'maint-weekly-fresh.json');
      fs.writeFileSync(freshReportPath, '{}');

      const result = enforceReportRetention(tempReportsDir, { weekly: 90, monthly: 365, quarterly: 730 }, false);

      expect(result.deletedFiles).toContain(oldReportPath);
      expect(result.retainedFiles).toContain(freshReportPath);
      expect(fs.existsSync(gitkeepPath)).toBe(true);
      expect(fs.existsSync(oldReportPath)).toBe(false);

      fs.rmSync(tempReportsDir, { recursive: true, force: true });
    });
  });
});
