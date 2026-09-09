import { NextResponse } from "next/server";
import { assayFor } from "@/lib/server/assay";
import { currentHandle } from "@/lib/server/session";
import { composeText, intentUrl } from "@/lib/shaft/tag";
import { TIER_RULES, RIG_RULES } from "@/lib/shaft/rules";
import { traitList } from "@/lib/shaft/traits";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The run, assayed.
export async function GET(request: Request) {
  const handle = await currentHandle();
  if (!handle) return NextResponse.json({ ok: false, reason: "Sign in first." }, { status: 401 });

  const player = await getStore().getPlayer(handle);
  if (!player) return NextResponse.json({ ok: false, reason: "No run to assay." }, { status: 404 });

  const assay = await assayFor(player);
  const tierLabel = TIER_RULES[assay.tier].label;
  const rigLabel = RIG_RULES[player.rig].label;
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    ok: true,
    assay: {
      ...assay,
      traitList: traitList(assay.traits),
      postText: composeText(assay.seed, tierLabel, rigLabel),
      intentUrl: intentUrl(assay.seed, tierLabel, rigLabel, origin),
    },
  });
}
