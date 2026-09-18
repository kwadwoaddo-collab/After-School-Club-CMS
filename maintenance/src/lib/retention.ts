import fs from 'fs';
import path from 'path';
import { Cadence } from '../types';

interface RetentionDays {
  weekly: number;
  monthly: number;
  quarterly: number;
}

const DEFAULT_RETENTION_DAYS: RetentionDays = {
  weekly: 90,
  monthly: 365,
  quarterly: 730
};

export function enforceReportRetention(
  reportsBaseDir = path.resolve(process.cwd(), 'maintenance/reports'),
  retentionDays: RetentionDays = DEFAULT_RETENTION_DAYS,
  dryRun = false
): { deletedFiles: string[]; retainedFiles: string[] } {
  const deletedFiles: string[] = [];
  const retainedFiles: string[] = [];
  const now = Date.now();

  const cadences: Cadence[] = ['weekly', 'monthly', 'quarterly'];

  for (const cadence of cadences) {
    const dir = path.join(reportsBaseDir, cadence);
    if (!fs.existsSync(dir)) continue;

    const maxAgeMs = (retentionDays[cadence] || 90) * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      if (file === '.gitkeep') continue;
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        const ageMs = now - stats.mtimeMs;
        if (ageMs > maxAgeMs) {
          deletedFiles.push(fullPath);
          if (!dryRun) {
            fs.unlinkSync(fullPath);
          }
        } else {
          retainedFiles.push(fullPath);
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return { deletedFiles, retainedFiles };
}
