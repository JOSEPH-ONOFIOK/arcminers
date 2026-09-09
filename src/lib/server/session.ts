import { cookies } from "next/headers";
import { normalizeHandle } from "@/lib/shaft/rules";

export const HANDLE_COOKIE = "arc_handle";

// The handle this browser has claimed. It is a claim and nothing more: identity is only
// ever proven at the post gate, which checks the post was authored by this handle.
export async function currentHandle(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(HANDLE_COOKIE)?.value;
  return raw ? normalizeHandle(raw) : null;
}
