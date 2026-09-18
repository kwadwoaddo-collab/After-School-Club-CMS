import fs from 'fs';
import path from 'path';

export interface LockData {
  pid: number;
  timestamp: string;
  cadence: string;
}

const DEFAULT_LOCK_PATH = path.resolve(process.cwd(), 'maintenance/state/maintenance.lock');
const STALE_LOCK_MS = 60 * 60 * 1000; // 1 hour

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    // ESRCH means process does not exist. EPERM means exists but no permission to signal.
    const nodeErr = err as NodeJS.ErrnoException;
    return nodeErr.code === 'EPERM';
  }
}

export function acquireLock(cadence: string, lockPath = DEFAULT_LOCK_PATH): boolean {
  const dir = path.dirname(lockPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(lockPath)) {
    try {
      const content = fs.readFileSync(lockPath, 'utf8');
      const data: LockData = JSON.parse(content);
      const lockAge = Date.now() - new Date(data.timestamp).getTime();

      const alive = isProcessAlive(data.pid);
      if (alive && lockAge < STALE_LOCK_MS) {
        // Active lock held by living process
        return false;
      }
      // Lock is stale: process is dead or lock is older than 1 hour
      fs.unlinkSync(lockPath);
    } catch {
      // Corrupt or unreadable lock file, safe to remove
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // ignore
      }
    }
  }

  const payload: LockData = {
    pid: process.pid,
    timestamp: new Date().toISOString(),
    cadence
  };

  try {
    // Write with exclusive flag 'wx' to prevent race condition
    fs.writeFileSync(lockPath, JSON.stringify(payload, null, 2), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

export function releaseLock(lockPath = DEFAULT_LOCK_PATH): void {
  try {
    if (fs.existsSync(lockPath)) {
      const content = fs.readFileSync(lockPath, 'utf8');
      const data: LockData = JSON.parse(content);
      // Only delete if held by this current PID
      if (data.pid === process.pid) {
        fs.unlinkSync(lockPath);
      }
    }
  } catch {
    // Ignore errors during release
  }
}
