import { NextResponse } from "next/server";
import { currentHandle } from "./session";
import { clientIp, rateLimited } from "./limit";

export type Actor = { handle: string };

// Every mutating route starts the same way:
export async function actor(
  request: Request,
  limit = 30,
): Promise<{ ok: true; handle: string } | { ok: false; response: NextResponse }> {
  const handle = await currentHandle();
  if (!handle) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: "Sign in first." }, { status: 401 }),
    };
  }
  // Keyed on the handle rather than the IP: a shared network shouldn't throttle
  // strangers for each other, and the handle is what the cost is attached to.
  if (rateLimited(`${handle}:${new URL(request.url).pathname}`, limit)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: "Slow down." }, { status: 429 }),
    };
  }
  return { ok: true, handle };
}

export function ipLimited(request: Request, key: string, max: number): boolean {
  return rateLimited(`${key}:${clientIp(request)}`, max);
}
