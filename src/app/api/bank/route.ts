import { NextResponse } from "next/server";
import { bank } from "@/lib/server/actions";
import { actor } from "@/lib/server/respond";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const who = await actor(request, 60);
  if (!who.ok) return who.response;

  const result = await bank(who.handle);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
