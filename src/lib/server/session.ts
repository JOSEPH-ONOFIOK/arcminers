import { cookies } from "next/headers";
import { normalizeHandle } from "@/lib/shaft/rules";

export const HANDLE_COOKIE = "arc_handle";

/** Whether X sign-in is configured on this deployment. Server-only. */
export function signInConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
}

// Development sign-in without X credentials.
export function devSignInAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ARC_DEV_SIGNIN === "1";
}

export async function currentHandle(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(HANDLE_COOKIE)?.value;
  return raw ? normalizeHandle(raw) : null;
}
