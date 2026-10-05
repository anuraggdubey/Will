/**
 * Earmark and Refund Mathematics for Customer Prepayments
 * Source of truth: docs/SPEC.md §0 (Rule 5), §6.2 (Invariants I1, I7), §8.5
 *
 * Rules:
 * 1. Money is ALWAYS `bigint` in token atomic units (USDC = 6 decimals: 1 USDC = 1_000_000n).
 * 2. Never use floating point numbers for financial calculation.
 * 3. Invariant I7: Refund per job = prepaid − floor(prepaid × delivered / total).
 * 4. Invariant I1: Agent can never spend earmarked customer funds:
 *    walletBalance − amountToSpend ≥ earmarked.
 */

export interface TrackedJob {
  id: string;
  prepaidAtomic: bigint;
  delivered: number;
  totalDays: number;
  status: "ACTIVE" | "COMPLETED" | "REFUNDED" | "CANCELLED";
}

/**
 * Calculate the earned portion of a prepaid job.
 * Uses integer BigInt arithmetic which automatically computes floor().
 */
export function calculateJobEarned(prepaidAtomic: bigint, delivered: number, totalDays: number): bigint {
  if (totalDays <= 0) {
    throw new Error(`Total days must be positive (received ${totalDays})`);
  }
  if (delivered < 0) {
    throw new Error(`Delivered days cannot be negative (received ${delivered})`);
  }
  if (prepaidAtomic < 0n) {
    throw new Error(`Prepaid amount cannot be negative (received ${prepaidAtomic})`);
  }

  // Cap delivered at totalDays
  const cappedDelivered = Math.min(delivered, totalDays);
  return (prepaidAtomic * BigInt(cappedDelivered)) / BigInt(totalDays);
}

/**
 * Calculate the unearned refund owed to a customer for an uncompleted job.
 * Invariant I7: refund = prepaid − floor(prepaid × delivered / total).
 * Guaranteed: 0n <= refund <= prepaidAtomic.
 */
export function calculateJobRefund(prepaidAtomic: bigint, delivered: number, totalDays: number): bigint {
  const earned = calculateJobEarned(prepaidAtomic, delivered, totalDays);
  const refund = prepaidAtomic - earned;

  // Invariant assertion
  if (refund < 0n || refund > prepaidAtomic) {
    throw new Error(`Invariant violation: refund ${refund} must be between 0 and prepaid ${prepaidAtomic}`);
  }

  return refund;
}

/**
 * Calculate the total earmarked customer funds across all active jobs.
 * This represents the total unearned balance that belongs to customers.
 */
export function calculateTotalEarmark(jobs: TrackedJob[]): bigint {
  let totalEarmarked = 0n;

  for (const job of jobs) {
    if (job.status === "ACTIVE") {
      totalEarmarked += calculateJobRefund(job.prepaidAtomic, job.delivered, job.totalDays);
    }
  }

  return totalEarmarked;
}

/**
 * Invariant I1 Check: Ensure a proposed outbound expenditure does not touch
 * earmarked customer funds.
 *
 * (walletBalance - amountToSpend) >= earmarked
 */
export function canSpendFromWallet(
  walletBalanceAtomic: bigint,
  amountToSpendAtomic: bigint,
  earmarkedAtomic: bigint
): boolean {
  if (amountToSpendAtomic < 0n) return false;
  if (walletBalanceAtomic < amountToSpendAtomic) return false;

  const remainingBalance = walletBalanceAtomic - amountToSpendAtomic;
  return remainingBalance >= earmarkedAtomic;
}

/**
 * Convert atomic units (6 decimals) to human-readable string.
 * e.g. 1_000_000n -> "1.00 USDC" or "1.500000 USDC"
 */
export function formatUSDC(atomic: bigint, decimals: number = 2): string {
  const isNegative = atomic < 0n;
  const abs = isNegative ? -atomic : atomic;
  const whole = abs / 1_000_000n;
  const fraction = abs % 1_000_000n;
  const fractionStr = fraction.toString().padStart(6, "0").slice(0, decimals);
  return `${isNegative ? "-" : ""}${whole}.${fractionStr} USDC`;
}

/**
 * Parse a human decimal string (e.g. "0.10" or "1.5") to atomic units (6 decimals).
 */
export function parseUSDC(amountStr: string): bigint {
  const trimmed = amountStr.trim().replace(" USDC", "");
  const [wholeStr, fracStr = ""] = trimmed.split(".");
  const whole = BigInt(wholeStr || "0");
  const frac = BigInt((fracStr + "000000").slice(0, 6));
  return whole * 1_000_000n + frac;
}
