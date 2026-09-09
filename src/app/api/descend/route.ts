import { NextResponse } from "next/server";
import { descend } from "@/lib/server/actions";
import { actor } from "@/lib/server/respond";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const who = await actor(request, 60);
  if (!who.ok) return who.response;

  const result = await descend(who.handle);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
