import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { assertSafeTrainingEnvironment } from '@/lib/training-guard';
import { logger } from '@/lib/logger';
import { seedTrainingData } from './seed-training-data';

export async function resetTrainingData() {
  const { host } = assertSafeTrainingEnvironment();
  logger.info(`[TRAINING RESET] Executing safe reset on host: ${host}`);

  const res = await seedTrainingData();
  logger.info('✅ [TRAINING RESET COMPLETED]');
  return res;
}

if (require.main === module) {
  resetTrainingData()
    .then((res) => {
      logger.info('Reset Result:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Error during training reset:', err);
      process.exit(1);
    });
}
