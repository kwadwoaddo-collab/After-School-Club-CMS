import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Isolated, fully mocked UI checks: deliberately no dotenv or database setup.
export default defineConfig({
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    test: { environment: 'node', include: ['src/ui-clarity-tests/*.test.tsx'] },
});
