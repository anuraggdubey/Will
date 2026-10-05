import { getStandingBriefs, commissionNewBrief } from "@/lib/jobs/model";
import { calculateJobRefund, formatUSDC } from "@/lib/spend/earmark";
import { getMockEstateClient } from "@/lib/estate/mock";
import { isNewWorkAllowed } from "@/lib/estate/stage";

export async function GET() {
  const briefs = getStandingBriefs();
  const serialized = briefs.map((b) => ({
    id: b.id,
    clientAddress: b.clientAddress,
    topic: b.topic,
    totalDays: b.totalDays,
    delivered: b.delivered,
    status: b.status,
    prepaidUSDC: formatUSDC(b.prepaidAtomic),
    refundIfCancelled: formatUSDC(calculateJobRefund(b.prepaidAtomic, b.delivered, b.totalDays)),
    createdAt: b.createdAt,
    digestsCount: b.digests.length,
    latestDigest: b.digests[b.digests.length - 1] ?? null,
  }));

  return Response.json({ briefs: serialized });
}

export async function POST(req: Request) {
  const estate = await getMockEstateClient().getState();
  if (!isNewWorkAllowed(estate.stage)) {
    return Response.json(
      { error: `New briefs rejected: Estate is in ${estate.stage} stage. Only ACTIVE agents may accept jobs.` },
      { status: 403 }
    );
  }

  try {
    const { clientAddress, topic, days } = await req.json();
    const brief = commissionNewBrief({
      clientAddress: clientAddress || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      topic: topic || "Decentralized AI Agent Research",
      days: Number(days) || 7,
    });

    return Response.json({ success: true, brief });
  } catch (err: any) {
    return Response.json({ error: err.message || String(err) }, { status: 400 });
  }
}
