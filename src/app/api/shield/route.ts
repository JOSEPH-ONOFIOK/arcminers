import { NextResponse } from "next/server";
import { placeShield } from "@/lib/server/actions";
import { actor, guard } from "@/lib/server/respond";
import { HANDLE_RE, normalizeHandle } from "@/lib/shaft/rules";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return guard(async () => {
    const who = await actor(request, 60);
    if (!who.ok) return who.response;

    const body = await request.json().catch(() => ({}));
    const target = normalizeHandle(String(body?.target ?? ""));
    if (!HANDLE_RE.test(target)) {
      return NextResponse.json({ ok: false, reason: "That isn't a handle." }, { status: 400 });
    }

    const result = await placeShield(who.handle, target);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  });
}
