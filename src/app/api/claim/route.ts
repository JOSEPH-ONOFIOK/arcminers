import { NextResponse } from "next/server";
import { guard } from "@/lib/server/respond";
import { currentHandle } from "@/lib/server/session";
import { ALLOWLIST_OPEN, SPOTS, WALLET_RE } from "@/lib/shaft/rules";
import { sigil } from "@/lib/shaft/tag";
import { hashString } from "@/lib/shaft/rng";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

// Claim a spot.
export async function POST(request: Request) {
  return guard(async () => {
    if (!ALLOWLIST_OPEN) {
      return NextResponse.json({ ok: false, reason: "Claims are closed." }, { status: 403 });
    }

    const handle = await currentHandle();
    if (!handle) return NextResponse.json({ ok: false, reason: "Sign in first." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const wallet = String(body?.wallet ?? "").trim();
    if (!WALLET_RE.test(wallet)) {
      return NextResponse.json({ ok: false, reason: "That isn't an EVM address." }, { status: 400 });
    }

    const store = getStore();
    // No gate, no spot. The entry is only written by the verify route, so this is
    // a real check rather than a client-supplied claim of having posted.
    const entry = await store.getEntry(handle);
    if (!entry) {
      return NextResponse.json(
        { ok: false, reason: "Clear the post gate first." },
        { status: 403 },
      );
    }

    const result = await store.joinAllowlist(handle, wallet, sigil(hashString(`${handle}|${wallet}`)));
    if (!result.ok) {
      const reason =
        result.taken === "wallet"
          ? "That wallet already holds a spot."
          : result.taken === "handle"
            ? "You already hold a spot."
            : "Every spot is taken.";
      return NextResponse.json({ ok: false, reason, taken: result.taken }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      claim: result.claim,
      spotsTotal: SPOTS.total,
  });
  });
}
