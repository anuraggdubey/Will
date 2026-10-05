import { describe, it, expect } from "vitest";
import {
  calculateStage,
  validateStageConfig,
  isSpendingAllowed,
  isNewWorkAllowed,
  isWindDownActive,
  getThrottleRatio,
  DEMO_STAGE_CONFIG,
  REALISTIC_STAGE_CONFIG,
  type StageConfig,
} from "../stage";

describe("Stage Configuration Validation", () => {
  it("validates demo and realistic configurations successfully", () => {
    expect(() => validateStageConfig(DEMO_STAGE_CONFIG)).not.toThrow();
    expect(() => validateStageConfig(REALISTIC_STAGE_CONFIG)).not.toThrow();
  });

  it("throws error if warnAfter is zero or negative", () => {
    const invalid: StageConfig = { warnAfter: 0, windDownAfter: 10, executeAfter: 20 };
    expect(() => validateStageConfig(invalid)).toThrow("warnAfter must be positive");
  });

  it("throws error if windDownAfter is not strictly greater than warnAfter", () => {
    const equal: StageConfig = { warnAfter: 10, windDownAfter: 10, executeAfter: 20 };
    expect(() => validateStageConfig(equal)).toThrow("windDownAfter (10) must be strictly greater than warnAfter (10)");

    const less: StageConfig = { warnAfter: 15, windDownAfter: 10, executeAfter: 20 };
    expect(() => validateStageConfig(less)).toThrow("windDownAfter (10) must be strictly greater than warnAfter (15)");
  });

  it("throws error if executeAfter is not strictly greater than windDownAfter", () => {
    const equal: StageConfig = { warnAfter: 10, windDownAfter: 20, executeAfter: 20 };
    expect(() => validateStageConfig(equal)).toThrow("executeAfter (20) must be strictly greater than windDownAfter (20)");
  });
});

describe("calculateStage Transitions and Boundaries", () => {
  const config = DEMO_STAGE_CONFIG; // warnAfter: 90, windDownAfter: 180, executeAfter: 300
  const heartbeat = 1000;

  it("reports ACTIVE immediately after heartbeat and up to warnAfter - 1", () => {
    // Exactly at heartbeat (elapsed = 0)
    const atHeartbeat = calculateStage(heartbeat, heartbeat, config);
    expect(atHeartbeat.stage).toBe("ACTIVE");
    expect(atHeartbeat.elapsed).toBe(0);
    expect(atHeartbeat.secondsUntilNext).toBe(90);
    expect(atHeartbeat.nextTransitionAt).toBe(1090);

    // 1 second before warning (elapsed = 89)
    const beforeWarn = calculateStage(heartbeat, heartbeat + 89, config);
    expect(beforeWarn.stage).toBe("ACTIVE");
    expect(beforeWarn.elapsed).toBe(89);
    expect(beforeWarn.secondsUntilNext).toBe(1);
  });

  it("transitions to WARNING at exactly warnAfter and stays until windDownAfter - 1", () => {
    // Exactly at warn boundary (elapsed = 90)
    const atWarn = calculateStage(heartbeat, heartbeat + 90, config);
    expect(atWarn.stage).toBe("WARNING");
    expect(atWarn.elapsed).toBe(90);
    expect(atWarn.nextTransitionAt).toBe(heartbeat + 180);
    expect(atWarn.secondsUntilNext).toBe(90);

    // 1 second before wind-down (elapsed = 179)
    const beforeWindDown = calculateStage(heartbeat, heartbeat + 179, config);
    expect(beforeWindDown.stage).toBe("WARNING");
    expect(beforeWindDown.elapsed).toBe(179);
    expect(beforeWindDown.secondsUntilNext).toBe(1);
  });

  it("transitions to WINDING_DOWN at exactly windDownAfter and stays until executeAfter - 1", () => {
    // Exactly at wind-down boundary (elapsed = 180)
    const atWindDown = calculateStage(heartbeat, heartbeat + 180, config);
    expect(atWindDown.stage).toBe("WINDING_DOWN");
    expect(atWindDown.elapsed).toBe(180);
    expect(atWindDown.nextTransitionAt).toBe(heartbeat + 300);
    expect(atWindDown.secondsUntilNext).toBe(120);

    // 1 second before executable (elapsed = 299)
    const beforeExec = calculateStage(heartbeat, heartbeat + 299, config);
    expect(beforeExec.stage).toBe("WINDING_DOWN");
    expect(beforeExec.elapsed).toBe(299);
    expect(beforeExec.secondsUntilNext).toBe(1);
  });

  it("transitions to EXECUTABLE at executeAfter and stays executable", () => {
    // Exactly at execute boundary (elapsed = 300)
    const atExec = calculateStage(heartbeat, heartbeat + 300, config);
    expect(atExec.stage).toBe("EXECUTABLE");
    expect(atExec.elapsed).toBe(300);
    expect(atExec.nextTransitionAt).toBeNull();
    expect(atExec.secondsUntilNext).toBeNull();

    // Far in future
    const longAfter = calculateStage(heartbeat, heartbeat + 9999, config);
    expect(longAfter.stage).toBe("EXECUTABLE");
    expect(longAfter.nextTransitionAt).toBeNull();
  });

  it("always returns SETTLED when isSettled is true", () => {
    const settledEarly = calculateStage(heartbeat, heartbeat + 10, config, true);
    expect(settledEarly.stage).toBe("SETTLED");
    expect(settledEarly.nextTransitionAt).toBeNull();
    expect(settledEarly.secondsUntilNext).toBeNull();

    const settledLate = calculateStage(heartbeat, heartbeat + 500, config, true);
    expect(settledLate.stage).toBe("SETTLED");
  });

  it("supports resurrection: sending a heartbeat resets stage back to ACTIVE", () => {
    // Agent was in WINDING_DOWN
    const woundDown = calculateStage(heartbeat, heartbeat + 200, config);
    expect(woundDown.stage).toBe("WINDING_DOWN");

    // Owner comes back and sends heartbeat at t=1200
    const newHeartbeat = heartbeat + 200;
    const resurrected = calculateStage(newHeartbeat, newHeartbeat, config);
    expect(resurrected.stage).toBe("ACTIVE");
    expect(resurrected.elapsed).toBe(0);
    expect(resurrected.secondsUntilNext).toBe(90);
  });
});

describe("Stage Authority & Gating Rules", () => {
  it("spending is only allowed in ACTIVE and WARNING", () => {
    expect(isSpendingAllowed("ACTIVE")).toBe(true);
    expect(isSpendingAllowed("WARNING")).toBe(true);
    expect(isSpendingAllowed("WINDING_DOWN")).toBe(false);
    expect(isSpendingAllowed("EXECUTABLE")).toBe(false);
    expect(isSpendingAllowed("SETTLED")).toBe(false);
  });

  it("new work intake is only allowed in ACTIVE", () => {
    expect(isNewWorkAllowed("ACTIVE")).toBe(true);
    expect(isNewWorkAllowed("WARNING")).toBe(false);
    expect(isNewWorkAllowed("WINDING_DOWN")).toBe(false);
    expect(isNewWorkAllowed("EXECUTABLE")).toBe(false);
    expect(isNewWorkAllowed("SETTLED")).toBe(false);
  });

  it("wind-down is only active in WINDING_DOWN", () => {
    expect(isWindDownActive("WINDING_DOWN")).toBe(true);
    expect(isWindDownActive("ACTIVE")).toBe(false);
    expect(isWindDownActive("WARNING")).toBe(false);
  });

  it("computes throttle ratio correctly", () => {
    expect(getThrottleRatio("ACTIVE")).toBe(1.0);
    expect(getThrottleRatio("WARNING", 2500)).toBe(0.25);
    expect(getThrottleRatio("WARNING", 5000)).toBe(0.5);
    expect(getThrottleRatio("WINDING_DOWN")).toBe(0.0);
    expect(getThrottleRatio("EXECUTABLE")).toBe(0.0);
    expect(getThrottleRatio("SETTLED")).toBe(0.0);
  });
});
