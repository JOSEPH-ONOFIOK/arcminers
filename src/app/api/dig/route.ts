import { NextResponse } from "next/server";
import { commitDig } from "@/lib/server/actions";
import { actor } from "@/lib/server/respond";

export const runtime = "nodejs";

// Commit to a dig.
export async function POST(request: Request) {
  const who = await actor(request, 120);
  if (!who.ok) return who.response;

  const result = await commitDig(who.handle);
  if (!result.ok) return NextResponse.json(result, { status: 409 });

  return NextResponse.json({
    ok: true,
    dig: { id: result.dig.id, seq: result.dig.seq, tier: result.dig.tier, odds: result.dig.odds },
    revealAt: result.dig.revealAt,
  });
}
