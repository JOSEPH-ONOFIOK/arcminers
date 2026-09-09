"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShaftState } from "@/lib/shaft/state";

export type ActionResult = { ok: boolean; reason?: string; [key: string]: unknown };

// One poll of `/api/shaft` drives the whole page.
export function useShaft(intervalMs = 15_000) {
  const [state, setState] = useState<ShaftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Held in a ref so the polling effect doesn't restart on every tick.
  const visible = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/shaft", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setState(await response.json());
    } catch {
      // A dropped poll is not worth an error banner, the next one is 15
      // seconds away, and the page a player is looking at is still true.
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVisibility = () => {
      visible.current = document.visibilityState === "visible";
      if (visible.current) refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Polling stops while the tab is hidden: nobody is watching, and a quest
    // window is two weeks of tabs left open in the background.
    const timer = setInterval(() => {
      if (visible.current) refresh();
    }, intervalMs);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, intervalMs]);

  const act = useCallback(
    async (path: string, body?: unknown): Promise<ActionResult> => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const data = (await response.json().catch(() => ({}))) as ActionResult;
        if (!data.ok && data.reason) setError(data.reason);
        await refresh();
        return data;
      } catch {
        const reason = "Couldn't reach the shaft. Try again.";
        setError(reason);
        return { ok: false, reason };
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { state, error, busy, act, refresh, setError };
}

/** A local id for likes. Weak by design, see the note on the like route. */
export function voterId(): string {
  try {
    const existing = localStorage.getItem("arc_voter");
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem("arc_voter", created);
    return created;
  } catch {
    // Private windows and blocked storage throw rather than return null.
    return "anonymous-session";
  }
}

export function countdown(ms: number): string {
  if (ms <= 0) return "0s";
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
