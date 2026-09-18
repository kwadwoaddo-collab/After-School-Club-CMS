import fs from 'fs';
import path from 'path';
import { FindingsStore, FindingStoreEntry, MaintenanceFinding, FindingSeverity } from '../types';

const DEFAULT_STORE_PATH = path.resolve(process.cwd(), 'maintenance/state/findings-state.json');

export class FindingsStoreManager {
  private storePath: string;
  private data: FindingsStore;

  constructor(storePath = DEFAULT_STORE_PATH) {
    this.storePath = storePath;
    this.data = this.load();
  }

  private load(): FindingsStore {
    if (fs.existsSync(this.storePath)) {
      try {
        const raw = fs.readFileSync(this.storePath, 'utf8');
        return JSON.parse(raw);
      } catch {
        // Fallback on corrupt file
      }
    }
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      findings: {}
    };
  }

  public save(dryRun = false): void {
    if (dryRun) return;
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  /**
   * Process a set of active findings for the current run.
   * Compares with historical findings to set lifecycle ('NEW' | 'PERSISTENT' | 'RESOLVED').
   * Only transitions unobserved findings to 'RESOLVED' if their domain was actually executed.
   */
  public reconcileFindings(
    currentRawFindings: Array<{
      fingerprint: string;
      code: string;
      severity: FindingSeverity;
      title: string;
      description: string;
      context?: Record<string, unknown>;
    }>,
    dryRun = false,
    executedDomains?: string[]
  ): MaintenanceFinding[] {
    const now = new Date().toISOString();
    const activeFingerprints = new Set<string>();
    const reconciledFindings: MaintenanceFinding[] = [];

    // 1. Process active findings
    for (const raw of currentRawFindings) {
      activeFingerprints.add(raw.fingerprint);
      const existing = this.data.findings[raw.fingerprint];

      if (existing && existing.status === 'ACTIVE') {
        const occurrences = (existing.occurrences || 1) + 1;
        const finding: MaintenanceFinding = {
          fingerprint: raw.fingerprint,
          code: raw.code,
          severity: raw.severity,
          title: raw.title,
          description: raw.description,
          lifecycle: 'PERSISTENT',
          firstDetectedAt: existing.firstDetectedAt,
          lastObservedAt: now,
          occurrences,
          context: raw.context
        };
        this.data.findings[raw.fingerprint] = {
          ...finding,
          status: 'ACTIVE'
        };
        reconciledFindings.push(finding);
      } else {
        const finding: MaintenanceFinding = {
          fingerprint: raw.fingerprint,
          code: raw.code,
          severity: raw.severity,
          title: raw.title,
          description: raw.description,
          lifecycle: 'NEW',
          firstDetectedAt: now,
          lastObservedAt: now,
          occurrences: 1,
          context: raw.context
        };
        this.data.findings[raw.fingerprint] = {
          ...finding,
          status: 'ACTIVE'
        };
        reconciledFindings.push(finding);
      }
    }

    // 2. Identify resolved findings (was ACTIVE in store, but not present in activeFingerprints)
    for (const [fingerprint, stored] of Object.entries(this.data.findings)) {
      if (!activeFingerprints.has(fingerprint) && stored.status === 'ACTIVE') {
        const domain = stored.code.split('_')[0];
        const wasExecuted = !executedDomains || executedDomains.length === 0 || executedDomains.includes(domain);

        if (wasExecuted) {
          stored.status = 'RESOLVED';
          reconciledFindings.push({
            fingerprint: stored.fingerprint,
            code: stored.code,
            severity: 'INFO',
            title: `[RESOLVED] ${stored.title}`,
            description: `Previously active finding is no longer detected. ${stored.description}`,
            lifecycle: 'RESOLVED',
            firstDetectedAt: stored.firstDetectedAt,
            lastObservedAt: now,
            occurrences: stored.occurrences,
            context: stored.context
          });
        }
      }
    }

    this.save(dryRun);
    return reconciledFindings;
  }

  public getStoredFindings(): Record<string, FindingStoreEntry> {
    return this.data.findings;
  }
}
