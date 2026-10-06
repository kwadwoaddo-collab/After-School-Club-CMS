/**
 * Booking email outbox: shared types, frozen constants and the state transition table.
 * CMS-OPS-REMEDIATION-1C V15. NO LOGIC lives here. Dependency direction (acyclic):
 * types -> classifier -> breaker -> claim -> dispatch -> maintenance -> email-outbox (public API).
 *
 * All timing constants are UNMEASURED proposals and FROZEN for the initial implementation (E5 item 3e):
 * implementation measures them and may NOT change them; a proposed change stops for a human decision.
 */

// ==================== FROZEN TIMING / BUDGET CONSTANTS (E5) ====================
export const STAMP_LOCK_TIMEOUT_MS = 500;
export const STAMP_STATEMENT_TIMEOUT_MS = 2000;
export const ACTION_STAMP_MIN_REMAINING_MS = 4500;
export const POST_STAMP_MIN_TIMEOUT_MS = 1000;
export const ROUTE_ORIGIN_MARGIN_MS = 2000;
export const ACTION_BUDGET_MARGIN_MS = 1500;
export const ROUTE_STAMP_MIN_REMAINING_MS = 7000;
export const ROUTE_MIN_PROVIDER_TIMEOUT_MS = 5000;
export const ACTION_MIN_PROVIDER_TIMEOUT_MS = 3000;
export const ROUTE_BUDGET_MS = 55000;
export const ACTION_BUDGET_MS = 8000;
export const PROVIDER_MAX_TIMEOUT_MS = 30000;
export const ACTION_MAINTENANCE_MIN_LEFTOVER_MS = 2500;
export const ACTION_MAINTENANCE_MAX_ROWS = 10;

// ==================== LEASE, WINDOWS, LADDER (E3/E5) ====================
export const CLAIM_LEASE_MS = 5 * 60 * 1000;
export const MIN_RETRY_GAP_MS = 5 * 60 * 1000;
/** Known post-stamp no-call finalisation: next_attempt_at = now() + this (E5 item 3c). */
export const KNOWN_NO_CALL_RETRY_DELAY_MS = 5 * 60 * 1000;
export const LATEST_START_HOURS = 22;
export const BACKSTOP_HOURS = 23;
export const DELIVERY_CEILING_HOURS = 72;
export const BINNED_HOLD_HOURS = 24;
export const IDEMPOTENCY_WINDOW_HOURS = 24;
export const MAX_LADDER_ATTEMPTS = 7;
/** Offsets from first_provider_attempt_at for retries 1..6 (index = attempt_count - 1). */
export const UNKNOWN_LADDER_OFFSETS_MS: readonly number[] = [
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  20 * 60 * 60 * 1000,
];
export const STAMP_LINK_GUARD_MINUTES = 23 * 60 + 5;

// ==================== BREAKER / PACING (E3) ====================
export const PROVIDER_STATE_ID = 1;
export const PACING_WINDOW_SECONDS = 1;
export const PACING_MAX_STAMPS_PER_WINDOW = 2;
export const PACING_RAMP_MAX_STAMPS_PER_WINDOW = 1;
export const PACING_WAIT_MAX_MS = 1100;
export const PACING_RELEASE_DELAY_SECONDS = 5;
export const LOCK_RELEASE_DELAY_SECONDS = 5;
export const RAMP_AFTER_CLOSE_MS = 10 * 60 * 1000;
export const BULK_RELEASE_MAX_ROWS = 25;
export const BULK_RELEASE_COOLDOWN_SECONDS = 60;
export const MAINTENANCE_MAX_ROWS = 50;
export const PROVIDER_UNAVAILABLE_MIN_ROWS = 2;
export const PROVIDER_UNAVAILABLE_MIN_RECIPIENTS = 2;
export const PROVIDER_UNAVAILABLE_WINDOW_MS = 15 * 60 * 1000;
export const PROBE_SCHEDULE_MS: readonly number[] = [
  2 * 60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
];
export const HALF_OPEN_TIMEOUT_MS = 10 * 60 * 1000;
export const CODE_CONTRACT_ESCALATION_MIN_RECIPIENTS = 3;
export const CODE_CONTRACT_ESCALATION_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_DEFAULT_RETRY_AFTER_S = 60;
export const RATE_LIMIT_MAX_RETRY_AFTER_S = 300;
export const RATE_LIMIT_ESCALATION_WINDOW_MS = 5 * 60 * 1000;
export const RATE_LIMIT_ESCALATION_HOLD_HITS = 3;
export const CODE_CONTRACT_RETRY_DELAYS_MS: readonly number[] = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
];
export const FINALISATION_RETRY_DELAY_MS = 100;

// ==================== STATUS / ENUM UNIONS (E2) ====================
export const OUTBOX_STATUSES = [
  'PENDING', 'PROCESSING', 'RETRY_SCHEDULED', 'ACCEPTED', 'ATTENTION', 'FAILED_PERMANENT', 'SUPERSEDED',
  'HELD_PARENT_BINNED', 'HELD_BOOKING_PENDING', 'HELD_PROVIDER_OPERATIONAL',
  'SKIPPED_BINNED_EXPIRED', 'SKIPPED_PENDING_EXPIRED', 'SKIPPED_PAST_SESSION', 'SKIPPED_CANCELLED',
  'SKIPPED_ORPHANED', 'SKIPPED_ROLLBACK',
] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/** Active (hard-delete trigger scrubs to SKIPPED_ORPHANED). Active UNION terminal EQUALS the 16 values. */
export const ACTIVE_OUTBOX_STATUSES = [
  'PENDING', 'PROCESSING', 'RETRY_SCHEDULED', 'HELD_PARENT_BINNED', 'HELD_BOOKING_PENDING', 'HELD_PROVIDER_OPERATIONAL',
] as const satisfies readonly OutboxStatus[];
export const TERMINAL_OUTBOX_STATUSES = [
  'ACCEPTED', 'ATTENTION', 'FAILED_PERMANENT', 'SUPERSEDED',
  'SKIPPED_BINNED_EXPIRED', 'SKIPPED_PENDING_EXPIRED', 'SKIPPED_PAST_SESSION', 'SKIPPED_CANCELLED',
  'SKIPPED_ORPHANED', 'SKIPPED_ROLLBACK',
] as const satisfies readonly OutboxStatus[];

export const COMMUNICATION_TYPES = ['BOOKING_CONFIRMATION', 'BOOKING_RESCHEDULE', 'BOOKING_CANCELLED'] as const;
export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];

export const LINK_MODES = ['WITH_LINK', 'LINK_FREE', 'PORTAL_URL'] as const;
export type LinkMode = (typeof LINK_MODES)[number];

export const PROVIDER_HOLD_REASONS = ['CONFIG', 'QUOTA_DAILY', 'QUOTA_MONTHLY', 'RATE_LIMIT', 'CODE_CONTRACT'] as const;
export type ProviderHoldReason = (typeof PROVIDER_HOLD_REASONS)[number];
export type ProviderHoldScope = 'ROW' | 'GLOBAL';

export const ATTENTION_REASONS = [
  'UNKNOWN_OUTCOME_EXHAUSTED', 'WINDOW_23H', 'IDEMPOTENCY_MISMATCH', 'PROVIDER_HOLD_EXPIRED',
  'DELIVERY_WINDOW_72H', 'LINK_INVALID_AFTER_FREEZE', 'MISSING_PAYLOAD', 'ROLLBACK_PROCESSING_STAMPED',
  'IDEMPOTENCY_KEY_INVALID', 'PROVIDER_CONTRACT_ERROR',
] as const;
export type AttentionReason = (typeof ATTENTION_REASONS)[number];

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export const BREAKER_REASONS = ['CONFIG', 'QUOTA_DAILY', 'QUOTA_MONTHLY', 'RATE_LIMIT', 'PROVIDER_UNAVAILABLE'] as const;
export type BreakerReason = (typeof BREAKER_REASONS)[number];

/** Where a dispatch invocation originated (budget, margin and log origin). */
export type DispatchOrigin = 'route' | 'action' | 'cron';

// ==================== TRANSITION TABLE (E2, every edge) ====================
const SKIPPED_ANY: readonly OutboxStatus[] = [
  'SKIPPED_BINNED_EXPIRED', 'SKIPPED_PENDING_EXPIRED', 'SKIPPED_PAST_SESSION', 'SKIPPED_CANCELLED',
];
export const OUTBOX_TRANSITIONS: Readonly<Record<OutboxStatus, readonly OutboxStatus[]>> = {
  PENDING: [
    'PROCESSING', 'SUPERSEDED', 'SKIPPED_ORPHANED', 'SKIPPED_CANCELLED', 'SKIPPED_PAST_SESSION',
    'HELD_PARENT_BINNED', 'HELD_BOOKING_PENDING', 'ATTENTION', 'FAILED_PERMANENT',
  ],
  PROCESSING: [
    'ACCEPTED', 'RETRY_SCHEDULED', 'HELD_PROVIDER_OPERATIONAL', 'FAILED_PERMANENT', 'ATTENTION', 'PENDING',
    'SUPERSEDED', ...SKIPPED_ANY, 'SKIPPED_ORPHANED', 'HELD_PARENT_BINNED', 'HELD_BOOKING_PENDING',
  ],
  RETRY_SCHEDULED: ['PROCESSING', 'PENDING', 'SUPERSEDED', ...SKIPPED_ANY, 'ATTENTION', 'SKIPPED_ORPHANED'],
  HELD_PROVIDER_OPERATIONAL: [
    'PENDING', 'ATTENTION', 'SUPERSEDED', ...SKIPPED_ANY, 'SKIPPED_ORPHANED', 'SKIPPED_ROLLBACK',
  ],
  HELD_PARENT_BINNED: [
    'PENDING', 'ATTENTION', 'SKIPPED_BINNED_EXPIRED', 'SUPERSEDED', ...SKIPPED_ANY, 'SKIPPED_ORPHANED',
  ],
  HELD_BOOKING_PENDING: [
    'PENDING', 'ATTENTION', 'SKIPPED_PENDING_EXPIRED', 'SKIPPED_CANCELLED', 'SUPERSEDED', 'SKIPPED_PAST_SESSION',
    'SKIPPED_ORPHANED',
  ],
  ACCEPTED: [],
  ATTENTION: [],
  FAILED_PERMANENT: [],
  SUPERSEDED: [],
  SKIPPED_BINNED_EXPIRED: [],
  SKIPPED_PENDING_EXPIRED: [],
  SKIPPED_PAST_SESSION: [],
  SKIPPED_CANCELLED: [],
  SKIPPED_ORPHANED: [],
  SKIPPED_ROLLBACK: [],
};

// ==================== PAYLOAD CONTRACTS (derived from EmailService signatures) ====================
/** Payload format version; a later format change must be detectable. Dates are ISO-8601 strings. */
export const OUTBOX_PAYLOAD_VERSION = 1;

export interface OutboxPayloadBase {
  payloadVersion: number;
  parentFirstName: string;
  parentEmail: string;
  confirmationCode: string;
}
export interface BookingConfirmationPayload extends OutboxPayloadBase {
  children: { firstName: string; lastName: string; subjects: string[] }[];
  centreName?: string;
  centreAddress?: string;
  modality: 'in_person' | 'online';
  startAt: string;
  duration: number;
  /** Raw magic link; removed when frozen LINK_FREE or when the token expires (E4 rung 5a). */
  magicLink?: string;
  /** Optional replacement context (public replacement path, E6 A); renders without dropping access fields. */
  replacement?: { oldStartAt: string; supersededUnsentConfirmation: boolean };
}
export interface BookingReschedulePayload extends OutboxPayloadBase {
  childrenNames: string[];
  oldStartAt: string;
  newStartAt: string;
  centreName?: string;
  /** True only when an unsent confirmation was superseded (E6 B; plan 22). */
  includePortalLoginGuidance?: boolean;
}
export interface BookingCancelledPayload extends OutboxPayloadBase {
  childrenNames: string[];
  startAt: string;
}
export type OutboxPayload = BookingConfirmationPayload | BookingReschedulePayload | BookingCancelledPayload;

// ==================== SHARED ROW / RESULT SHAPES ====================
/** Fields returned by the stamp statement RETURNING clause (E5 item 4). */
export interface StampResult {
  id: string;
  idempotencyEpoch: number;
  firstProviderAttemptAt: Date;
  isProbe: boolean;
  attemptCount: number;
}

/** Why a stamp attempt produced no stamp (zero rows, 55P03 or 57014). */
export type StampRefusal =
  | 'ZERO_ROWS'
  | 'LOCK_TIMEOUT_55P03'
  | 'STATEMENT_TIMEOUT_57014';

/** Result of the post-stamp budget recomputation (point D). */
export type PostStampDecision =
  | { kind: 'CALL'; timeoutMs: number }
  | { kind: 'NO_CALL'; candidateTimeoutMs: number };

/** Result of the fenced known post-stamp no-call finalisation (E5 item 3c). */
export type NoCallFinalisation =
  | { kind: 'FINALISED'; status: 'RETRY_SCHEDULED' | 'SUPERSEDED' }
  | { kind: 'FENCE_LOST' }
  | { kind: 'ERROR'; errorName: string };

/** Claimed row handle passed from the claim module to dispatch. */
export interface ClaimedOutboxRow {
  id: string;
  claimToken: string;
  bookingId: string | null;
}

/** PII-free structured release-reason log event (E5 item 3d): reason and origin only. */
export type ReleaseLogReason =
  | 'LOCK_TIMEOUT_55P03'
  | 'STATEMENT_TIMEOUT_57014'
  | 'PACING_WAIT'
  | 'PACING_RELEASE'
  | 'INSUFFICIENT_PRE_STAMP_BUDGET'
  | 'KNOWN_POST_STAMP_NO_CALL';
export interface ReleaseLogEvent {
  event: 'email_outbox_release';
  reason: ReleaseLogReason;
  origin: DispatchOrigin;
  /** Only for KNOWN_POST_STAMP_NO_CALL: the attempt index (attempt_count at post-stamp value). */
  attemptIndex?: number;
}
