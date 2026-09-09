import { createHash } from "node:crypto";

/** UTC day key. Seams reset on this boundary, and so does the dig seed. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export type WindowState = "before" | "open" | "closed";

function parse(value: string | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function windowState(now: number): WindowState {
  const open = parse(process.env.ARC_WINDOW_OPEN);
  const close = parse(process.env.ARC_WINDOW_CLOSE);
  // An unset window means development: the shaft is open, so the loop can be
  // worked on without inventing dates.
  if (open !== null && now < open) return "before";
  if (close !== null && now >= close) return "closed";
  return "open";
}

export function windowBounds(): { open: number | null; close: number | null } {
  return { open: parse(process.env.ARC_WINDOW_OPEN), close: parse(process.env.ARC_WINDOW_CLOSE) };
}

// The digest one dig resolves from.
export function digDigest(handle: string, seq: number, committedAt: number): string {
  const secret = process.env.ARC_SEED_SECRET ?? "shaft-development-secret";
  return createHash("sha256")
    .update(`${secret}|${handle.toLowerCase()}|${seq}|${committedAt}`)
    .digest("hex");
}
