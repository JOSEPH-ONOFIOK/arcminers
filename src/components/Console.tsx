"use client";

import { useEffect, useRef, useState } from "react";
import { countdown, type ActionResult } from "@/lib/client/useShaft";
import { BANK_COST_PICKS, RIG_RULES, TIER_RULES } from "@/lib/shaft/rules";
import type { DigView, ShaftState } from "@/lib/shaft/state";
import { Stat, TierChip } from "./Bits";

type Verdict = { line: string; detail: string; bad?: boolean; good?: boolean };

function verdictFor(dig: DigView): Verdict {
  if (dig.caveIn) {
    return {
      line: "Cave in",
      detail: "The roof went. You lost the tier and everything loose with it.",
      bad: true,
    };
  }
  if (dig.shielded) {
    return { line: "It held", detail: "The roof went and a Warden's shield ate it. You keep the tier." };
  }
  if (dig.patch === "ore") {
    return { line: `Ore, +${dig.ore}`, detail: "Loose in your pack. A collapse takes all of it.", good: true };
  }
  if (dig.patch === "fault") {
    return { line: "Fault line", detail: "Nothing in it, and the roof is worse for it. Banking clears the fault." };
  }
  return { line: "Dead rock", detail: "Nothing. Swing again." };
}

function patchLabel(dig: DigView): string {
  if (dig.revealedAt === null) return "unresolved";
  if (dig.caveIn) return "cave in";
  if (dig.shielded) return "shield held";
  if (dig.patch === "ore") return "ore pocket";
  if (dig.patch === "fault") return "fault line";
  return "dead rock";
}

export function Console({
  state,
  act,
  busy,
  error,
}: {
  state: ShaftState;
  act: (path: string, body?: unknown) => Promise<ActionResult>;
  busy: boolean;
  error: string | null;
}) {
  const player = state.player!;
  const picks = state.picks!;
  const [now, setNow] = useState(() => Date.now());
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const revealing = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pending = state.pending;
  const waitMs = pending ? pending.revealAt - now : 0;

  useEffect(() => {
    if (!pending || waitMs > 0 || revealing.current === pending.id) return;
    revealing.current = pending.id;
    act("/api/dig/reveal", { id: pending.id }).then((result) => {
      const dig = (result as { dig?: DigView }).dig;
      if (result.ok && dig) setVerdict(verdictFor(dig));
      revealing.current = null;
    });
  }, [pending, waitMs, act]);

  const rig = RIG_RULES[player.rig];
  const canDig = picks.available >= 1 && !pending && state.window.state === "open";

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Picks" value={`${picks.available}`} sub={`/ ${picks.cap}`} />
        <Stat label="Next pick" value={picks.nextPickMs > 0 ? countdown(picks.nextPickMs) : "full"} />
        <Stat label="Banked" value={player.oreBanked.toLocaleString()} sub="safe" />
        <Stat label="Loose" value={player.oreLoose.toLocaleString()} sub="at risk" hot={player.oreLoose > 0} />
        <Stat label="Cave in" value={`${(player.odds * 100).toFixed(1)}%`} sub="per dig" />
        <Stat label="Collapses" value={`${player.caveIns}`} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="row" style={{ gap: 14 }}>
            <h2>{rig.label}</h2>
            <TierChip tier={player.tier} />
          </div>
          <span className="eyebrow">Deepest held: {TIER_RULES[player.deepestTier].label}</span>
        </div>

        {pending ? (
          <div className="stack" style={{ gap: 10 }}>
            <span className="eyebrow">Committed. Waiting on the rock.</span>
            <p className="reveal" data-waiting={waitMs > 0}>
              {waitMs > 0 ? countdown(waitMs) : "resolving"}
            </p>
            <p className="note">
              The outcome does not exist yet, on your machine or ours. Your commit is locked in, and
              the delay is what lets randomness be generated before it resolves. The contract works
              the same way, because Arc exposes no usable native randomness of its own.
            </p>
          </div>
        ) : verdict ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="verdict" data-bad={verdict.bad} data-good={verdict.good}>
              {verdict.line}
            </p>
            <p className="note">{verdict.detail}</p>
          </div>
        ) : (
          <p className="note">
            {player.oreLoose > 0
              ? `${player.oreLoose.toLocaleString()} Ore is loose in your pack. A collapse takes all of it.`
              : "Nothing loose. Swing."}
          </p>
        )}

        <div className="row">
          <button
            className="btn"
            data-kind="primary"
            disabled={!canDig || busy}
            onClick={() => {
              setVerdict(null);
              act("/api/dig");
            }}
          >
            {pending ? "Dig committed" : "Swing, 1 pick"}
          </button>
          <button
            className="btn"
            disabled={busy || player.oreLoose <= 0 || picks.available < BANK_COST_PICKS}
            onClick={() => act("/api/bank")}
          >
            Haul up {player.oreLoose > 0 ? player.oreLoose.toLocaleString() : ""}
          </button>
          {player.nextTier ? (
            <button
              className="btn"
              disabled={busy || player.oreBanked < (player.descendCost ?? Infinity)}
              onClick={() => act("/api/descend")}
            >
              Descend to {TIER_RULES[player.nextTier].label}, {player.descendCost} Ore
            </button>
          ) : (
            <span className="note">You are at the Core. There is nothing under it.</span>
          )}
        </div>

        {player.faultPp > 0 ? (
          <p className="error">
            Fault lines are adding {(player.faultPp * 100).toFixed(0)}pp to your odds. Hauling up
            clears them.
          </p>
        ) : null}
        {error ? <span className="error">{error}</span> : null}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Dig log</h2>
          <span className="eyebrow">{player.digs} swings, kept forever</span>
        </div>
        {state.log.length === 0 ? (
          <p className="note">Nothing yet.</p>
        ) : (
          <div className="log">
            {state.log.map((dig) => (
              <div key={dig.id} className="log-row" data-cave={dig.caveIn}>
                <span className="log-seq">#{dig.seq}</span>
                <span className="log-what">
                  {patchLabel(dig)} · {TIER_RULES[dig.tier].label} · {(dig.odds * 100).toFixed(1)}%
                </span>
                <span className="log-ore">{dig.ore > 0 ? `+${dig.ore}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
