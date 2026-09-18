export type Cadence = 'weekly' | 'monthly' | 'quarterly';

export type StatusLevel = 'HEALTHY' | 'WARNING' | 'ACTION_REQUIRED' | 'EXECUTION_FAILURE';

export type FindingSeverity = 'INFO' | 'WARNING' | 'ACTION_REQUIRED';

export type FindingLifecycle = 'NEW' | 'PERSISTENT' | 'RESOLVED';

export interface MaintenanceFinding {
  fingerprint: string;
  code: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  lifecycle: FindingLifecycle;
  firstDetectedAt: string;
  lastObservedAt: string;
  occurrences: number;
  context?: Record<string, unknown>;
}

export interface ExecutionHost {
  hostname: string;
  user: string;
  os: string;
  nodeVersion: string;
}

export interface ReportSummary {
  totalChecks: number;
  passed: number;
  warned: number;
  failed: number;
  findingsCount: number;
}

export interface ProbeResult {
  url: string;
  status: number;
  expectedStatus: number | number[];
  responseTimeMs: number;
  passed: boolean;
  notes?: string;
}

export interface ProductionHealthSection {
  status: StatusLevel;
  probes: ProbeResult[];
  notes?: string;
}

export interface VercelDeploymentSection {
  status: StatusLevel;
  productionDeployment?: {
    id?: string;
    url?: string;
    state?: string;
    createdAt?: string;
    creator?: string;
  };
  notes?: string;
}

export interface DatabaseHealthSection {
  status: StatusLevel;
  connectionPoolOk: boolean;
  connectionLatencyMs: number;
  databaseSizeMb?: number;
  activeConnections?: number;
  notes?: string;
}

export interface InvariantResult {
  name: string;
  passed: boolean;
  discrepanciesCount: number;
  details?: string;
}

export interface FinanceInvariantsSection {
  status: StatusLevel;
  invariants: InvariantResult[];
  notes?: string;
}

export interface QualityGateResult {
  gate: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

export interface QualityGatesSection {
  status: StatusLevel;
  gates: QualityGateResult[];
  uncommittedChanges: boolean;
  unpushedCommitsCount: number;
  notes?: string;
}

export interface DependencyAuditSection {
  status: StatusLevel;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  reachableVulnerabilitiesCount: number;
  notes?: string;
}

export interface TableScale {
  tableName: string;
  rowCount: number;
  status: 'NORMAL' | 'APPROACHING_LIMIT' | 'THRESHOLD_EXCEEDED';
}

export interface ScaleSnapshotSection {
  status: StatusLevel;
  tables: TableScale[];
  maintPerf1TriggerRecommendation: 'DEFER' | 'SCHEDULE' | 'IMMEDIATE';
  notes?: string;
}

export interface MaintenanceReportSections {
  productionHealth?: ProductionHealthSection;
  vercelDeployment?: VercelDeploymentSection;
  databaseHealth?: DatabaseHealthSection;
  financeInvariants?: FinanceInvariantsSection;
  qualityGates?: QualityGatesSection;
  dependencyAudit?: DependencyAuditSection;
  scaleSnapshot?: ScaleSnapshotSection;
}

export interface CMSMaintenanceReport {
  schemaVersion: '1.0.0';
  reportId: string;
  cadence: Cadence;
  generatedAt: string;
  executionHost: ExecutionHost;
  certifiedProductionBaselineSha: string;
  gitHeadSha: string;
  baselineDiffCount: number;
  overallStatus: StatusLevel;
  summary: ReportSummary;
  sections: MaintenanceReportSections;
  findings: MaintenanceFinding[];
}

export interface FindingStoreEntry {
  fingerprint: string;
  code: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  firstDetectedAt: string;
  lastObservedAt: string;
  occurrences: number;
  status: 'ACTIVE' | 'RESOLVED';
  context?: Record<string, unknown>;
}

export interface FindingsStore {
  version: '1.0.0';
  lastUpdated: string;
  findings: Record<string, FindingStoreEntry>;
}

export interface CliOptions {
  level: Cadence;
  dryRun?: boolean;
  outputJson?: string;
  outputMd?: string;
  skipQualityGates?: boolean;
}
