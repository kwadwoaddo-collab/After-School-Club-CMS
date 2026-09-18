import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { redactText, redactObject, createStableFingerprint } from '../src/lib/redact';
import { determineScheduledCadence } from '../src/lib/precedence';
import { acquireLock, releaseLock } from '../src/lib/lock';
import { FindingsStoreManager } from '../src/lib/findings-store';
import { enforceReportRetention } from '../src/lib/retention';

describe('MAINT-AUTO-1 Maintenance Framework Unit Tests', () => {
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

  describe('2. Calendar Precedence Logic', () => {
    it('resolves 1st Monday of January (Jan 5) to quarterly', () => {
      // Month 0 is Jan, Day 5
      const jan5 = new Date('2026-01-05T08:00:00Z');
      expect(determineScheduledCadence(jan5)).toBe('quarterly');
    });

    it('resolves 1st Monday of April (Apr 6) to quarterly', () => {
      const apr6 = new Date('2026-04-06T08:00:00Z');
      expect(determineScheduledCadence(apr6)).toBe('quarterly');
    });

    it('resolves 1st Monday of February (Feb 2) to monthly', () => {
      const feb2 = new Date('2026-02-02T08:00:00Z');
      expect(determineScheduledCadence(feb2)).toBe('monthly');
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
      // Simulate dead PID (PID 99999999)
      const staleData = {
        pid: 99999999,
        timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        cadence: 'weekly'
      };
      fs.writeFileSync(testLockPath, JSON.stringify(staleData));

      // Should break stale lock and acquire successfully
      const acquired = acquireLock('monthly', testLockPath);
      expect(acquired).toBe(true);
      releaseLock(testLockPath);
    });
  });

  describe('4. Finding Lifecycle State Machine', () => {
    it('tracks finding transitions: NEW -> PERSISTENT -> RESOLVED', () => {
      const manager = new FindingsStoreManager(testStorePath);
      const testFinding = {
        fingerprint: 'PROD_TEST:12345678',
        code: 'PROD_TEST',
        severity: 'WARNING' as const,
        title: 'Test Finding',
        description: 'First occurrence'
      };

      // Run 1: Seen for first time -> NEW
      const run1 = manager.reconcileFindings([testFinding]);
      expect(run1).toHaveLength(1);
      expect(run1[0].lifecycle).toBe('NEW');
      expect(run1[0].occurrences).toBe(1);

      // Run 2: Seen again -> PERSISTENT
      const run2 = manager.reconcileFindings([testFinding]);
      expect(run2).toHaveLength(1);
      expect(run2[0].lifecycle).toBe('PERSISTENT');
      expect(run2[0].occurrences).toBe(2);

      // Run 3: Absent -> RESOLVED
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

      // Subsequent Weekly run executes ONLY ['PROD', 'VERCEL', 'DB']
      const weeklyRun = manager.reconcileFindings([], false, ['PROD', 'VERCEL', 'DB']);
      // Should NOT resolve FIN_TEST because FIN was not executed
      expect(weeklyRun).toHaveLength(0);
      expect(manager.getStoredFindings()['FIN_TEST:abcdef12'].status).toBe('ACTIVE');

      // Next Monthly run executes ['PROD', 'VERCEL', 'DB', 'FIN'] with finding fixed
      const monthlyRunResolved = manager.reconcileFindings([], false, ['PROD', 'VERCEL', 'DB', 'FIN']);
      expect(monthlyRunResolved).toHaveLength(1);
      expect(monthlyRunResolved[0].lifecycle).toBe('RESOLVED');
      expect(manager.getStoredFindings()['FIN_TEST:abcdef12'].status).toBe('RESOLVED');
    });
  });

  describe('5. Report Retention & Cleanup', () => {
    it('identifies aged reports for retention and preserves .gitkeep', () => {
      const tempReportsDir = path.resolve(process.cwd(), 'maintenance/reports/temp_test_retention');
      const weeklyDir = path.join(tempReportsDir, 'weekly');
      fs.mkdirSync(weeklyDir, { recursive: true });

      const gitkeepPath = path.join(weeklyDir, '.gitkeep');
      fs.writeFileSync(gitkeepPath, '');

      // Create an old report (95 days old)
      const oldReportPath = path.join(weeklyDir, 'maint-weekly-old.json');
      fs.writeFileSync(oldReportPath, '{}');
      const oldTime = (Date.now() - 95 * 24 * 60 * 60 * 1000) / 1000;
      fs.utimesSync(oldReportPath, oldTime, oldTime);

      // Create a fresh report (5 days old)
      const freshReportPath = path.join(weeklyDir, 'maint-weekly-fresh.json');
      fs.writeFileSync(freshReportPath, '{}');

      const result = enforceReportRetention(tempReportsDir, { weekly: 90, monthly: 365, quarterly: 730 }, false);

      expect(result.deletedFiles).toContain(oldReportPath);
      expect(result.retainedFiles).toContain(freshReportPath);
      expect(fs.existsSync(gitkeepPath)).toBe(true);
      expect(fs.existsSync(oldReportPath)).toBe(false);

      // Cleanup
      fs.rmSync(tempReportsDir, { recursive: true, force: true });
    });
  });
});
