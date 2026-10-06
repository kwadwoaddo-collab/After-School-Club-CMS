/**
 * Booking email outbox: PUBLIC API (E1, E6). CMS-OPS-REMEDIATION-1C V15.
 * Dependency direction: types -> classifier -> breaker -> claim -> dispatch -> maintenance -> email-outbox (this file).
 * Routes, server actions and the cron import ONLY this module from the outbox family. This module carries NO "use server".
 *
 * Contents: (1) transaction-owning primitives used INSIDE a caller's transaction (enqueueBookingEmail,
 * transitionBookingAndEnqueue, supersedeOldBookingForReplacement), (2) the after() fast-path contract
 * (captureEntryBudget, createFastPathCallback, registerFastPathAfterCommit, runFastPath), (3) the cron sweeper entry
 * (runSweeper), (4) tenant vs platform diagnostics read helpers, (5) hard-delete trigger support constants.
 *
 * EMAIL DELIVERY IS NOT EXACTLY ONCE (E1 residual-risk disclosure): PostgreSQL and the provider share no transaction.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { logger } from '@/lib/logger';
import { isPlatformAdmin } from '@/lib/org-approval-guard';
import { computeConfigFingerprint, readBreakerSnapshot, type RootDb, type Tx } from './email-outbox-breaker';
import { claimOutboxBatch } from './email-outbox-claim';
import {
  dispatchClaimedRows,
  isWorkerEnabled,
  originStampMinRemainingMs,
  remainingMs,
  startInvocationBudget,
  type DispatchResult,
  type InvocationBudget,
  type ProviderPort,
} from './email-outbox-dispatch';
import { runMaintenance, type MaintenanceReport } from './email-outbox-maintenance';
import {
  ACTION_MAINTENANCE_MIN_LEFTOVER_MS,
  ACTIVE_OUTBOX_STATUSES,
  OUTBOX_PAYLOAD_VERSION,
  TERMINAL_OUTBOX_STATUSES,
  type CommunicationType,
  type DispatchOrigin,
  type OutboxPayload,
} from './email-outbox-types';

// ---- re-exports (ACTION_BUDGET_MS etc. are defined ONCE in the types module)
export {
  ACTION_BUDGET_MS,
  ACTION_MAINTENANCE_MAX_ROWS,
  ACTION_MAINTENANCE_MIN_LEFTOVER_MS,
  ACTION_STAMP_MIN_REMAINING_MS,
  ROUTE_BUDGET_MS,
  POST_STAMP_MIN_TIMEOUT_MS,
  OUTBOX_PAYLOAD_VERSION,
  ACTIVE_OUTBOX_STATUSES,
  TERMINAL_OUTBOX_STATUSES,
} from './email-outbox-types';
export type { CommunicationType, DispatchOrigin, OutboxPayload, BookingConfirmationPayload, BookingReschedulePayload, BookingCancelledPayload } from './email-outbox-types';
export type { RootDb, Tx } from './email-outbox-breaker';
export { isWorkerEnabled, startInvocationBudget } from './email-outbox-dispatch';
export type { InvocationBudget, ProviderPort } from './email-outbox-dispatch';

const errName = (err: unknown): string => (err instanceof Error ? err.name : 'UnknownError');

// ============================================================================
// (1) TRANSACTION-OWNING PRIMITIVES (called inside the caller's db.transaction)
// ============================================================================
/** Base idempotency key: booking_{type lower}:{bookingId}:v{version}:parent (never contains "vnull"). */
export function buildIdempotencyKey(type: CommunicationType, bookingId: string, version: number): string {
  if (!Number.isInteger(version) || version < 1) throw new Error('INVALID_COMMUNICATION_VERSION');
  if (!bookingId) throw new Error('INVALID_BOOKING_ID');
  return `${type.toLowerCase()}:${bookingId}:v${version}:parent`;
}

export interface EnqueueBookingEmailArgs {
  organisationId: string;
  centreId: string | null;
  bookingId: string;
  version: number;
  type: CommunicationType;
  recipientEmail: string;
  payload: OutboxPayload;
  /** 'PORTAL_URL' for createPortalBooking rows (never reset); null for public rows (the stamp chooses the variant). */
  linkMode: 'PORTAL_URL' | null;
}

/**
 * Insert the outbox row INSIDE the caller's booking transaction (atomic with the booking: a rolled-back transaction leaves
 * no row; a committed booking always has its row). ON CONFLICT (booking_id, transition_version) returns the existing row id
 * (idempotent per booking version). Callers enqueue only when the parent has an email.
 */
export async function enqueueBookingEmail(tx: Tx, args: EnqueueBookingEmailArgs): Promise<{ outboxId: string }> {
  if (!args.recipientEmail || typeof args.recipientEmail !== 'string') throw new Error('MISSING_RECIPIENT');
  if (args.payload.payloadVersion !== OUTBOX_PAYLOAD_VERSION) throw new Error('UNSUPPORTED_PAYLOAD_VERSION');
  const key = buildIdempotencyKey(args.type, args.bookingId, args.version);
  const inserted = await tx.execute(sql`
    INSERT INTO booking_email_outbox (organisation_id, centre_id, booking_id, transition_version, communication_type, recipient_email, idempotency_key, payload, link_mode)
    VALUES (${args.organisationId}::uuid, ${args.centreId}::uuid, ${args.bookingId}::uuid, ${args.version}, ${args.type}, ${args.recipientEmail}, ${key},
            ${JSON.stringify(args.payload)}::jsonb, ${args.linkMode}::text)
    ON CONFLICT (booking_id, transition_version) DO NOTHING
    RETURNING id`);
  if (inserted.length > 0) return { outboxId: (inserted[0] as unknown as { id: string }).id };
  const existing = await tx.execute(sql`SELECT id FROM booking_email_outbox WHERE booking_id = ${args.bookingId}::uuid AND transition_version = ${args.version}`);
  if (existing.length === 0) throw new Error('OUTBOX_ENQUEUE_FAILED');
  return { outboxId: (existing[0] as unknown as { id: string }).id };
}

export interface SupersedeResult {
  superseded: number;
  /** An unstamped (never provider-attempted) CONFIRMATION was superseded: the replacement should carry portal login guidance. */
  hadUnsentConfirmation: boolean;
}

/**
 * Supersede every unsent older row of a booking (versions below `belowVersion`): SUPERSEDED, payload NULL, claim cleared.
 * PROCESSING rows are NOT touched here: their finalisation turns a retry-eligible outcome into SUPERSEDED by CASE (fenced).
 */
export async function supersedeUnsentOutboxRows(tx: Tx, bookingId: string, belowVersion: number): Promise<SupersedeResult> {
  const rows = await tx.execute(sql`
    UPDATE booking_email_outbox
    SET status = 'SUPERSEDED', payload = NULL, claim_token = NULL, claim_expires_at = NULL, updated_at = now()
    WHERE booking_id = ${bookingId}::uuid AND transition_version < ${belowVersion}
      AND status IN ('PENDING','RETRY_SCHEDULED','HELD_PARENT_BINNED','HELD_BOOKING_PENDING','HELD_PROVIDER_OPERATIONAL')
    RETURNING communication_type, first_provider_attempt_at`);
  const list = rows as unknown as { communication_type: string; first_provider_attempt_at: Date | null }[];
  return {
    superseded: list.length,
    hadUnsentConfirmation: list.some((r) => r.communication_type === 'BOOKING_CONFIRMATION' && r.first_provider_attempt_at === null),
  };
}

export interface TransitionBookingArgs {
  bookingId: string;
  organisationId: string;
  centreId: string | null;
  type: CommunicationType;
  /** null/empty = the parent has no email: the booking still transitions, no row is enqueued. */
  recipientEmail: string | null;
  /** The caller's own booking mutation (status, startAt, ...), run inside the same transaction under the booking row lock. */
  applyBookingChange: (tx: Tx) => Promise<void>;
  buildPayload: (ctx: { version: number; hadUnsentConfirmation: boolean }) => OutboxPayload;
}

/**
 * Same-booking transition (staff/portal cancel and reschedule): lock the booking row, apply the caller's change, increment
 * communication_version, supersede unsent older rows, enqueue the new version's communication, all in the caller's transaction.
 */
export async function transitionBookingAndEnqueue(
  tx: Tx,
  args: TransitionBookingArgs,
): Promise<{ version: number; outboxId: string | null; superseded: number; hadUnsentConfirmation: boolean }> {
  const locked = await tx.execute(sql`SELECT communication_version FROM bookings WHERE id = ${args.bookingId}::uuid FOR UPDATE`);
  if (locked.length === 0) throw new Error('BOOKING_NOT_FOUND');
  await args.applyBookingChange(tx);
  const bumped = await tx.execute(sql`UPDATE bookings SET communication_version = communication_version + 1 WHERE id = ${args.bookingId}::uuid RETURNING communication_version`);
  const version = (bumped[0] as unknown as { communication_version: number }).communication_version;
  const sup = await supersedeUnsentOutboxRows(tx, args.bookingId, version);
  let outboxId: string | null = null;
  if (args.recipientEmail) {
    outboxId = (
      await enqueueBookingEmail(tx, {
        organisationId: args.organisationId,
        centreId: args.centreId,
        bookingId: args.bookingId,
        version,
        type: args.type,
        recipientEmail: args.recipientEmail,
        payload: args.buildPayload({ version, hadUnsentConfirmation: sup.hadUnsentConfirmation }),
        linkMode: null,
      })
    ).outboxId;
  }
  return { version, outboxId, superseded: sup.superseded, hadUnsentConfirmation: sup.hadUnsentConfirmation };
}

export interface ReplacementRequest {
  oldBookingId: string;
  expectedParentId: string;
  expectedOrganisationId: string;
}
export type ReplacementRejectReason = 'NOT_FOUND' | 'ALREADY_CANCELLED';
export interface ReplacementOutcome {
  replaced: boolean;
  rejectedReason?: ReplacementRejectReason;
  hadUnsentConfirmation: boolean;
  oldStartAt?: Date;
  oldGoogleCalendarEventId?: string | null;
}

/**
 * Atomic old-booking supersession for a replacement. Ownership predicates are INSIDE the locking statement
 * (SELECT ... FROM bookings b JOIN centres c ... WHERE b.id AND b.parent_id AND c.organisation_id FOR UPDATE OF b), so a foreign
 * booking is never locked; zero rows -> NOT_FOUND (parent/org mismatch collapses to NOT_FOUND externally); cancelled after the
 * lock -> ALREADY_CANCELLED. A replaced booking is set cancelled, its communication_version incremented, unsent rows superseded.
 * The Google Calendar delete is the CALLER's job strictly AFTER the outer commit and only when replaced = true.
 */
export async function supersedeOldBookingForReplacement(tx: Tx, req: ReplacementRequest): Promise<ReplacementOutcome> {
  const rows = await tx.execute(sql`
    SELECT b.id, b.status::text AS status, b.start_at, b.google_calendar_event_id
    FROM bookings b JOIN centres c ON c.id = b.centre_id
    WHERE b.id = ${req.oldBookingId}::uuid AND b.parent_id = ${req.expectedParentId}::uuid AND c.organisation_id = ${req.expectedOrganisationId}::uuid
    FOR UPDATE OF b`);
  if (rows.length === 0) return { replaced: false, rejectedReason: 'NOT_FOUND', hadUnsentConfirmation: false };
  const old = rows[0] as unknown as { status: string; start_at: Date; google_calendar_event_id: string | null };
  if (old.status === 'cancelled') return { replaced: false, rejectedReason: 'ALREADY_CANCELLED', hadUnsentConfirmation: false };
  const bumped = await tx.execute(sql`
    UPDATE bookings SET status = 'cancelled', communication_version = communication_version + 1
    WHERE id = ${req.oldBookingId}::uuid RETURNING communication_version`);
  const version = (bumped[0] as unknown as { communication_version: number }).communication_version;
  const sup = await supersedeUnsentOutboxRows(tx, req.oldBookingId, version);
  return {
    replaced: true,
    hadUnsentConfirmation: sup.hadUnsentConfirmation,
    oldStartAt: new Date(old.start_at),
    oldGoogleCalendarEventId: old.google_calendar_event_id ?? null,
  };
}

// ============================================================================
// (2) FAST PATH / after() INTEGRATION CONTRACT
// ============================================================================
/**
 * CONTRACT for callers (routes and server actions):
 *  1. capture the entry budget at request/action entry: `const budget = captureEntryBudget('route' | 'action')`;
 *  2. enqueue inside the booking transaction with enqueueBookingEmail / transitionBookingAndEnqueue;
 *  3. AFTER the authoritative COMMIT, and only when outboxId is non-null, call
 *     `registerFastPathAfterCommit(after, { origin, outboxId, budget })` (its own try/catch; never alters the response);
 *  4. correctness never depends on after(): the row is claimable by the sweeper; an OPEN breaker leaves it durable.
 * ROUTE origin: maintenance first, then (a) own row, (b) the HALF_OPEN probe, (c) up to 3 oldest due rows; never more than 4
 * provider calls; (b) and (c) are disabled during the ramp. ACTION origin: own row FIRST with NO maintenance beforehand, then
 * (leftover >= ACTION_MAINTENANCE_MIN_LEFTOVER_MS) the action-scope maintenance (<= 10 rows + one breaker attempt).
 */
export function captureEntryBudget(origin: DispatchOrigin): InvocationBudget {
  return startInvocationBudget(origin);
}

export interface FastPathArgs {
  origin: 'route' | 'action';
  /** The caller's own outbox row. */
  outboxId: string;
  /** Entry budget captured at request/action entry (never from after() start). */
  budget: InvocationBudget;
  rootDb?: RootDb;
  port?: ProviderPort;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}

export interface FastPathReport {
  paused: boolean;
  maintenance: MaintenanceReport | null;
  claimed: number;
  results: DispatchResult[];
  maintenanceBeforeOwnRow: boolean;
  error: string | null;
}

/** Real provider port from email.ts (lazy import: nothing loads the SDK, templates or PDF code until a send is attempted). */
export async function loadDefaultProviderPort(): Promise<ProviderPort> {
  const mod = await import('./email');
  return {
    isConfigured: () => mod.isProviderConfigured(),
    configParts: () => mod.getProviderConfigParts(),
    send: (req) => mod.sendOutboxEmail(req),
  };
}

function fingerprintOf(port: ProviderPort): string | null {
  const parts = port.configParts?.();
  return parts ? computeConfigFingerprint(parts) : null;
}

/** The after() fast path. Never throws; every failure is logged by error NAME only. */
export async function runFastPath(args: FastPathArgs): Promise<FastPathReport> {
  const rootDb = args.rootDb ?? db;
  const report: FastPathReport = { paused: false, maintenance: null, claimed: 0, results: [], maintenanceBeforeOwnRow: false, error: null };
  try {
    const port = args.port ?? (await loadDefaultProviderPort());
    const deps = { port, budget: args.budget, sleep: args.sleep, clock: args.clock };
    const paused = !isWorkerEnabled();
    report.paused = paused;
    const dispatch = async (rows: Awaited<ReturnType<typeof claimOutboxBatch>>) => {
      if (rows.length === 0) return;
      report.claimed += rows.length;
      const used = report.results.filter((r) => r.kind === 'PROVIDER_CALLED').length;
      report.results.push(...(await dispatchClaimedRows(rootDb, rows, deps, { maxProviderCalls: Math.max(0, 4 - used) })));
    };

    if (args.origin === 'route') {
      // maintenance BEFORE claiming (provider-free while paused); a paused fast path claims zero rows
      report.maintenanceBeforeOwnRow = true;
      report.maintenance = await runMaintenance(rootDb, { origin: 'route', paused, fingerprint: fingerprintOf(port), budget: args.budget });
      if (paused) return report;
      await dispatch(await claimOutboxBatch(rootDb, { limit: 1, specificId: args.outboxId })); // (a)
      const snap = await readBreakerSnapshot(rootDb);
      const probeId = snap.state === 'HALF_OPEN' ? snap.probeOutboxId : null;
      if (probeId && probeId !== args.outboxId) await dispatch(await claimOutboxBatch(rootDb, { limit: 1, specificId: probeId })); // (b)
      const ramp = snap.rampUntil !== null && snap.rampUntil.getTime() > snap.dbNow.getTime();
      if (!ramp && remainingMs(args.budget) >= originStampMinRemainingMs('route')) await dispatch(await claimOutboxBatch(rootDb, { limit: 3 })); // (c)
      return report;
    }

    // ACTION origin: own row first, zero maintenance statements beforehand
    if (paused) {
      return report; // nothing claimed; provider-free disposal is the cron/route's job on this origin
    }
    await dispatch(await claimOutboxBatch(rootDb, { limit: 1, specificId: args.outboxId }));
    if (remainingMs(args.budget) >= ACTION_MAINTENANCE_MIN_LEFTOVER_MS) {
      report.maintenance = await runMaintenance(rootDb, { origin: 'action', paused: false, budget: args.budget });
    }
    return report;
  } catch (err) {
    report.error = errName(err);
    logger.warn('email_outbox_fast_path_error', { event: 'email_outbox_fast_path_error', errorName: report.error, origin: args.origin });
    return report;
  }
}

/** after() callback factory: the callback NEVER throws. */
export function createFastPathCallback(args: FastPathArgs): () => Promise<void> {
  return async () => {
    try {
      await runFastPath(args);
    } catch (err) {
      logger.warn('email_outbox_fast_path_callback_error', { event: 'email_outbox_fast_path_callback_error', errorName: errName(err) });
    }
  };
}

/**
 * Register the fast path with Next's after() AFTER the commit, only when outboxId is non-null. Registration failure is caught
 * (error name only) and NEVER alters the caller's success response. Returns whether the callback was registered.
 */
export function registerFastPathAfterCommit(
  afterFn: (callback: () => Promise<void>) => void,
  args: Omit<FastPathArgs, 'outboxId'> & { outboxId: string | null },
): boolean {
  if (!args.outboxId) return false;
  try {
    afterFn(createFastPathCallback({ ...args, outboxId: args.outboxId }));
    return true;
  } catch (err) {
    logger.warn('email_outbox_after_registration_failed', { event: 'email_outbox_after_registration_failed', errorName: errName(err), origin: args.origin });
    return false;
  }
}

// ============================================================================
// (3) SWEEPER (CRON ENTRY)
// ============================================================================
export interface SweeperOptions {
  rootDb?: RootDb;
  port?: ProviderPort;
  budget?: InvocationBudget;
  /** Rows claimed per batch (default 5) and total rows per invocation (default 25). */
  batchSize?: number;
  maxRows?: number;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}
export interface SweeperReport {
  paused: boolean;
  maintenance: MaintenanceReport | null;
  claimed: number;
  results: DispatchResult[];
  error: string | null;
}

/** Cron sweeper: maintenance (stale leases, rungs 1-5, anchors, probe, bulk release), then bounded sequential dispatch. Never throws. */
export async function runSweeper(opts: SweeperOptions = {}): Promise<SweeperReport> {
  const rootDb = opts.rootDb ?? db;
  const budget = opts.budget ?? startInvocationBudget('cron');
  const report: SweeperReport = { paused: false, maintenance: null, claimed: 0, results: [], error: null };
  try {
    const port = opts.port ?? (await loadDefaultProviderPort());
    const paused = !isWorkerEnabled();
    report.paused = paused;
    report.maintenance = await runMaintenance(rootDb, { origin: 'cron', paused, fingerprint: fingerprintOf(port), budget });
    if (paused) return report;
    const deps = { port, budget, sleep: opts.sleep, clock: opts.clock };
    const maxRows = opts.maxRows ?? 25;
    const batchSize = opts.batchSize ?? 5;
    const probeId = report.maintenance.probeOutboxId;
    if (probeId) {
      const probe = await claimOutboxBatch(rootDb, { limit: 1, specificId: probeId });
      report.claimed += probe.length;
      report.results.push(...(await dispatchClaimedRows(rootDb, probe, deps, { maxProviderCalls: 1 })));
    }
    while (report.claimed < maxRows && remainingMs(budget) >= originStampMinRemainingMs('cron')) {
      const rows = await claimOutboxBatch(rootDb, { limit: Math.min(batchSize, maxRows - report.claimed) });
      if (rows.length === 0) break;
      report.claimed += rows.length;
      report.results.push(...(await dispatchClaimedRows(rootDb, rows, deps, { maxProviderCalls: rows.length })));
    }
    return report;
  } catch (err) {
    report.error = errName(err);
    logger.warn('email_outbox_sweeper_error', { event: 'email_outbox_sweeper_error', errorName: report.error });
    return report;
  }
}

// ============================================================================
// (4) DIAGNOSTICS: TENANT vs PLATFORM scope (E3, E6; resolves H-23)
// ============================================================================
export type DiagnosticsScope = 'TENANT' | 'PLATFORM' | 'NOT_FOUND';

/**
 * ?scope=platform is honoured ONLY for a session email that passes isPlatformAdmin (fail-closed); anything else requesting
 * it is NOT_FOUND (a not-found style response, never a redirect). No requested scope = TENANT.
 */
export function resolveDiagnosticsScope(params: { requestedScope?: string | null; email?: string | null }): DiagnosticsScope {
  if (params.requestedScope === 'platform') return isPlatformAdmin(params.email) ? 'PLATFORM' : 'NOT_FOUND';
  return 'TENANT';
}

export interface DiagnosticIdentifier {
  outboxId: string;
  bookingId: string | null;
  status: string;
  attentionReason: string | null;
  createdAt: Date;
  attemptCount: number;
}
export interface TenantDiagnostics {
  scope: 'TENANT';
  counts: {
    backlog: number;
    retryScheduled: number;
    retryScheduledStamped: number;
    processing: number;
    /** GENERIC held count (HELD_PROVIDER_OPERATIONAL): no provider reason, error name, fingerprint or probe time. */
    held: number;
    heldParentBinned: number;
    heldBookingPending: number;
    failedPermanent: number;
    skippedPastSession: number;
    accepted: number;
  };
  attentionByReason: Record<string, number>;
  /** ORG_OWNER only, own organisation only, at most 100, no PII. */
  identifiers?: DiagnosticIdentifier[];
}

export interface TenantDiagnosticsParams {
  organisationId: string;
  /** null = org-wide (ORG_OWNER); an array = assigned centres only (MANAGER; NULL-centre rows hidden; empty = nothing). */
  centreIds: string[] | null;
  includeIdentifiers: boolean;
}

/** EVERY query carries organisation_id = the caller's organisation (server-side). Never returns a breaker object. */
export async function getTenantDiagnostics(rootDb: RootDb, p: TenantDiagnosticsParams): Promise<TenantDiagnostics> {
  const centreFilter = p.centreIds === null ? sql`` : p.centreIds.length === 0 ? sql`AND false` : sql`AND centre_id IN (${sql.join(p.centreIds.map((c) => sql`${c}::uuid`), sql`, `)})`;
  const grouped = await rootDb.execute(sql`
    SELECT status::text AS status, attention_reason, (first_provider_attempt_at IS NOT NULL) AS stamped, count(*)::int AS n
    FROM booking_email_outbox WHERE organisation_id = ${p.organisationId}::uuid ${centreFilter}
    GROUP BY 1, 2, 3`);
  const counts: TenantDiagnostics['counts'] = {
    backlog: 0, retryScheduled: 0, retryScheduledStamped: 0, processing: 0, held: 0, heldParentBinned: 0,
    heldBookingPending: 0, failedPermanent: 0, skippedPastSession: 0, accepted: 0,
  };
  const attentionByReason: Record<string, number> = {};
  for (const r of grouped as unknown as { status: string; attention_reason: string | null; stamped: boolean; n: number }[]) {
    switch (r.status) {
      case 'PENDING': counts.backlog += r.n; break;
      case 'RETRY_SCHEDULED': counts.retryScheduled += r.n; if (r.stamped) counts.retryScheduledStamped += r.n; break;
      case 'PROCESSING': counts.processing += r.n; break;
      case 'HELD_PROVIDER_OPERATIONAL': counts.held += r.n; break;
      case 'HELD_PARENT_BINNED': counts.heldParentBinned += r.n; break;
      case 'HELD_BOOKING_PENDING': counts.heldBookingPending += r.n; break;
      case 'FAILED_PERMANENT': counts.failedPermanent += r.n; break;
      case 'SKIPPED_PAST_SESSION': counts.skippedPastSession += r.n; break;
      case 'ACCEPTED': counts.accepted += r.n; break;
      case 'ATTENTION': attentionByReason[r.attention_reason ?? 'UNSPECIFIED'] = (attentionByReason[r.attention_reason ?? 'UNSPECIFIED'] ?? 0) + r.n; break;
      default: break;
    }
  }
  const out: TenantDiagnostics = { scope: 'TENANT', counts, attentionByReason };
  if (p.includeIdentifiers) {
    const ids = await rootDb.execute(sql`
      SELECT id, booking_id, status::text AS status, attention_reason, created_at, attempt_count
      FROM booking_email_outbox
      WHERE organisation_id = ${p.organisationId}::uuid ${centreFilter}
        AND status IN ('ATTENTION','FAILED_PERMANENT','HELD_PROVIDER_OPERATIONAL','RETRY_SCHEDULED','PROCESSING')
      ORDER BY created_at DESC LIMIT 100`);
    out.identifiers = (ids as unknown as { id: string; booking_id: string | null; status: string; attention_reason: string | null; created_at: Date; attempt_count: number }[]).map((r) => ({
      outboxId: r.id, bookingId: r.booking_id, status: r.status, attentionReason: r.attention_reason, createdAt: r.created_at, attemptCount: r.attempt_count,
    }));
  }
  return out;
}

export interface PlatformDiagnostics {
  scope: 'PLATFORM';
  breaker: {
    state: string;
    reason: string | null;
    errorName: string | null;
    openedAt: Date | null;
    nextProbeAt: Date | null;
    consecutiveFailures: number;
    /** 8-hex fingerprint prefix; never key material. */
    fingerprintPrefix: string | null;
  };
  heldCount: number;
  oldestHeldAgeSeconds: number | null;
  attentionByReason: Record<string, number>;
  /** Per communication type and error name (counts only, no PII). */
  heldByTypeAndError: { communicationType: string; errorName: string | null; count: number }[];
  /** At most 100 non-PII identifiers per ATTENTION and HELD bucket. */
  attentionIdentifiers: DiagnosticIdentifier[];
  heldIdentifiers: DiagnosticIdentifier[];
}

/** Platform scope: callable ONLY after resolveDiagnosticsScope returned PLATFORM. Cross-organisation, PII-free. */
export async function getPlatformDiagnostics(rootDb: RootDb): Promise<PlatformDiagnostics> {
  const breakerRows = await rootDb.execute(sql`SELECT state, reason, error_name, opened_at, next_probe_at, consecutive_failures, left(config_fingerprint, 8) AS fp FROM booking_email_provider_state WHERE id = 1`);
  const b = breakerRows[0] as unknown as { state: string; reason: string | null; error_name: string | null; opened_at: Date | null; next_probe_at: Date | null; consecutive_failures: number; fp: string | null };
  const held = await rootDb.execute(sql`SELECT count(*)::int AS n, extract(epoch FROM (now() - min(created_at)))::float8 AS oldest FROM booking_email_outbox WHERE status = 'HELD_PROVIDER_OPERATIONAL'`);
  const h = held[0] as unknown as { n: number; oldest: number | null };
  const att = await rootDb.execute(sql`SELECT attention_reason, count(*)::int AS n FROM booking_email_outbox WHERE status = 'ATTENTION' GROUP BY 1`);
  const attentionByReason: Record<string, number> = {};
  for (const r of att as unknown as { attention_reason: string | null; n: number }[]) attentionByReason[r.attention_reason ?? 'UNSPECIFIED'] = r.n;
  const byType = await rootDb.execute(sql`SELECT communication_type, provider_hold_error_name AS error_name, count(*)::int AS n FROM booking_email_outbox WHERE status = 'HELD_PROVIDER_OPERATIONAL' GROUP BY 1, 2`);
  const idRows = async (status: string) =>
    (
      (await rootDb.execute(sql`SELECT id, booking_id, status::text AS status, attention_reason, created_at, attempt_count FROM booking_email_outbox WHERE status = ${status}::booking_email_outbox_status ORDER BY created_at DESC LIMIT 100`)) as unknown as {
        id: string; booking_id: string | null; status: string; attention_reason: string | null; created_at: Date; attempt_count: number;
      }[]
    ).map((r) => ({ outboxId: r.id, bookingId: r.booking_id, status: r.status, attentionReason: r.attention_reason, createdAt: r.created_at, attemptCount: r.attempt_count }));
  return {
    scope: 'PLATFORM',
    breaker: {
      state: b.state, reason: b.reason, errorName: b.error_name, openedAt: b.opened_at, nextProbeAt: b.next_probe_at,
      consecutiveFailures: b.consecutive_failures, fingerprintPrefix: b.fp,
    },
    heldCount: h.n,
    oldestHeldAgeSeconds: h.oldest,
    attentionByReason,
    heldByTypeAndError: (byType as unknown as { communication_type: string; error_name: string | null; n: number }[]).map((r) => ({ communicationType: r.communication_type, errorName: r.error_name, count: r.n })),
    attentionIdentifiers: await idRows('ATTENTION'),
    heldIdentifiers: await idRows('HELD_PROVIDER_OPERATIONAL'),
  };
}

// ============================================================================
// (5) HARD-DELETE TRIGGER SUPPORT (the trigger itself is migration-owned, drizzle/0031)
// ============================================================================
export const HARD_DELETE_TRIGGER_NAME = 'trg_scrub_outbox_on_booking_delete';
export const HARD_DELETE_TRIGGER_FUNCTION = 'trg_fn_scrub_outbox_on_booking_delete';
export const REDACTED_RECIPIENT = '[REDACTED_DELETED]';
/** Active statuses become SKIPPED_ORPHANED on hard delete; every status loses payload and recipient. Drift-tested against the 16 enum values. */
export function hardDeleteStatusLists(): { active: readonly string[]; terminal: readonly string[] } {
  return { active: ACTIVE_OUTBOX_STATUSES, terminal: TERMINAL_OUTBOX_STATUSES };
}

/** Read-only check used by tests and the admin tooling: no payload-bearing or un-redacted row remains for a deleted booking set. */
export async function countUnscrubbedForDeletedBookings(rootDb: RootDb, outboxIds: string[]): Promise<number> {
  if (outboxIds.length === 0) return 0;
  const rows = await rootDb.execute(sql`
    SELECT count(*)::int AS n FROM booking_email_outbox
    WHERE id IN (${sql.join(outboxIds.map((i) => sql`${i}::uuid`), sql`, `)}) AND booking_id IS NULL
      AND (payload IS NOT NULL OR recipient_email <> ${REDACTED_RECIPIENT})`);
  return (rows[0] as unknown as { n: number }).n;
}
