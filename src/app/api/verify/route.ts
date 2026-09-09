import { NextResponse } from "next/server";
import { assayFor } from "@/lib/server/assay";
import { ipLimited, guard } from "@/lib/server/respond";
import { currentHandle } from "@/lib/server/session";
import { PROJECT_HANDLE, parsePostUrl } from "@/lib/shaft/tag";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

const OEMBED = "https://publish.x.com/oembed";

/** oEmbed hands back rendered HTML; what matters is the words that were typed. */
function extractText(html: string): string {
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  return paragraph
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fail(reason: string, status = 200) {
  return NextResponse.json({ ok: false, reason }, { status });
}

// Development-only escape hatch.
function bypassed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ARC_SKIP_POST_CHECK === "1";
}

// The post gate.
export async function POST(request: Request) {
  return guard(async () => {
    const handle = await currentHandle();
    if (!handle) return fail("Sign in first.", 401);
    if (ipLimited(request, "verify", 12)) return fail("Slow down, too many checks.", 429);

    const body = await request.json().catch(() => ({}));
    const url = String(body?.url ?? "");
    const post = parsePostUrl(url);
    if (!post) {
      return fail("That does not look like an X post link. It should look like x.com/you/status/123.");
    }

    // A handle is typed, never proven, so this is where identity is actually established: the
    // post has to come from the account the run is held against. Outside the bypass, oEmbed's
    // reported author is checked too, since a URL can name a handle that did not write the post.
    if (post.handle.toLowerCase() !== handle.toLowerCase()) {
      return fail(
        `That post is from @${post.handle}, and this run belongs to @${handle}. Post it from @${handle}.`,
      );
    }

    const player = await getStore().getPlayer(handle);
    if (!player) return fail("No run to verify.", 404);

    const assay = await assayFor(player);

    if (!bypassed()) {
      let payload: { html?: string; author_url?: string };
      try {
        const response = await fetch(
          `${OEMBED}?url=${encodeURIComponent(`https://x.com/${post.handle}/status/${post.id}`)}&omit_script=1&dnt=1`,
          {
            headers: { accept: "application/json", "user-agent": "ArcMinersShaft/1.0" },
            signal: AbortSignal.timeout(10_000),
            cache: "no-store",
          },
        );
        if (response.status === 404) return fail("Can't find that post. Is it public, and is the link right?");
        if (!response.ok) return fail("X wouldn't answer just now. Give it a second and retry.", 502);
        payload = await response.json();
      } catch {
        return fail("Couldn't reach X to check the post. Try again shortly.", 502);
      }

      // A URL can name any handle; oEmbed reports who actually wrote the post. Checking both
      // closes the gap where x.com/someoneelse/status/<id> resolves to a real post.
      const author = payload.author_url?.split("/").filter(Boolean).pop();
      if (author && author.toLowerCase() !== handle.toLowerCase()) {
        return fail(`That post was written by @${author}, and this run belongs to @${handle}.`);
      }

      const text = extractText(payload.html ?? "");
      if (!text.toLowerCase().includes(`@${PROJECT_HANDLE.toLowerCase()}`)) {
        return fail(`Your post needs to tag @${PROJECT_HANDLE}.`);
      }
      if (!text.toUpperCase().includes(assay.tag)) {
        return fail(`Your post is missing its dig tag ${assay.tag}. Copy the text exactly.`);
      }
    }

    const entry = await getStore().saveEntry({
      handle: player.handle,
      digTag: assay.tag,
      seed: assay.seed,
      rig: player.rig,
      tier: assay.tier,
      traits: assay.traits,
      rarity: assay.rarity,
      postId: post.id,
      verifiedAt: Date.now(),
  });

  return NextResponse.json({ ok: true, entry: { tag: entry.digTag, verifiedAt: entry.verifiedAt } });
  });
}
