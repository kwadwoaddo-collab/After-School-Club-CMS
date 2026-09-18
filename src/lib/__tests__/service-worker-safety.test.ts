import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * MAINT-REL-1: Service Worker Safety and Manifest Reliability Tests
 *
 * Ensures that:
 * 1. Global layout unregisters legacy service workers and purges kiosk-cache-v1
 * 2. public/sw.js is a self-decommissioning worker with NO fetch-interception
 * 3. next.config.ts rewrites /manifest.json to /manifest.webmanifest
 */

describe('MAINT-REL-1: Service Worker & Manifest Safety', () => {
    const rootDir = path.resolve(__dirname, '../../../');

    it('ensures public/sw.js is self-retiring and contains no aggressive fetch caching', () => {
        const swPath = path.join(rootDir, 'public/sw.js');
        const swContent = fs.readFileSync(swPath, 'utf8');

        // Must not intercept or cache fetch requests
        expect(swContent).not.toContain("addEventListener('fetch'");
        expect(swContent).not.toContain('addEventListener("fetch"');
        expect(swContent).not.toContain('caches.open');

        // Must not reference broken /manifest.json
        expect(swContent).not.toContain('/manifest.json');

        // Must actively self-decommission
        expect(swContent).toContain('self.skipWaiting()');
        expect(swContent).toContain("caches.delete('kiosk-cache-v1')");
        expect(swContent).toContain('self.registration.unregister()');
        expect(swContent).toContain('self.clients.claim()');
    });

    it('ensures src/app/layout.tsx unregisters legacy workers rather than registering sw.js', () => {
        const layoutPath = path.join(rootDir, 'src/app/layout.tsx');
        const layoutContent = fs.readFileSync(layoutPath, 'utf8');

        // Must not register any service worker
        expect(layoutContent).not.toContain("navigator.serviceWorker.register('/sw.js')");
        expect(layoutContent).not.toContain('navigator.serviceWorker.register');

        // Must unregister all active service workers on window load
        expect(layoutContent).toContain('navigator.serviceWorker.getRegistrations()');
        expect(layoutContent).toContain('registrations[i].unregister()');

        // Must explicitly purge kiosk-cache-v1
        expect(layoutContent).toContain("caches.delete('kiosk-cache-v1')");
    });

    it('ensures next.config.ts rewrites /manifest.json to /manifest.webmanifest', () => {
        const nextConfigPath = path.join(rootDir, 'next.config.ts');
        const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');

        expect(nextConfigContent).toContain("source: '/manifest.json'");
        expect(nextConfigContent).toContain("destination: '/manifest.webmanifest'");
    });
});
