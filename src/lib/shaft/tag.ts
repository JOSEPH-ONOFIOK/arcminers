/** Crockford-ish base32, minus the glyphs people misread (I, L, O, U). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 6;

export const PROJECT_HANDLE = "arcminers";
export const PROJECT_URL = `https://x.com/${PROJECT_HANDLE}`;

function code(seed: number): string {
  let value = seed >>> 0;
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out = ALPHABET[value % ALPHABET.length] + out;
    value = Math.floor(value / ALPHABET.length);
    // Re-stir once the seed is exhausted, so small seeds still fill the code
    // instead of padding with zeroes and colliding with each other.
    if (value === 0) value = (seed >>> 0) ^ (0x9e3779b9 * (i + 1));
  }
  return out;
}

/** Carried on the assay card, and required in the post. */
export function digTag(seed: number): string {
  return `ARC-${code(seed)}`;
}

// Handed back on a successful claim.
export function sigil(seed: number): string {
  return `WL-${code(seed ^ 0x5bf03635)}`;
}

export function composeText(seed: number, tier: string, rig: string): string {
  return [
    `I dug the Proving Shaft as a ${rig}.`,
    `Assayed at ${tier}.`,
    ``,
    `@${PROJECT_HANDLE}`,
    ``,
    digTag(seed),
  ].join("\n");
}

export function intentUrl(seed: number, tier: string, rig: string, siteUrl?: string): string {
  const params = new URLSearchParams({ text: composeText(seed, tier, rig) });
  if (siteUrl) params.set("url", siteUrl);
  return `https://x.com/intent/tweet?${params.toString()}`;
}

/** Pull the handle and status id out of any x.com or twitter.com post URL. */
export function parsePostUrl(input: string): { handle: string; id: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (!["x.com", "twitter.com", "mobile.x.com", "mobile.twitter.com"].includes(host)) return null;

  const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})/);
  return match ? { handle: match[1], id: match[2] } : null;
}
