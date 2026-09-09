import { NextResponse, type NextRequest } from "next/server";
import { HANDLE_COOKIE } from "@/lib/server/session";
import { HANDLE_RE, normalizeHandle } from "@/lib/shaft/rules";

export const runtime = "nodejs";

// Who this browser is claiming to be. The cookie is httpOnly, so this is the only way to ask.
export async function GET(request: NextRequest) {
  return NextResponse.json({ handle: request.cookies.get(HANDLE_COOKIE)?.value ?? null });
}

// A typed handle is a claim, not a proof. Nothing here verifies the person typing it owns
// the account, so the post gate carries that weight instead: it requires the post to be
// authored by this handle before a run can reach the boards or take a spot.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const handle = normalizeHandle(String(body?.handle ?? ""));
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json(
      { ok: false, reason: "An X handle is 1 to 15 letters, numbers or underscores." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true, handle });
  response.cookies.set(HANDLE_COOKIE, handle, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Longer than the window, so nobody is thrown out mid run and loses the run their dig
    // log is held against.
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(HANDLE_COOKIE);
  return response;
}
