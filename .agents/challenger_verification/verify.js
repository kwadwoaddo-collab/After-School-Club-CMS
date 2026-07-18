const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const logFile = path.join(__dirname, 'verify.log');
const log = (msg) => {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
};

fs.writeFileSync(logFile, '--- Starting Verification Runs ---\n');
log('Timestamp: ' + new Date().toISOString());

// 1. Run tsc --noEmit
log('\n=== Running TypeScript check (tsc --noEmit) ===');
const tscRes = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], {
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'test' }
});
fs.writeFileSync(path.join(__dirname, 'tsc_output.log'), tscRes.stdout + tscRes.stderr);
log('tsc Exit Code: ' + tscRes.status);
if (tscRes.status === 0) {
    log('tsc: SUCCESS');
} else {
    log('tsc: FAILED');
}

// 2. Run eslint
log('\n=== Running ESLint check ===');
const eslintRes = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js'], {
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'test' }
});
fs.writeFileSync(path.join(__dirname, 'eslint_output.log'), eslintRes.stdout + eslintRes.stderr);
log('eslint Exit Code: ' + eslintRes.status);
if (eslintRes.status === 0) {
    log('eslint: SUCCESS');
} else {
    log('eslint: FAILED');
}

// 3. Run vitest
log('\n=== Running Vitest check ===');
const vitestRes = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run'], {
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'test' }
});
fs.writeFileSync(path.join(__dirname, 'vitest_output.log'), vitestRes.stdout + vitestRes.stderr);
log('vitest Exit Code: ' + vitestRes.status);
if (vitestRes.status === 0) {
    log('vitest: SUCCESS');
} else {
    log('vitest: FAILED');
}

log('\n--- Verification Runs Completed ---');
process.exit(0);
