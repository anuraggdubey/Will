/**
 * Injectable Clock Abstraction for Wills
 *
 * Supports both real-time wall clock and simulated time-warp clock.
 * Crucial for testing stage boundaries, timeouts, and UI simulation mode.
 */

export interface Clock {
  /** Returns current Unix timestamp in seconds (integer). */
  now(): number;
  /** Returns current Unix timestamp in milliseconds. */
  nowMs(): number;
  /** Returns ISO string representation of the current clock time. */
  toISOString(): string;
}

/** Standard real-world clock that uses system time. */
export class SystemClock implements Clock {
  now(): number {
    return Math.floor(Date.now() / 1000);
  }

  nowMs(): number {
    return Date.now();
  }

  toISOString(): string {
    return new Date().toISOString();
  }
}

/** Controllable clock for simulations, tests, and demo time-warping. */
export class SimulatedClock implements Clock {
  private offsetSeconds: number = 0;
  private baseTimestamp: number;

  constructor(initialTimestamp?: number) {
    this.baseTimestamp = initialTimestamp ?? Math.floor(Date.now() / 1000);
  }

  now(): number {
    return this.baseTimestamp + this.offsetSeconds;
  }

  nowMs(): number {
    return this.now() * 1000;
  }

  toISOString(): string {
    return new Date(this.nowMs()).toISOString();
  }

  /** Advance simulated time forward by specified seconds. */
  warp(seconds: number): number {
    if (seconds < 0) {
      throw new Error(`Cannot warp backwards in time (requested ${seconds}s)`);
    }
    this.offsetSeconds += Math.floor(seconds);
    return this.now();
  }

  /** Set current time to an explicit absolute Unix timestamp in seconds. */
  setTime(timestampSeconds: number): void {
    this.baseTimestamp = Math.floor(timestampSeconds);
    this.offsetSeconds = 0;
  }

  /** Reset offset back to 0. */
  reset(): void {
    this.offsetSeconds = 0;
    this.baseTimestamp = Math.floor(Date.now() / 1000);
  }

  getOffset(): number {
    return this.offsetSeconds;
  }
}

// Global clock instance for app-wide simulated time
let currentClock: Clock = new SimulatedClock();

export function getClock(): Clock {
  return currentClock;
}

export function setClock(clock: Clock): void {
  currentClock = clock;
}
