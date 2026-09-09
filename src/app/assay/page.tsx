"use client";

import { useCallback, useEffect, useState } from "react";
import { Miner, TierChip } from "@/components/Bits";
import { SiteNav } from "@/components/SiteNav";
import { PROJECT_HANDLE } from "@/lib/shaft/tag";
import { SPOTS, WALLET_RE } from "@/lib/shaft/rules";
import type { AssayView, ShaftState } from "@/lib/shaft/state";

export default function AssayPage() {
  const [assay, setAssay] = useState<AssayView | null>(null);
  const [state, setState] = useState<ShaftState | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/shaft", { cache: "no-store" })
      .then((response) => response.json())
      .then(setState)
      .catch(() => {});
    fetch("/api/assay", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => (data.ok ? setAssay(data.assay) : setReason(data.reason)))
      .catch(() => setReason("Couldn't reach the shaft."));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="page">
      <SiteNav handle={state?.handle ?? null} />
      <div className="stack-lg">
        <header className="stack">
          <span className="eyebrow">Step 05 · Assay</span>
          <h1>The log is the drawing</h1>
          <p className="lede">
            Every pick, patch, payout and collapse, in order, hashed into one seed. The same run
            always assays to the same miner, and no two runs collide.
          </p>
        </header>

        {reason ? <div className="panel"><p className="note">{reason}</p></div> : null}

        {assay ? (
          <>
            <div className="grid-2">
              <div className="panel">
                <Miner svg={assay.svg} />
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="mono" style={{ color: "var(--bone)" }}>{assay.tag}</span>
                  <TierChip tier={assay.tier} />
                </div>
              </div>

              <div className="stack">
                <div className="stats">
                  <div className="stat">
                    <span className="stat-label">Rarity</span>
                    <span className="stat-value">{assay.rarity.toFixed(2)} <small>bits</small></span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Digs</span>
                    <span className="stat-value">{assay.digs}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Collapses</span>
                    <span className="stat-value">{assay.caveIns}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Ore banked</span>
                    <span className="stat-value">{assay.oreBanked.toLocaleString()}</span>
                  </div>
                </div>

                <div className="panel">
                  <h2>Traits</h2>
                  <div className="log">
                    {assay.traitList.map((trait) => (
                      <div key={trait.label} className="log-row" style={{ gridTemplateColumns: "1fr auto" }}>
                        <span className="log-seq">{trait.label}</span>
                        <span style={{ color: "var(--bone)" }}>{trait.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="note">
                    Trait pools are specific to a type. A Prospector and a Driller never draw from
                    the same set, so rarity is only ever compared within a type.
                  </p>
                </div>
              </div>
            </div>

            <PostGate assay={assay} state={state} onVerified={load} />
            <ClaimPanel state={state} onClaimed={load} />
          </>
        ) : null}
      </div>
    </div>
  );
}

// The post gate.
function PostGate({
  assay,
  state,
  onVerified,
}: {
  assay: AssayView;
  state: ShaftState | null;
  onVerified: () => void;
}) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verified = Boolean(state?.entry);

  if (verified) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Through the gate</h2>
          <span className="eyebrow">{state?.entry?.tag}</span>
        </div>
        <p className="ok">Verified. Your run is on the boards and can take a spot.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Post it</h2>
        <span className="eyebrow">Step 06 · The gate</span>
      </div>
      <p className="note">
        Post your assay tagging @{PROJECT_HANDLE}, with your dig tag <strong>{assay.tag}</strong> in
        the text. Then paste the link back here. Verification is the only way onto the boards.
      </p>

      <pre
        className="mono"
        style={{
          background: "var(--rock-sunk)",
          border: "1px solid var(--line)",
          padding: 14,
          fontSize: 12,
          overflowX: "auto",
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {assay.postText}
      </pre>

      <div className="row">
        <a className="btn" href={assay.intentUrl} target="_blank" rel="noreferrer">
          Open the compose box
        </a>
      </div>

      <div className="row">
        <input
          type="url"
          value={url}
          placeholder="https://x.com/you/status/…"
          onChange={(event) => setUrl(event.target.value)}
        />
        <button
          className="btn"
          data-kind="primary"
          disabled={busy || !url}
          onClick={async () => {
            setBusy(true);
            const response = await fetch("/api/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ url }),
            });
            const data = await response.json().catch(() => ({}));
            setMessage(data.ok ? "Verified." : (data.reason ?? "Couldn't check that post."));
            setBusy(false);
            if (data.ok) onVerified();
          }}
        >
          Check my post
        </button>
      </div>
      {message ? <span className={message === "Verified." ? "ok" : "error"}>{message}</span> : null}
    </div>
  );
}

function ClaimPanel({ state, onClaimed }: { state: ShaftState | null; onClaimed: () => void }) {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state?.claim) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Spot held</h2>
          <span className="eyebrow mono">{state.claim.sigil}</span>
        </div>
        <p className="ok">
          Position {state.claim.position} of {SPOTS.total}.
        </p>
      </div>
    );
  }

  const gated = !state?.entry;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Claim your spot</h2>
        <span className="eyebrow">
          {state ? `${state.spotsTaken} / ${SPOTS.total} taken` : ""}
        </span>
      </div>
      <p className="note">
        One spot per handle and one per wallet, both enforced inside the write, so two claims
        racing for the last spot can never both win. Your handle comes from your session, never
        from this form.
      </p>
      <div className="row">
        <input
          type="text"
          value={wallet}
          placeholder="0x…"
          onChange={(event) => setWallet(event.target.value)}
          disabled={gated}
        />
        <button
          className="btn"
          data-kind="primary"
          disabled={busy || gated || !WALLET_RE.test(wallet.trim())}
          onClick={async () => {
            setBusy(true);
            const response = await fetch("/api/claim", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ wallet: wallet.trim() }),
            });
            const data = await response.json().catch(() => ({}));
            setMessage(data.ok ? "Claimed." : (data.reason ?? "Couldn't claim."));
            setBusy(false);
            if (data.ok) onClaimed();
          }}
        >
          Claim
        </button>
      </div>
      {gated ? <span className="note">Clear the post gate first.</span> : null}
      {message ? <span className={message === "Claimed." ? "ok" : "error"}>{message}</span> : null}
    </div>
  );
}
