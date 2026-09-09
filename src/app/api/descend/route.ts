import { NextResponse } from "next/server";
import { descend } from "@/lib/server/actions";
import { actor, guard } from "@/lib/server/respond";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return guard(async () => {
    const who = await actor(request, 60);
    if (!who.ok) return who.response;

    const result = await descend(who.handle);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  });
}
