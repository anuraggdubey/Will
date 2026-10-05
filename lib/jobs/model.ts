/**
 * Standing Briefs Data Model and In-Memory Store
 * Source of truth: docs/SPEC.md §8.2, §10
 */

import { calculateJobRefund, calculateTotalEarmark, type TrackedJob } from "../spend/earmark";
import { getMockEstateClient } from "../estate/mock";

export interface StandingBrief extends TrackedJob {
  clientAddress: string;
  topic: string;
  createdAt: number;
  lastTickAt?: number;
  digests: Array<{
    day: number;
    title: string;
    summary: string;
    deliveredAt: number;
  }>;
}

// Initial mock standing briefs to populate the product dashboard
let activeBriefs: StandingBrief[] = [
  {
    id: "brief-001",
    clientAddress: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    topic: "Autonomous AI Agent Protocols & x402 Ecosystem",
    totalDays: 7,
    delivered: 3,
    prepaidAtomic: 700_000n, // 0.70 USDC (0.10/day)
    status: "ACTIVE",
    createdAt: Date.now() - 3 * 86400 * 1000,
    digests: [
      { day: 1, title: "Day 1: Emergence of Agentic Wallets", summary: "Survey of Base Sepolia EIP-3009 micro-settlements.", deliveredAt: Date.now() - 3 * 86400 * 1000 },
      { day: 2, title: "Day 2: Gas Economics & Allowance Constraints", summary: "Analysis of ERC20 pull-payment safety in autonomous daemon loops.", deliveredAt: Date.now() - 2 * 86400 * 1000 },
      { day: 3, title: "Day 3: Graceful Degradation in Agent Runtimes", summary: "Evaluation of dead-man switches and postmortem triggers.", deliveredAt: Date.now() - 1 * 86400 * 1000 },
    ],
  },
  {
    id: "brief-002",
    clientAddress: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    topic: "Global Crypto Regulatory Watch & Base Sepolia Dev Activity",
    totalDays: 5,
    delivered: 1,
    prepaidAtomic: 500_000n, // 0.50 USDC
    status: "ACTIVE",
    createdAt: Date.now() - 1 * 86400 * 1000,
    digests: [
      { day: 1, title: "Day 1: Layer-2 Micro-Payment Regulation", summary: "Synthesis of testnet compliance and facilitator latency benchmarks.", deliveredAt: Date.now() - 1 * 86400 * 1000 },
    ],
  },
];

export function getStandingBriefs(): StandingBrief[] {
  return activeBriefs;
}

export function syncEstateEarmark(): void {
  const earmark = calculateTotalEarmark(activeBriefs);
  getMockEstateClient().setEarmarked(earmark);
}

// Initial sync
syncEstateEarmark();

export function commissionNewBrief(params: {
  clientAddress: string;
  topic: string;
  days: number;
}): StandingBrief {
  if (params.days < 1 || params.days > 30) {
    throw new Error("Brief duration must be between 1 and 30 days.");
  }

  const prepaidAtomic = BigInt(params.days) * 100_000n; // 0.10 USDC per day
  const newBrief: StandingBrief = {
    id: `brief-${(activeBriefs.length + 1).toString().padStart(3, "0")}`,
    clientAddress: params.clientAddress,
    topic: params.topic,
    totalDays: params.days,
    delivered: 0,
    prepaidAtomic,
    status: "ACTIVE",
    createdAt: Date.now(),
    digests: [],
  };

  activeBriefs.unshift(newBrief);
  syncEstateEarmark();
  return newBrief;
}

export function deliverBriefTick(briefId: string, digestData: { title: string; summary: string }): StandingBrief {
  const brief = activeBriefs.find((b) => b.id === briefId);
  if (!brief) throw new Error(`Brief ${briefId} not found.`);
  if (brief.status !== "ACTIVE") throw new Error(`Brief ${briefId} is not active.`);

  brief.delivered += 1;
  brief.digests.push({
    day: brief.delivered,
    title: digestData.title,
    summary: digestData.summary,
    deliveredAt: Date.now(),
  });

  if (brief.delivered >= brief.totalDays) {
    brief.status = "COMPLETED";
  }

  syncEstateEarmark();
  return brief;
}
