import { NextResponse } from "next/server";
import { devSignInAllowed, HANDLE_COOKIE } from "@/lib/server/session";
import { HANDLE_RE, normalizeHandle } from "@/lib/shaft/rules";

export const runtime = "nodejs";

// Sign in as anyone, without X credentials.
export async function POST(request: Request) {
  if (!devSignInAllowed()) {
    return NextResponse.json({ ok: false, reason: "Not available." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const handle = normalizeHandle(String(body?.handle ?? ""));
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json({ ok: false, reason: "That isn't a handle." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, handle });
  response.cookies.set(HANDLE_COOKIE, handle, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
