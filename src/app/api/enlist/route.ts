import { NextResponse } from "next/server";
import { enlist } from "@/lib/server/actions";
import { actor } from "@/lib/server/respond";
import { RIGS, type Rig } from "@/lib/shaft/rules";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const who = await actor(request, 10);
  if (!who.ok) return who.response;

  const body = await request.json().catch(() => ({}));
  const rig = String(body?.rig ?? "") as Rig;
  if (!RIGS.includes(rig)) {
    return NextResponse.json({ ok: false, reason: "Pick a rig." }, { status: 400 });
  }

  const result = await enlist(who.handle, rig);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
