import { describe, it, expect } from "vitest";
import {
  calculateJobEarned,
  calculateJobRefund,
  calculateTotalEarmark,
  canSpendFromWallet,
  formatUSDC,
  parseUSDC,
  type TrackedJob,
} from "../earmark";

describe("Earmark & Refund Math (Invariant I7)", () => {
  it("computes exact refund and earned amounts without rounding loss", () => {
    const prepaid = 1_000_000n; // 1.00 USDC
    const totalDays = 10;

    // 0 days delivered -> 0 earned, 100% refund
    expect(calculateJobEarned(prepaid, 0, totalDays)).toBe(0n);
    expect(calculateJobRefund(prepaid, 0, totalDays)).toBe(1_000_000n);

    // 5 days delivered -> 50% earned, 50% refund
    expect(calculateJobEarned(prepaid, 5, totalDays)).toBe(500_000n);
    expect(calculateJobRefund(prepaid, 5, totalDays)).toBe(500_000n);

    // 10 days delivered -> 100% earned, 0 refund
    expect(calculateJobEarned(prepaid, 10, totalDays)).toBe(1_000_000n);
    expect(calculateJobRefund(prepaid, 10, totalDays)).toBe(0n);
  });

  it("handles non-divisible numbers conservatively using floor (dust favors client refund)", () => {
    const prepaid = 1_000_000n; // 1.00 USDC
    const totalDays = 3;

    // Day 1: 1/3 earned = floor(1_000_000 / 3) = 333_333n
    const earned1 = calculateJobEarned(prepaid, 1, totalDays);
    const refund1 = calculateJobRefund(prepaid, 1, totalDays);
    expect(earned1).toBe(333_333n);
    expect(refund1).toBe(666_667n);
    expect(earned1 + refund1).toBe(prepaid);

    // Day 2: 2/3 earned = floor(2_000_000 / 3) = 666_666n
    const earned2 = calculateJobEarned(prepaid, 2, totalDays);
    const refund2 = calculateJobRefund(prepaid, 2, totalDays);
    expect(earned2).toBe(666_666n);
    expect(refund2).toBe(333_334n);
    expect(earned2 + refund2).toBe(prepaid);
  });

  it("caps delivered at totalDays so refund is never negative", () => {
    const prepaid = 500_000n;
    expect(calculateJobRefund(prepaid, 15, 10)).toBe(0n);
    expect(calculateJobEarned(prepaid, 15, 10)).toBe(prepaid);
  });

  it("rejects invalid negative inputs or zero total days", () => {
    expect(() => calculateJobRefund(1_000_000n, 1, 0)).toThrow("Total days must be positive");
    expect(() => calculateJobRefund(1_000_000n, -1, 5)).toThrow("Delivered days cannot be negative");
    expect(() => calculateJobRefund(-100n, 1, 5)).toThrow("Prepaid amount cannot be negative");
  });
});

describe("Total Earmark Calculation across Jobs", () => {
  it("sums unearned remainder only for ACTIVE jobs", () => {
    const jobs: TrackedJob[] = [
      {
        id: "job-1",
        prepaidAtomic: 1_000_000n,
        delivered: 2,
        totalDays: 5,
        status: "ACTIVE", // 2/5 delivered -> 600_000n unearned
      },
      {
        id: "job-2",
        prepaidAtomic: 500_000n,
        delivered: 1,
        totalDays: 5,
        status: "ACTIVE", // 1/5 delivered -> 400_000n unearned
      },
      {
        id: "job-3",
        prepaidAtomic: 2_000_000n,
        delivered: 1,
        totalDays: 10,
        status: "COMPLETED", // Completed jobs are no longer earmarked
      },
      {
        id: "job-4",
        prepaidAtomic: 800_000n,
        delivered: 2,
        totalDays: 4,
        status: "REFUNDED", // Already refunded jobs are excluded
      },
    ];

    const totalEarmark = calculateTotalEarmark(jobs);
    expect(totalEarmark).toBe(600_000n + 400_000n); // 1_000_000n (1.00 USDC)
  });
});

describe("Spend Guard Invariant (Invariant I1: wallet - spend >= earmarked)", () => {
  const earmarked = 4_000_000n; // 4.00 USDC earmarked for clients
  const wallet = 10_000_000n; // 10.00 USDC in wallet

  it("allows spending when remainder is greater than or equal to earmarked", () => {
    expect(canSpendFromWallet(wallet, 5_000_000n, earmarked)).toBe(true); // 5 left >= 4
    expect(canSpendFromWallet(wallet, 6_000_000n, earmarked)).toBe(true); // 4 left >= 4
  });

  it("blocks spending that encroaches on earmarked customer funds", () => {
    expect(canSpendFromWallet(wallet, 6_000_001n, earmarked)).toBe(false); // 3.999999 left < 4
    expect(canSpendFromWallet(wallet, 10_000_000n, earmarked)).toBe(false);
  });

  it("blocks spending exceeding wallet balance or negative amounts", () => {
    expect(canSpendFromWallet(wallet, 12_000_000n, earmarked)).toBe(false);
    expect(canSpendFromWallet(wallet, -1_000n, earmarked)).toBe(false);
  });
});

describe("USDC Atomic Formatting and Parsing", () => {
  it("formats atomic units to human string", () => {
    expect(formatUSDC(1_000_000n)).toBe("1.00 USDC");
    expect(formatUSDC(1_250_000n)).toBe("1.25 USDC");
    expect(formatUSDC(50_000n)).toBe("0.05 USDC");
    expect(formatUSDC(0n)).toBe("0.00 USDC");
  });

  it("parses human string into atomic units", () => {
    expect(parseUSDC("1.00")).toBe(1_000_000n);
    expect(parseUSDC("0.10")).toBe(100_000n);
    expect(parseUSDC("2.500000 USDC")).toBe(2_500_000n);
    expect(parseUSDC("0.002")).toBe(2_000n);
  });
});
