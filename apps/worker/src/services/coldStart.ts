/**
 * services/coldStart — single source of truth for the COLD_START_MODE flag.
 *
 * Cold-start mode ships dramatically lower cadence + content-calendar-driven
 * IG slot pinning + reduced story cap. Every consumer reads the flag through
 * `isColdStartMode()` so:
 *   • Tests can mock it by mutating `process.env.COLD_START_MODE`.
 *   • A single grep finds every behavioural branch.
 *
 * When the flag is unset OR the value is anything other than "true", the
 * pipeline behaves byte-identically to the pre-cold-start codebase.
 */

let bootLogged = false;

/** Read the flag at call time so tests can flip it between cases. */
export function isColdStartMode(): boolean {
  return process.env.COLD_START_MODE === "true";
}

/**
 * Logs `coldStartModeActive` exactly once per worker process, on the first
 * call. Safe to call from every scheduler entry point — subsequent calls are
 * no-ops. Intentionally writes to stdout so the log lands in Cloud Run logs.
 */
export function logColdStartBootOnce(): void {
  if (bootLogged) return;
  bootLogged = true;
  if (isColdStartMode()) {
    console.log(
      JSON.stringify({ event: "coldStartModeActive", at: new Date().toISOString() }),
    );
  }
}

/** Test-only helper: reset the boot-log latch between test cases. */
export function _resetColdStartBootLogForTest(): void {
  bootLogged = false;
}
