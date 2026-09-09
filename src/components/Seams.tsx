"use client";

import { TIER_RULES } from "@/lib/shaft/rules";
import type { SeamView } from "@/lib/shaft/state";

// How much the field has left to take today.
export function Seams({ seams }: { seams: SeamView[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Today&rsquo;s seams</h2>
        <span className="eyebrow">Resets 00:00 UTC</span>
      </div>
      <div className="stack">
        {seams.map((seam) => {
          const fraction = seam.total > 0 ? seam.remaining / seam.total : 0;
          return (
            <div key={seam.tier} className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <span className="tier" data-tier={seam.tier}>
                  {TIER_RULES[seam.tier].label}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
                  {seam.remaining.toLocaleString()} / {seam.total.toLocaleString()}
                </span>
              </div>
              <div className="meter" data-tier={seam.tier} style={{ ["--tier-color" as string]: TIER_RULES[seam.tier].glow }}>
                <span style={{ width: `${Math.round(fraction * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="note">
        Payout scales with what a seam has left, floored at 25%. Arriving late to a drained tier
        is a bad deal. It is never a wasted pick.
      </p>
    </div>
  );
}
