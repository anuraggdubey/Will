/**
 * WILLS AGENT RUNTIME
 * Source of truth: docs/SPEC.md §8.1, §8.3, §8.4
 *
 * An agent is a loop:
 *   1. Determine current estate stage from EstateClient.
 *   2. Filter tools via toolsForStage(stage) — authority enforced in code!
 *   3. Send dynamic system prompt + allowed tools to Gemini.
 *   4. Execute tool calls and iterate up to MAX_STEPS.
 */
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { toolsForStage, type Tool } from "./tools";
import { getMockEstateClient } from "@/lib/estate/mock";

export const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_STEPS = 5;

export type ChatMessage = { role: "user" | "agent"; text: string };
export type Step = { tool: string; args: unknown; result: unknown; error?: boolean };

export async function runAgent(history: ChatMessage[], ctx: { baseUrl: string }) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const estateClient = getMockEstateClient();
  const estate = await estateClient.getState();

  // "Authority is enforced in code, not in prompts":
  // The model only ever sees tools permitted in its current lifecycle stage.
  const activeTools: Tool[] = toolsForStage(estate.stage);

  const dynamicSystemPrompt =
    `You are the "Wills Analyst", an autonomous AI agent operating under an on-chain estate (Wills Protocol).\n` +
    `You sell and service standing research briefs for clients and have an on-chain will.\n\n` +
    `CURRENT ESTATE STATE:\n` +
    `- Stage: ${estate.stage}\n` +
    `- Seconds since owner heartbeat: ${estate.elapsed}s\n` +
    `- Seconds until next transition: ${estate.secondsUntilNext ?? "N/A"}\n` +
    `- Vault Balance: ${(Number(estate.vaultBalance) / 1e6).toFixed(2)} USDC\n` +
    `- Customer Earmark Reserve: ${(Number(estate.earmarked) / 1e6).toFixed(2)} USDC\n\n` +
    `OPERATING RULES:\n` +
    `1. If asked about your status, funds, stage, or future, call the estate_status tool.\n` +
    `2. If asked about briefs or customer jobs, call the list_jobs tool.\n` +
    `3. Be honest, calm, and matter-of-fact about your wind-down and estate lifecycle.\n` +
    `4. If a user asks you to do something blocked by your current stage (such as spending during WINDING_DOWN), explain calmly that your authority is stage-gated by the Wills estate protocol. Never attempt workarounds.\n` +
    `5. Keep answers concise, professional, and clear.`;

  const contents: Content[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));
  const steps: Step[] = [];

  for (let i = 0; i < MAX_STEPS; i++) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: dynamicSystemPrompt,
        tools: [
          {
            functionDeclarations: activeTools.map((t) => ({
              name: t.name,
              description: t.description,
              parametersJsonSchema: t.parameters,
            })),
          },
        ],
      },
    });

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) return { answer: response.text ?? "", steps, stage: estate.stage };

    contents.push(response.candidates![0].content!);
    const results: Part[] = [];

    for (const call of calls) {
      const tool = activeTools.find((t) => t.name === call.name);
      let result: unknown;
      let error = false;
      try {
        if (!tool) {
          throw new Error(`Tool "${call.name}" is unavailable or blocked in stage ${estate.stage}.`);
        }
        result = await tool.run(call.args ?? {}, { ...ctx, stage: estate.stage });
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
        error = true;
      }
      steps.push({ tool: call.name!, args: call.args, result, error });
      results.push({ functionResponse: { id: call.id, name: call.name, response: { result } } });
    }

    contents.push({ role: "user", parts: results });
  }

  return { answer: "I hit my step limit. Try a simpler question.", steps, stage: estate.stage };
}
