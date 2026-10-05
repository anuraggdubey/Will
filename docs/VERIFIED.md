# Verified Facts & Spike Log

This document records confirmed facts, SDK evaluations, addresses, and architecture investigations as required by the Wills Spec (`docs/SPEC.md` §0, §9, §20).

---

## Spike S1: Starter `payAndFetch` Behavior Analysis
- **Date Verified:** Oct 6, 2026
- **Status:** **COMPLETE**
- **Investigation:**
  - Analyzed `agent/wallet.ts` (`payAndFetch`, lines 57–79) and `app/api/weather/route.ts`.
  - The starter kit implements a simulated, off-chain payment authorization scheme:
    1. Agent makes an HTTP GET request to the target route.
    2. Endpoint returns HTTP 402 with `{ price, asset, payTo }`.
    3. The agent wallet uses `account.signMessage({ message: JSON.stringify(payment) })` to produce an EIP-191 personal signature.
    4. Base64 encodes `{ payment, signature }` and sends it via `X-PAYMENT` header.
    5. Target endpoint recovers the signer via `verifyMessage` and returns HTTP 200.
- **Key Finding:**
  - **No on-chain transaction or state transition occurs.** No gas is spent, no tokens are transferred, and no transaction hash is produced on Base Sepolia.
- **Action Plan for Week 2 / Week 3:**
  - For Week 1: Keep the starter's simulation / lightweight wrapper for initial agent functionality.
  - For Week 3 (Requirement: every paid call settles on Base Sepolia and yields a BaseScan tx):
    - Replace with the official x402 protocol SDK (`@x402/*`) using EIP-3009 `transferWithAuthorization` on test USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) with the x402 facilitator or direct smart contract settlement.
    - Every transaction hash must be recorded in the `receipts` ledger table.

---

## Network & Token Addresses (Base Sepolia)
- **Chain ID:** `84532`
- **RPC URL:** `https://sepolia.base.org`
- **Block Explorer:** `https://sepolia.basescan.org`
- **USDC Address (Circle Testnet):** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals, 1 USDC = `1_000_000n` atomic units)
