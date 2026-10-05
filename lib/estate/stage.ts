/**
 * Wills Estate Lifecycle & Stage Machine
 * Source of truth: docs/SPEC.md §7.2, §7.4
 *
 * Stage is derived from elapsed time since the last heartbeat:
 *   elapsed = now - lastHeartbeat
 *   settled                  -> SETTLED
 *   elapsed < warnAfter      -> ACTIVE
 *   elapsed < windDownAfter  -> WARNING
 *   elapsed < executeAfter   -> WINDING_DOWN
 *   else                     -> EXECUTABLE
 */

export type Stage = "ACTIVE" | "WARNING" | "WINDING_DOWN" | "EXECUTABLE" | "SETTLED";

export interface StageConfig {
  /** Seconds without heartbeat before transitioning from ACTIVE to WARNING. */
  warnAfter: number;
  /** Seconds without heartbeat before transitioning from WARNING to WINDING_DOWN. */
  windDownAfter: number;
  /** Seconds without heartbeat before transitioning from WINDING_DOWN to EXECUTABLE. */
  executeAfter: number;
  /** Duration of an allowance period in seconds. */
  periodLength?: number;
  /** Maximum allowance per period in USDC atomic units (6 decimals). */
  allowancePerPeriod?: bigint;
  /** Throttle in basis points applied to allowance during WARNING (e.g. 2500 = 25%). */
  warningThrottleBps?: number;
}

export interface StageStatus {
  stage: Stage;
  elapsed: number;
  /** Unix timestamp in seconds of the next transition, or null if SETTLED/EXECUTABLE. */
  nextTransitionAt: number | null;
  /** Seconds remaining until the next transition, or null if none. */
  secondsUntilNext: number | null;
}

/** Default configuration for real-world deployment (SPEC.md §7.4). */
export const REALISTIC_STAGE_CONFIG: StageConfig = {
  warnAfter: 7 * 24 * 3600, // 7 days (604,800s)
  windDownAfter: 14 * 24 * 3600, // 14 days (1,209,600s)
  executeAfter: 30 * 24 * 3600, // 30 days (2,592,000s)
  periodLength: 24 * 3600, // 1 day
  allowancePerPeriod: 5_000_000n, // 5 USDC
  warningThrottleBps: 2500, // 25%
};

/** Default configuration for fast demo/testing simulation (SPEC.md §7.4). */
export const DEMO_STAGE_CONFIG: StageConfig = {
  warnAfter: 90, // 90 seconds
  windDownAfter: 180, // 180 seconds (3 min)
  executeAfter: 300, // 300 seconds (5 min)
  periodLength: 60, // 60 seconds
  allowancePerPeriod: 1_000_000n, // 1 USDC
  warningThrottleBps: 2500, // 25%
};

/**
 * Validate that timing parameters are non-zero and strictly ascending.
 */
export function validateStageConfig(config: StageConfig): void {
  if (config.warnAfter <= 0) {
    throw new Error(`warnAfter must be positive (received ${config.warnAfter})`);
  }
  if (config.windDownAfter <= config.warnAfter) {
    throw new Error(
      `windDownAfter (${config.windDownAfter}) must be strictly greater than warnAfter (${config.warnAfter})`
    );
  }
  if (config.executeAfter <= config.windDownAfter) {
    throw new Error(
      `executeAfter (${config.executeAfter}) must be strictly greater than windDownAfter (${config.windDownAfter})`
    );
  }
}

/**
 * Pure function to calculate stage, elapsed seconds, and next countdown from state.
 */
export function calculateStage(
  lastHeartbeat: number,
  now: number,
  config: StageConfig = DEMO_STAGE_CONFIG,
  isSettled: boolean = false
): StageStatus {
  validateStageConfig(config);

  if (isSettled) {
    return {
      stage: "SETTLED",
      elapsed: Math.max(0, now - lastHeartbeat),
      nextTransitionAt: null,
      secondsUntilNext: null,
    };
  }

  const elapsed = Math.max(0, now - lastHeartbeat);

  if (elapsed < config.warnAfter) {
    const nextTransitionAt = lastHeartbeat + config.warnAfter;
    return {
      stage: "ACTIVE",
      elapsed,
      nextTransitionAt,
      secondsUntilNext: Math.max(0, nextTransitionAt - now),
    };
  }

  if (elapsed < config.windDownAfter) {
    const nextTransitionAt = lastHeartbeat + config.windDownAfter;
    return {
      stage: "WARNING",
      elapsed,
      nextTransitionAt,
      secondsUntilNext: Math.max(0, nextTransitionAt - now),
    };
  }

  if (elapsed < config.executeAfter) {
    const nextTransitionAt = lastHeartbeat + config.executeAfter;
    return {
      stage: "WINDING_DOWN",
      elapsed,
      nextTransitionAt,
      secondsUntilNext: Math.max(0, nextTransitionAt - now),
    };
  }

  return {
    stage: "EXECUTABLE",
    elapsed,
    nextTransitionAt: null,
    secondsUntilNext: null,
  };
}

/**
 * Stage-gating rules for spending, intake, and tools.
 */
export function isSpendingAllowed(stage: Stage): boolean {
  return stage === "ACTIVE" || stage === "WARNING";
}

export function isNewWorkAllowed(stage: Stage): boolean {
  return stage === "ACTIVE";
}

export function isWindDownActive(stage: Stage): boolean {
  return stage === "WINDING_DOWN";
}

export function getThrottleRatio(stage: Stage, throttleBps: number = 2500): number {
  if (stage === "ACTIVE") return 1.0;
  if (stage === "WARNING") return throttleBps / 10000;
  return 0.0;
}
