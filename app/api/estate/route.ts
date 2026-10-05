import { getMockEstateClient } from "@/lib/estate/mock";
import { formatUSDC } from "@/lib/spend/earmark";

function serializeEstateState(state: any) {
  return {
    stage: state.stage,
    elapsed: state.elapsed,
    now: state.now,
    lastHeartbeat: state.lastHeartbeat,
    nextTransitionAt: state.nextTransitionAt,
    secondsUntilNext: state.secondsUntilNext,
    isSettled: state.isSettled,
    willHash: state.willHash,
    heirs: state.heirs,
    vaultBalance: {
      atomic: state.vaultBalance.toString(),
      formatted: formatUSDC(state.vaultBalance),
    },
    agentFloat: {
      atomic: state.agentFloat.toString(),
      formatted: formatUSDC(state.agentFloat),
    },
    earmarked: {
      atomic: state.earmarked.toString(),
      formatted: formatUSDC(state.earmarked),
    },
    allowanceRemaining: {
      atomic: state.allowanceRemaining.toString(),
      formatted: formatUSDC(state.allowanceRemaining),
    },
  };
}

export async function GET() {
  const client = getMockEstateClient();
  const state = await client.getState();
  return Response.json(serializeEstateState(state));
}

export async function POST(req: Request) {
  const client = getMockEstateClient();
  const body = await req.json();

  try {
    switch (body.action) {
      case "heartbeat": {
        const result = await client.heartbeat();
        const state = await client.getState();
        return Response.json({ ...serializeEstateState(state), actionResult: result });
      }
      case "warp": {
        const seconds = Number(body.seconds) || 0;
        const state = await client.warp(seconds);
        return Response.json(serializeEstateState(state));
      }
      case "reset": {
        const state = await client.resetClock();
        return Response.json(serializeEstateState(state));
      }
      case "executeWill": {
        const result = await client.executeWill();
        const state = await client.getState();
        return Response.json({ ...serializeEstateState(state), actionResult: result });
      }
      case "draw": {
        const amount = BigInt(body.amount || "0");
        const result = await client.draw(amount);
        const state = await client.getState();
        return Response.json({ ...serializeEstateState(state), actionResult: result });
      }
      default:
        return Response.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err: any) {
    return Response.json({ error: err.message || String(err) }, { status: 400 });
  }
}
