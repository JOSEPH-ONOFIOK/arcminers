"use client";

import { useState } from "react";
import { countdown, type ActionResult } from "@/lib/client/useShaft";
import { SHIELD_COST_PICKS, SHIELD_HOURS } from "@/lib/shaft/rules";
import type { ShaftState } from "@/lib/shaft/state";

// A Warden's whole game.
export function WardenPanel({
  state,
  act,
  busy,
}: {
  state: ShaftState;
  act: (path: string, body?: unknown) => Promise<ActionResult>;
  busy: boolean;
}) {
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const player = state.player!;
  const picks = state.picks!;
  const live = state.placed.filter((shield) => !shield.consumed && shield.expiresAt > state.now);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>The Watch</h2>
        <span className="eyebrow">Shield value {player.shieldValue.toLocaleString()}</span>
      </div>
      <p className="note">
        {SHIELD_COST_PICKS} picks places a {SHIELD_HOURS} hour shield on another miner. It absorbs
        exactly one collapse, and you are paid what it saved. Deeper collapses are worth more. You
        cannot shield yourself, and you cannot stack two on the same person.
      </p>

      <div className="row">
        <input
          type="text"
          value={target}
          placeholder="handle to cover"
          onChange={(event) => setTarget(event.target.value)}
          style={{ maxWidth: 240 }}
        />
        <button
          className="btn"
          disabled={busy || !target || picks.available < SHIELD_COST_PICKS}
          onClick={async () => {
            const result = await act("/api/shield", { target });
            setMessage(result.ok ? `Shield placed on @${target}.` : (result.reason ?? null));
            if (result.ok) setTarget("");
          }}
        >
          Place shield, {SHIELD_COST_PICKS} picks
        </button>
      </div>
      {message ? <span className={message.startsWith("Shield") ? "ok" : "error"}>{message}</span> : null}

      {live.length > 0 ? (
        <div className="log">
          {live.map((shield) => (
            <div key={`${shield.target}-${shield.expiresAt}`} className="log-row">
              <span className="log-seq">◈</span>
              <span>@{shield.target}</span>
              <span className="mono" style={{ color: "var(--dim)" }}>
                {countdown(shield.expiresAt - state.now)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {state.placed.some((shield) => shield.consumed) ? (
        <p className="ok">
          {state.placed.filter((shield) => shield.consumed).length} of your shields have been spent
          holding somebody&rsquo;s roof up.
        </p>
      ) : null}
    </div>
  );
}
