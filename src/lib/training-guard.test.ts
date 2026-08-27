import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  assertSafeTrainingEnvironment,
  APPROVED_TRAINING_DB_HOST,
  KNOWN_PRODUCTION_DB_HOST,
  REQUIRED_TRAINING_ENVIRONMENT,
} from './training-guard';

describe('Training Guard Safety Allowlist & Guardrails', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('1. succeeds when target is approved training host with correct flags', () => {
    process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/neondb?sslmode=require`;
    process.env.ALLOW_TRAINING_SEED = 'true';
    process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

    const result = assertSafeTrainingEnvironment();
    expect(result.host).toBe(APPROVED_TRAINING_DB_HOST);
    expect(result.database).toBe('/neondb');
  });

  it('2. throws and fails closed when host matches known production database', () => {
    process.env.DATABASE_URL = `postgres://user:pass@${KNOWN_PRODUCTION_DB_HOST}/neondb?sslmode=require`;
    process.env.ALLOW_TRAINING_SEED = 'true';
    process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/KNOWN PRODUCTION DATABASE/);
  });

  it('3. throws and fails closed when host is an unapproved/unknown Neon host', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@ep-random-host-12345.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    process.env.ALLOW_TRAINING_SEED = 'true';
    process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/NOT on the approved training host allowlist/);
  });

  it('4. throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.ALLOW_TRAINING_SEED = 'true';
    process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/DATABASE_URL is not set/);
  });

  it('5. throws when DATABASE_URL is malformed', () => {
    process.env.DATABASE_URL = 'not-a-valid-url';
    process.env.ALLOW_TRAINING_SEED = 'true';
    process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/Invalid DATABASE_URL format/);
  });

  it('6. throws and fails closed when ALLOW_TRAINING_SEED is missing', () => {
    process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/neondb?sslmode=require`;
    delete process.env.ALLOW_TRAINING_SEED;
    process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/Explicit acknowledgement required/);
  });

  it('7. throws and fails closed when ALLOW_TRAINING_SEED is not "true"', () => {
    process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/neondb?sslmode=require`;
    process.env.ALLOW_TRAINING_SEED = 'false';
    process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/Explicit acknowledgement required/);
  });

  it('8. throws and fails closed when TRAINING_ENVIRONMENT marker is missing or wrong', () => {
    process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/neondb?sslmode=require`;
    process.env.ALLOW_TRAINING_SEED = 'true';
    delete process.env.TRAINING_ENVIRONMENT;

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/Invalid or missing TRAINING_ENVIRONMENT marker/);

    process.env.TRAINING_ENVIRONMENT = 'production';
    expect(() => assertSafeTrainingEnvironment()).toThrowError(/Invalid or missing TRAINING_ENVIRONMENT marker/);
  });
});
