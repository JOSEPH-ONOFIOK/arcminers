import { NextResponse } from "next/server";
import { ipLimited } from "@/lib/server/respond";
import { HANDLE_RE, normalizeHandle } from "@/lib/shaft/rules";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

// A like on somebody's assay.
export async function POST(request: Request) {
  if (ipLimited(request, "like", 60)) {
    return NextResponse.json({ ok: false, reason: "Slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const handle = normalizeHandle(String(body?.handle ?? ""));
  const voter = String(body?.voter ?? "").slice(0, 64);
  if (!HANDLE_RE.test(handle) || voter.length < 8) {
    return NextResponse.json({ ok: false, reason: "Bad request." }, { status: 400 });
  }

  const result = await getStore().like(handle, voter);
  if (!result) return NextResponse.json({ ok: false, reason: "No such assay." }, { status: 404 });
  return NextResponse.json({ ok: true, ...result });
}
