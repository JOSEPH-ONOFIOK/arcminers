import { NextResponse, type NextRequest } from "next/server";
import { devSignInAllowed, HANDLE_COOKIE, signInConfigured } from "@/lib/server/session";

export const runtime = "nodejs";

// Who this browser is, and whether signing in is even possible here.
export async function GET(request: NextRequest) {
  return NextResponse.json({
    handle: request.cookies.get(HANDLE_COOKIE)?.value ?? null,
    configured: signInConfigured(),
    devSignIn: devSignInAllowed(),
  });
}
