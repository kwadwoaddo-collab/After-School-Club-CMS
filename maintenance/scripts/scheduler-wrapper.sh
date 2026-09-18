#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================================================
# CMS Automated Preventive Maintenance Framework — Scheduler Wrapper
# Designed for macOS Launchd / unattended execution on Kwadwo's Mac mini
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CMS_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_FILE="${CMS_ROOT}/maintenance/logs/scheduler.log"

mkdir -p "${CMS_ROOT}/maintenance/logs"

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*" | tee -a "${LOG_FILE}"
}

log "=== CMS Maintenance Scheduled Run Initiated ==="

# 1. macOS Environment Setup (Non-interactive Launchd environment)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# Load NVM / Node if present
if [ -s "${HOME}/.nvm/nvm.sh" ]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck source=/dev/null
  \. "${NVM_DIR}/nvm.sh"
fi

# Locate node and npx
NODE_BIN="$(command -v node || true)"
NPX_BIN="$(command -v npx || true)"

if [ -z "${NODE_BIN}" ] || [ -z "${NPX_BIN}" ]; then
  # Fallback to standard NVM path for v20.20.0 discovered on host
  if [ -d "${HOME}/.nvm/versions/node/v20.20.0/bin" ]; then
    export PATH="${HOME}/.nvm/versions/node/v20.20.0/bin:${PATH}"
    NODE_BIN="${HOME}/.nvm/versions/node/v20.20.0/bin/node"
    NPX_BIN="${HOME}/.nvm/versions/node/v20.20.0/bin/npx"
  fi
fi

if [ -z "${NPX_BIN}" ] || [ ! -x "${NPX_BIN}" ]; then
  log "CRITICAL: Node/Npx runtime not found or not executable"
  exit 3
fi

log "Host Node: ${NODE_BIN} ($(${NODE_BIN} -v 2>/dev/null || echo 'unknown'))"
log "Working Directory: ${CMS_ROOT}"

# 2. Inhibit macOS System Sleep during maintenance execution
CAFFEINATE_PID=""
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -i -s -w $$ &
  CAFFEINATE_PID=$!
  log "Activated sleep inhibitor (caffeinate PID: ${CAFFEINATE_PID})"
fi

cleanup() {
  if [ -n "${CAFFEINATE_PID}" ] && kill -0 "${CAFFEINATE_PID}" 2>/dev/null; then
    kill "${CAFFEINATE_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# 3. Execute Maintenance Runner
cd "${CMS_ROOT}"

CLI_ARGS=("$@")
if [ ${#CLI_ARGS[@]} -eq 0 ]; then
  CLI_ARGS=("--auto-cadence")
fi

log "Running: npx tsx maintenance/src/cli.ts ${CLI_ARGS[*]}"

EXIT_CODE=0
"${NPX_BIN}" tsx maintenance/src/cli.ts "${CLI_ARGS[@]}" >> "${LOG_FILE}" 2>&1 || EXIT_CODE=$?

log "=== CMS Maintenance Run Completed with Exit Code: ${EXIT_CODE} ==="

exit ${EXIT_CODE}
