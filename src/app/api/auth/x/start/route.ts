import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { signInConfigured } from "@/lib/server/session";

export const runtime = "nodejs";

/** The PKCE pair and state only need to outlive the round trip to X. */
const HANDSHAKE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(request: NextRequest) {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId || !signInConfigured()) {
    const dest = new URL("/", request.nextUrl.origin);
    dest.searchParams.set("signin", "not_configured");
    return NextResponse.redirect(dest);
  }

  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));

  // Only a same-site path is accepted, so this can't become an open redirect.
  const requested = request.nextUrl.searchParams.get("from") ?? "/";
  const returnTo = /^\/[A-Za-z0-9\-._~/]*$/.test(requested) ? requested : "/";

  const authorize = new URL("https://x.com/i/oauth2/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set(
    "redirect_uri",
    new URL("/api/auth/x/callback", request.nextUrl.origin).toString(),
  );
  authorize.searchParams.set("scope", "users.read tweet.read");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorize);
  response.cookies.set("x_verifier", verifier, HANDSHAKE);
  response.cookies.set("x_state", state, HANDSHAKE);
  response.cookies.set("x_return", returnTo, HANDSHAKE);
  return response;
}
