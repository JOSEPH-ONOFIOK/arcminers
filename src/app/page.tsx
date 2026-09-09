"use client";

import { useEffect, useRef, useState } from "react";
import { Console } from "@/components/Console";
import { RigPicker } from "@/components/RigPicker";
import { Seams } from "@/components/Seams";
import { DepthRail, ShaftWorld } from "@/components/ShaftWorld";
import { SignIn } from "@/components/SignIn";
import { SiteNav } from "@/components/SiteNav";
import { WardenPanel } from "@/components/WardenPanel";
import { countdown, useShaft } from "@/lib/client/useShaft";
import { PATCH_ODDS } from "@/lib/shaft/rules";

export default function ShaftPage() {
  const { state, act, busy, error, refresh } = useShaft();
  const tier = state?.player?.tier ?? "surface";

  // Bumped whenever the tier moves, in either direction. The world reads it as
  // a shove: the shaft rushes past, then settles back to its drift.
  const [drop, setDrop] = useState(0);
  const lastTier = useRef(tier);
  useEffect(() => {
    if (lastTier.current !== tier) {
      lastTier.current = tier;
      setDrop((n) => n + 1);
    }
  }, [tier]);

  if (!state) {
    return (
      <>
        <ShaftWorld tier="surface" falling={0} />
        <div className="page">
          <SiteNav handle={null} />
          <p className="note">Lighting the lamp.</p>
        </div>
      </>
    );
  }

  const closed = state.window.state === "closed";
  const early = state.window.state === "before";

  return (
    <>
      <ShaftWorld tier={tier} falling={drop} />
      {state.player ? <DepthRail tier={tier} deepest={state.player.deepestTier} /> : null}

      <div className="page">
        <SiteNav handle={state.handle} />

        <div className="stack-lg">
          {state.ephemeralStorage ? (
            <div className="panel" data-alarm="true">
              <h2>Storage is not configured</h2>
              <p className="note">
                This deployment has no <code>DATABASE_URL</code>, so it falls back to a JSON file
                store. A serverless filesystem is read only, and instances do not share one, so
                nothing written here survives. Point <code>DATABASE_URL</code> at a pooled Postgres
                connection string and apply <code>src/lib/store/schema.sql</code>.
              </p>
            </div>
          ) : null}

          <header className="stack">
            <span className="eyebrow">Arc Miners · Pre-mint · No wallet, no gas</span>
            <h1>
              Dig first.
              <br />
              Mint later.
            </h1>
            <p className="lede">
              Pick a rig, work the seam, and go as deep as your nerve holds. At the close, your dig
              log becomes the miner you assay: every pick, every payout, every collapse, hashed into
              one seed. Your behaviour is the drawing.
            </p>
          </header>

          {early ? (
            <div className="panel">
              <h2>The shaft is still sealed</h2>
              <p className="note">
                {state.window.open
                  ? `It opens in ${countdown(state.window.open - state.now)}.`
                  : "Dates to be announced."}
              </p>
            </div>
          ) : null}

          {closed ? (
            <div className="panel">
              <h2>The window has closed</h2>
              <p className="note">
                No more digging. Your run is fixed. Assay it, post it, claim your spot.
              </p>
              <div className="row">
                <a className="btn" data-kind="primary" href="/assay">
                  Assay your run
                </a>
              </div>
            </div>
          ) : null}

          {!state.handle ? (
            <SignIn onDone={refresh} />
          ) : !state.player ? (
            <RigPicker busy={busy} onPick={(rig) => act("/api/enlist", { rig })} />
          ) : (
            <div className="grid-2">
              <div className="stack">
                <Seams seams={state.seams} />
                {state.player.rig === "warden" ? (
                  <WardenPanel state={state} act={act} busy={busy} />
                ) : null}
                {state.cover.length > 0 ? (
                  <div className="panel">
                    <h2>Covered</h2>
                    <p className="note">
                      {state.cover.length === 1
                        ? "A Warden has a shield on you."
                        : `${state.cover.length} Wardens have shields on you.`}{" "}
                      The next collapse gets absorbed.
                    </p>
                  </div>
                ) : null}
                <div className="panel">
                  <h2>What the rock holds</h2>
                  <p className="note">
                    Per dig: {Math.round(PATCH_ODDS.dead * 100)}% dead rock,{" "}
                    {Math.round(PATCH_ODDS.ore * 100)}% ore pocket,{" "}
                    {Math.round(PATCH_ODDS.fault * 100)}% fault line. A fault pays nothing and
                    raises your odds until you bank.
                  </p>
                </div>
              </div>
              <Console state={state} act={act} busy={busy} error={error} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
