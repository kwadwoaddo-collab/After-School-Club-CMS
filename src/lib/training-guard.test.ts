import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertSafeTrainingEnvironment, KNOWN_PRODUCTION_DB_HOST } from './training-guard';

describe('Training Guard Safety Verification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.ALLOW_TRAINING_SEED = 'true';

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/DATABASE_URL is not set/);
  });

  it('throws and fails closed when host matches the known production database', () => {
    process.env.DATABASE_URL = `postgres://user:pass@${KNOWN_PRODUCTION_DB_HOST}/neondb?sslmode=require`;
    process.env.ALLOW_TRAINING_SEED = 'true';

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/matches the KNOWN PRODUCTION DATABASE/);
  });

  it('throws and fails closed when host contains ep-super-dawn', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@ep-super-dawn-123.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    process.env.ALLOW_TRAINING_SEED = 'true';

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/matches the KNOWN PRODUCTION DATABASE/);
  });

  it('throws and fails closed when ALLOW_TRAINING_SEED is missing', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    delete process.env.ALLOW_TRAINING_SEED;

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/Explicit acknowledgement required/);
  });

  it('throws and fails closed when ALLOW_TRAINING_SEED is not "true"', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    process.env.ALLOW_TRAINING_SEED = 'false';

    expect(() => assertSafeTrainingEnvironment()).toThrowError(/Explicit acknowledgement required/);
  });

  it('succeeds when target is an isolated non-production host and ALLOW_TRAINING_SEED is "true"', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    process.env.ALLOW_TRAINING_SEED = 'true';

    const result = assertSafeTrainingEnvironment();
    expect(result.host).toBe('ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech');
    expect(result.database).toBe('/neondb');
  });
});
