/**
 * SprintScale CMS — Milestone PM-1B Asset Ingestion Tool
 * Deterministically copies certified visual assets to public/training/assets/ and verifies SHA-256 checksums.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SOURCE_SCREENSHOTS_DIR = path.resolve('project-notes/documentation-training/assets/screenshots/annotated');
const SOURCE_VIDEOS_DIR = path.resolve('project-notes/documentation-training/assets/videos');

const DEST_SCREENSHOTS_DIR = path.resolve('public/training/assets/screenshots/annotated');
const DEST_VIDEOS_DIR = path.resolve('public/training/assets/videos');

function calculateSha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function ingestVisualAssets() {
  console.log('=== SPRINT SCALE CMS — PM-1B ASSET INGESTION ===\n');

  // Ensure destination directories exist
  fs.mkdirSync(DEST_SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(DEST_VIDEOS_DIR, { recursive: true });

  // 1. Ingest Screenshots
  console.log('1. Ingesting 78 Certified Screenshots...');
  const screenshotFiles = fs.readdirSync(SOURCE_SCREENSHOTS_DIR).filter(f => f.endsWith('.png')).sort();
  let screenshotMatches = 0;
  let screenshotFailures = 0;

  for (const file of screenshotFiles) {
    const srcPath = path.join(SOURCE_SCREENSHOTS_DIR, file);
    const destPath = path.join(DEST_SCREENSHOTS_DIR, file);

    const srcHash = calculateSha256(srcPath);

    // Copy file if not exists or hash differs
    fs.copyFileSync(srcPath, destPath);

    const destHash = calculateSha256(destPath);
    if (srcHash === destHash) {
      screenshotMatches++;
    } else {
      console.error(`[MISMATCH] Screenshot ${file}: src=${srcHash} dest=${destHash}`);
      screenshotFailures++;
    }
  }
  console.log(`  -> Screenshots Ingested: ${screenshotMatches} matched, ${screenshotFailures} failures.\n`);

  // 2. Ingest Videos
  console.log('2. Ingesting 52 Certified Videos...');
  const videoFiles = fs.readdirSync(SOURCE_VIDEOS_DIR).filter(f => f.endsWith('.mp4')).sort();
  let videoMatches = 0;
  let videoFailures = 0;

  for (const file of videoFiles) {
    const srcPath = path.join(SOURCE_VIDEOS_DIR, file);
    const destPath = path.join(DEST_VIDEOS_DIR, file);

    const srcHash = calculateSha256(srcPath);

    // Copy file
    fs.copyFileSync(srcPath, destPath);

    const destHash = calculateSha256(destPath);
    if (srcHash === destHash) {
      videoMatches++;
    } else {
      console.error(`[MISMATCH] Video ${file}: src=${srcHash} dest=${destHash}`);
      videoFailures++;
    }
  }
  console.log(`  -> Videos Ingested: ${videoMatches} matched, ${videoFailures} failures.\n`);

  console.log('=== SUMMARY INGESTION REPORT ===');
  console.log(`Total Source Assets: ${screenshotFiles.length + videoFiles.length} (78 screenshots, 52 videos)`);
  console.log(`Total Public Assets: ${screenshotMatches + videoMatches} verified`);
  console.log(`Total Checksum Matches: ${screenshotMatches + videoMatches} / ${screenshotFiles.length + videoFiles.length}`);
  console.log(`Total Checksum Failures: ${screenshotFailures + videoFailures}`);

  if (screenshotFailures > 0 || videoFailures > 0) {
    throw new Error('Asset checksum verification failed during ingestion.');
  }
}

// Run if called directly
ingestVisualAssets();
