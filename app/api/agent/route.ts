import { MODEL, runAgent } from "@/agent/agent";
import { tools } from "@/agent/tools";
import { getMockEstateClient } from "@/lib/estate/mock";

// GET /api/agent -> setup status + stage-aware tools
export async function GET() {
  const estate = await getMockEstateClient().getState();

  const allTools = tools.map((t) => {
    const isAllowed = !t.stages || t.stages.includes(estate.stage);
    return {
      name: t.name,
      description: t.description,
      stages: t.stages ?? ["ACTIVE", "WARNING", "WINDING_DOWN", "EXECUTABLE", "SETTLED"],
      isAllowed,
    };
  });

  return Response.json({
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: MODEL,
    stage: estate.stage,
    tools: allTools,
  });
}

// POST /api/agent { messages } -> the agent's answer + the tools it used
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "Add GEMINI_API_KEY to your .env file, then restart `npm run dev`." },
      { status: 500 }
    );
  }

  const { messages } = await req.json();
  try {
    const result = await runAgent(messages, { baseUrl: new URL(req.url).origin });
    return Response.json(result);
  } catch (err: any) {
    return Response.json({ error: err.message || String(err) }, { status: 500 });
  }
}
