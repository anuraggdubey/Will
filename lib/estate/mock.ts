/**
 * Mock Estate Client for Week 1 Simulation
 * Source of truth: docs/SPEC.md §6.1, §7.4, §15, §16
 */

import { getClock, SimulatedClock } from "../clock";
import {
  calculateStage,
  DEMO_STAGE_CONFIG,
  isSpendingAllowed,
  type StageConfig,
} from "./stage";
import type { EstateClient, EstateState, HeirInfo } from "./client";

export class MockEstateClient implements EstateClient {
  private config: StageConfig;
  private lastHeartbeat: number;
  private isSettled: boolean = false;
  private vaultBalance: bigint = 25_000_000n; // 25.00 USDC
  private agentFloat: bigint = 2_500_000n; // 2.50 USDC
  private earmarked: bigint = 1_200_000n; // 1.20 USDC client funds reserve
  private allowanceRemaining: bigint = 1_000_000n; // 1.00 USDC
  private willHash: `0x${string}` = "0x8fa4029283f5127efab01928374a5e01b443019d93a82745e7839201f8490a2c";
  private heirs: HeirInfo[] = [
    { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", bps: 6000, label: "Primary Heir (Research Lab)" },
    { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", bps: 4000, label: "Client Liquidity Reserve" },
  ];

  constructor(config: StageConfig = DEMO_STAGE_CONFIG) {
    this.config = config;
    this.lastHeartbeat = getClock().now();
  }

  async getState(): Promise<EstateState> {
    const clock = getClock();
    const now = clock.now();
    const status = calculateStage(this.lastHeartbeat, now, this.config, this.isSettled);

    return {
      ...status,
      now,
      lastHeartbeat: this.lastHeartbeat,
      vaultBalance: this.vaultBalance,
      agentFloat: this.agentFloat,
      earmarked: this.earmarked,
      allowanceRemaining: this.allowanceRemaining,
      willHash: this.willHash,
      isSettled: this.isSettled,
      heirs: this.heirs,
    };
  }

  async heartbeat(): Promise<{ success: boolean; lastHeartbeat: number; txHash?: string }> {
    const clock = getClock();
    this.lastHeartbeat = clock.now();
    // A heartbeat does not un-settle an already executed will
    return {
      success: true,
      lastHeartbeat: this.lastHeartbeat,
      txHash: `0xmock_heartbeat_${Date.now().toString(16)}`,
    };
  }

  async draw(amount: bigint): Promise<{ success: boolean; drawn: bigint; txHash?: string }> {
    const state = await this.getState();
    if (!isSpendingAllowed(state.stage)) {
      throw new Error(`Cannot draw funds during stage ${state.stage}. Authority restricted.`);
    }
    if (amount > this.allowanceRemaining) {
      throw new Error(`Draw amount (${amount}) exceeds remaining allowance (${this.allowanceRemaining}).`);
    }
    if (amount > this.vaultBalance) {
      throw new Error(`Insufficient vault balance.`);
    }

    this.vaultBalance -= amount;
    this.agentFloat += amount;
    this.allowanceRemaining -= amount;

    return {
      success: true,
      drawn: amount,
      txHash: `0xmock_draw_${Date.now().toString(16)}`,
    };
  }

  async executeWill(): Promise<{ success: boolean; txHash?: string; settledAt: number }> {
    const state = await this.getState();
    if (state.stage !== "EXECUTABLE") {
      throw new Error(`Will cannot be executed while in stage ${state.stage}. Must be EXECUTABLE.`);
    }
    if (this.isSettled) {
      throw new Error("Will has already been executed and settled.");
    }

    this.isSettled = true;
    return {
      success: true,
      txHash: `0xmock_settle_${Date.now().toString(16)}`,
      settledAt: getClock().now(),
    };
  }

  async warp(seconds: number): Promise<EstateState> {
    const clock = getClock();
    if (clock instanceof SimulatedClock) {
      clock.warp(seconds);
    }
    return this.getState();
  }

  async resetClock(): Promise<EstateState> {
    const clock = getClock();
    if (clock instanceof SimulatedClock) {
      clock.reset();
    }
    this.lastHeartbeat = clock.now();
    this.isSettled = false;
    return this.getState();
  }

  setEarmarked(amount: bigint): void {
    this.earmarked = amount;
  }
}

// Global singleton instance for simulated estate
let mockClientInstance: MockEstateClient | null = null;

export function getMockEstateClient(): MockEstateClient {
  if (!mockClientInstance) {
    mockClientInstance = new MockEstateClient();
  }
  return mockClientInstance;
}
