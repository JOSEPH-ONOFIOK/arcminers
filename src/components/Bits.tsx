"use client";

import { TIER_RULES, type Tier } from "@/lib/shaft/rules";

export function TierChip({ tier }: { tier: Tier }) {
  return (
    <span className="tier" data-tier={tier}>
      {TIER_RULES[tier].label}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  hot,
}: {
  label: string;
  value: string;
  sub?: string;
  hot?: boolean;
}) {
  return (
    <div className="stat" data-hot={hot}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value} {sub ? <small>{sub}</small> : null}
      </span>
    </div>
  );
}

export function Miner({ svg }: { svg: string }) {
  return <div className="miner" dangerouslySetInnerHTML={{ __html: svg }} />;
}
