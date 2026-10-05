/**
 * Wills Estate Client Interface
 * Source of truth: docs/SPEC.md §15, §16
 *
 * Provides a unified estate abstraction. The mock implementation runs during Week 1,
 * and will seamlessly swap to ChainEstateClient (Base Sepolia) in Week 2–3 without
 * altering agent business logic.
 */

import type { Stage, StageStatus } from "./stage";

export interface HeirInfo {
  address: string;
  bps: number; // Basis points (e.g. 5000 = 50%)
  label?: string;
}

export interface EstateState extends StageStatus {
  now: number;
  lastHeartbeat: number;
  vaultBalance: bigint;
  agentFloat: bigint;
  earmarked: bigint;
  allowanceRemaining: bigint;
  willHash: `0x${string}` | null;
  isSettled: boolean;
  heirs: HeirInfo[];
}

export interface EstateClient {
  getState(): Promise<EstateState>;
  heartbeat(): Promise<{ success: boolean; lastHeartbeat: number; txHash?: string }>;
  draw(amount: bigint): Promise<{ success: boolean; drawn: bigint; txHash?: string }>;
  executeWill(): Promise<{ success: boolean; txHash?: string; settledAt: number }>;
  warp(seconds: number): Promise<EstateState>;
  resetClock(): Promise<EstateState>;
}
