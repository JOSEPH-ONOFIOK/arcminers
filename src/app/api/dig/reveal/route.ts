import { NextResponse } from "next/server";
import { revealDig } from "@/lib/server/actions";
import { actor, guard } from "@/lib/server/respond";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return guard(async () => {
    const who = await actor(request, 120);
    if (!who.ok) return who.response;

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ ok: false, reason: "Which dig?" }, { status: 400 });

    const result = await revealDig(who.handle, id);
    // 425 Too Early is the honest answer while the dust is still settling, the
    // client shows a countdown against it rather than treating it as a failure.
    if (!result.ok) {
      return NextResponse.json(result, { status: result.retryAfterMs ? 425 : 409 });
    }
    return NextResponse.json(result);
  });
}
