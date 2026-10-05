# Wills — An Estate for Autonomous Agents

> **"What happens to an AI agent's money, promises, and unfinished jobs when its owner disappears? Wills is the answer: a will, a wind-down, and a payout, all on-chain."**

Wills is an autonomous agent architecture built for the **Rise In Agentmaxxing** program on **Base Sepolia**. It introduces an on-chain estate and lifecycle management protocol for AI agents operating with crypto wallets and paid APIs.

---

## The Problem

Autonomous agents are starting to hold money, make commitments to clients, and run for extended periods. When the human principal behind an agent disappears or goes silent:
1. The agent continues spending until its wallet is drained.
2. Clients' prepaid work is abandoned with no refunds.
3. Leftover operating funds remain stranded or lost forever.

## The Solution: Wills

Wills places the agent's funds in an on-chain vault that monitors an owner's heartbeat. If the heartbeat lapses:
- **Graceful Degradation:** The system transitions through stages: `ACTIVE` → `WARNING` → `WINDING_DOWN` → `EXECUTABLE` → `SETTLED`.
- **Spend Throttling:** Operating allowances are throttled in `WARNING`, and new work intake is halted in `WINDING_DOWN`.
- **Customer Protection:** Prepayments are earmarked so client funds can never be spent by the agent; unfinished jobs are automatically refunded on-chain.
- **Estate Settlement:** The remaining vault balance is distributed to named heirs on Base Sepolia.
- **Self-Reported Postmortem:** The agent analyzes its history and publishes its own wind-down report.

---

## Honesty Statements

- **Testnet Only:** Runs on Base Sepolia with testnet funds. No real money is transferred.
- **Heartbeat vs. Death:** The system detects a *missed heartbeat*, not biological death. A vacation and an absence look identical on-chain; Wills mitigates this through staged warnings and resurrection on owner return.
- **Technical Instrument:** The will is a deterministic smart contract protocol, not a legal instrument.

---

## Tech Stack

- **AI Core:** Google Gemini (`@google/genai`)
- **Crypto & Chain:** Base Sepolia, `viem`, x402 micropayments
- **Full Stack:** Next.js (App Router), TypeScript, Tailwind CSS
- **Smart Contracts:** Solidity, Foundry, OpenZeppelin

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env` and configure your API key:
```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-flash-latest
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## License
MIT
