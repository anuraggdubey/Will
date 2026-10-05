/**
 * WILLS AGENT TOOLS & STAGE-GATED DISPATCH
 * Source of truth: docs/SPEC.md §8.3
 *
 * Authority is enforced in code, not in prompts:
 * - Stage-gated tools are removed from the model's function declarations
 *   when in restricted stages.
 * - Every tool also asserts the stage inside its run handler for defense-in-depth.
 */
import { getWalletAddress, getWalletBalance, payAndFetch } from "./wallet";
import { getMockEstateClient } from "@/lib/estate/mock";
import { isSpendingAllowed, isNewWorkAllowed, type Stage } from "@/lib/estate/stage";
import { getStandingBriefs, commissionNewBrief } from "@/lib/jobs/model";
import { formatUSDC, calculateJobRefund } from "@/lib/spend/earmark";

export type Tool = {
  name: string;
  description: string;
  /** JSON Schema describing the inputs. */
  parameters: object;
  /** Stages in which this tool is permitted. If omitted, allowed in all stages. */
  stages?: Stage[];
  /** The code that runs when the agent calls this tool. */
  run: (args: any, ctx: { baseUrl: string; stage?: Stage }) => Promise<unknown>;
};

export const tools: Tool[] = [
  // ─── 1. Estate status tool (Always available) ───
  {
    name: "estate_status",
    description: "Get the current estate lifecycle stage, heartbeat status, countdowns, vault balances, and earmarked customer reserve.",
    parameters: { type: "object", properties: {} },
    stages: ["ACTIVE", "WARNING", "WINDING_DOWN", "EXECUTABLE", "SETTLED"],
    run: async () => {
      const client = getMockEstateClient();
      const state = await client.getState();
      return {
        stage: state.stage,
        elapsedSeconds: state.elapsed,
        secondsUntilNextStage: state.secondsUntilNext,
        nextTransitionAt: state.nextTransitionAt ? new Date(state.nextTransitionAt * 1000).toISOString() : null,
        vaultBalance: formatUSDC(state.vaultBalance),
        agentOperatingFloat: formatUSDC(state.agentFloat),
        customerEarmarkReserve: formatUSDC(state.earmarked),
        periodAllowanceRemaining: formatUSDC(state.allowanceRemaining),
        isSettled: state.isSettled,
        willHash: state.willHash,
        heirsCount: state.heirs.length,
      };
    },
  },

  // ─── 2. List standing briefs (Always available) ───
  {
    name: "list_jobs",
    description: "List all active standing briefs, delivery status, prepaid amounts, and customer refund preview.",
    parameters: { type: "object", properties: {} },
    stages: ["ACTIVE", "WARNING", "WINDING_DOWN", "EXECUTABLE", "SETTLED"],
    run: async () => {
      const briefs = getStandingBriefs();
      return {
        totalBriefs: briefs.length,
        briefs: briefs.map((b) => ({
          id: b.id,
          topic: b.topic,
          progress: `${b.delivered}/${b.totalDays} days delivered`,
          status: b.status,
          prepaid: formatUSDC(b.prepaidAtomic),
          refundIfWoundDown: formatUSDC(calculateJobRefund(b.prepaidAtomic, b.delivered, b.totalDays)),
          client: b.clientAddress,
        })),
      };
    },
  },

  // ─── 3. Commission new brief (ACTIVE only) ───
  {
    name: "commission_brief",
    description: "Commission a new standing brief for a client. Only allowed when estate is ACTIVE.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Research topic for daily digests" },
        days: { type: "number", description: "Number of days (3 to 30)" },
        clientAddress: { type: "string", description: "Client wallet address" },
      },
      required: ["topic", "days"],
    },
    stages: ["ACTIVE"],
    run: async ({ topic, days, clientAddress }) => {
      const client = getMockEstateClient();
      const state = await client.getState();
      if (!isNewWorkAllowed(state.stage)) {
        throw new Error(`Cannot commission brief: estate is in ${state.stage}. Authority restricted.`);
      }
      const brief = commissionNewBrief({
        topic,
        days: Number(days) || 7,
        clientAddress: clientAddress || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      });
      return {
        success: true,
        message: `Brief ${brief.id} successfully commissioned for ${brief.totalDays} days.`,
        briefId: brief.id,
        prepaid: formatUSDC(brief.prepaidAtomic),
      };
    },
  },

  // ─── 4. Paid weather API: outbound payment (ACTIVE & WARNING only) ───
  {
    name: "get_weather",
    description: "Get the current weather for a city. Costs 0.01 USDC, paid automatically from the agent's wallet. Blocked during WINDING_DOWN.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. Mumbai" },
      },
      required: ["city"],
    },
    stages: ["ACTIVE", "WARNING"],
    run: async ({ city }, { baseUrl, stage }) => {
      if (stage && !isSpendingAllowed(stage)) {
        throw new Error(`Spending blocked: estate is in ${stage} stage.`);
      }
      return payAndFetch(`${baseUrl}/api/weather?city=${encodeURIComponent(city)}`);
    },
  },

  // ─── 5. Wallet tool ───
  {
    name: "get_my_wallet",
    description: "Get the agent's own wallet address and its ETH balance on Base Sepolia (testnet).",
    parameters: { type: "object", properties: {} },
    run: async () => ({
      address: getWalletAddress(),
      balance: await getWalletBalance(),
      network: "Base Sepolia (testnet)",
    }),
  },

  // ─── 6. General utilities ───
  {
    name: "roll_dice",
    description: "Roll a dice with the given number of sides.",
    parameters: {
      type: "object",
      properties: {
        sides: { type: "number", description: "How many sides the dice has. Default 6." },
      },
    },
    run: async ({ sides = 6 }: { sides?: number }) => ({ rolled: Math.floor(Math.random() * sides) + 1, sides }),
  },
  {
    name: "get_joke",
    description: "Get a random joke. Use when the user wants a joke.",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const res = await fetch("https://official-joke-api.appspot.com/random_joke");
      return res.json();
    },
  },
  {
    name: "get_country_info",
    description: "Get facts about a country, including its capital and population.",
    parameters: {
      type: "object",
      properties: {
        country: { type: "string", description: "Country name, e.g. India" },
      },
      required: ["country"],
    },
    run: async ({ country }: { country: string }) => {
      const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}`);
      const [data] = await res.json();
      return {
        capital: data?.capital?.[0],
        population: data?.population,
        region: data?.region,
      };
    },
  },
];

/**
 * Filter tools available to the LLM based on current estate stage.
 * When in WINDING_DOWN or SETTLED, restricted tools are completely omitted
 * from Gemini's function declarations.
 */
export function toolsForStage(stage: Stage): Tool[] {
  return tools.filter((t) => !t.stages || t.stages.includes(stage));
}
