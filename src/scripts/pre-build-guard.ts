import { logger } from '@/lib/logger';
import { readdirSync, lstatSync } from 'fs';
import { join } from 'path';

/**
 * Pre-build security check to ensure no "copy" duplicates exist
 * that could crash the Next.js App Router or create 404s.
 */
function checkDir(dir: string) {
    const files = readdirSync(dir);

    for (const file of files) {
        const fullPath = join(dir, file);
        const stat = lstatSync(fullPath);

        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.next' || file === '.git') continue;
            checkDir(fullPath);
        } else {
            // Pattern for common "Copy 2", "route 2", etc.
            if (file.match(/.*\s\d\..*/)) {
                logger.error(`\x1b[31m[STABILITY ERROR]\x1b[0m Duplicate file detected: ${fullPath}`);
                logger.error(`Next.js build will hang or 404 if this is not removed.`);
                process.exit(1);
            }
        }
    }
}

logger.info('--- Stability Guard: Checking for duplicate files ---');
try {
    checkDir(process.cwd());
    logger.info('\x1b[32m[SAFE]\x1b[0m No duplicates found. Proceeding to build...');
} catch (err) {
    logger.error('Error during pre-build check:', err);
    process.exit(1);
}
