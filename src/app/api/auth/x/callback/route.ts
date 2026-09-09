import { NextResponse, type NextRequest } from "next/server";
import { HANDLE_COOKIE } from "@/lib/server/session";

export const runtime = "nodejs";

function clear(response: NextResponse) {
  response.cookies.delete("x_state");
  response.cookies.delete("x_verifier");
  response.cookies.delete("x_return");
  return response;
}

function fail(origin: string, returnTo: string, reason: string) {
  const dest = new URL(returnTo, origin);
  dest.searchParams.set("signin", reason);
  return clear(NextResponse.redirect(dest));
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const returnTo = request.cookies.get("x_return")?.value ?? "/";

  const oauthError = searchParams.get("error");
  if (oauthError) return fail(origin, returnTo, oauthError);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get("x_state")?.value;
  const verifier = request.cookies.get("x_verifier")?.value;

  if (!code || !state || !expected || !verifier || state !== expected) {
    return fail(origin, returnTo, "state_mismatch");
  }

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(origin, returnTo, "not_configured");

  const token = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: new URL("/api/auth/x/callback", origin).toString(),
      code_verifier: verifier,
    }),
  });
  if (!token.ok) return fail(origin, returnTo, "token_exchange_failed");

  const accessToken: unknown = (await token.json())?.access_token;
  if (typeof accessToken !== "string") return fail(origin, returnTo, "token_exchange_failed");

  const me = await fetch("https://api.x.com/2/users/me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!me.ok) return fail(origin, returnTo, "profile_fetch_failed");

  const username: unknown = (await me.json())?.data?.username;
  if (typeof username !== "string") return fail(origin, returnTo, "profile_fetch_failed");

  const dest = new URL(returnTo, origin);
  dest.searchParams.set("signin", "ok");

  const response = NextResponse.redirect(dest);
  // Only the handle is kept. The access token is deliberately not stored: the
  // shaft never acts on the player's behalf, it only needs to know who they are.
  response.cookies.set(HANDLE_COOKIE, username, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Longer than the window, so nobody is thrown out mid-run and loses the
    // identity their dig log is held against.
    maxAge: 60 * 60 * 24 * 30,
  });
  return clear(response);
}
