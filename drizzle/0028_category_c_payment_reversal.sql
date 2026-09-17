-- Category C — Finance Correction: Payment Reversal
-- Migration: 0028_category_c_payment_reversal
--
-- Adds support for the payment reversal correction model.
-- A verified payment may be reversed by an authorised user.
-- Reversal mutates the original payment row's status to 'reversed'
-- and records when and why the reversal occurred.
-- All other payment fields (id, amount, method, transactionReference,
-- recordedAt, invoiceId) are preserved for audit purposes.
--
-- Additive / backward compatible:
-- Existing payment rows are NOT affected (new columns default to NULL).
-- No data backfill is required.

-- 1. Add 'reversed' to the payment_status enum.
--    ALTER TYPE ... ADD VALUE is safe in PostgreSQL — it does not lock
--    tables, does not rewrite data, and does not require a transaction.
ALTER TYPE "public"."payment_status" ADD VALUE 'reversed';

-- 2. Add reversal_reason column (required at app layer, max 500 chars).
ALTER TABLE "payments" ADD COLUMN "reversal_reason" text;

-- 3. Add reversed_at column (set server-side to NOW() by reversePayment()).
ALTER TABLE "payments" ADD COLUMN "reversed_at" timestamp with time zone;
