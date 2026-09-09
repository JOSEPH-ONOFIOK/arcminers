"use client";

import { useState } from "react";
import { PICK_CAP_HOURS, RIGS, RIG_RULES, type Rig } from "@/lib/shaft/rules";

// The one irreversible decision in the quest.
export function RigPicker({ onPick, busy }: { onPick: (rig: Rig) => void; busy: boolean }) {
  const [selected, setSelected] = useState<Rig | null>(null);

  return (
    <div className="panel">
      <div className="stack">
        <span className="eyebrow">Step 02 · Pick your rig</span>
        <h2>This cannot be changed</h2>
        <p className="note">
          Your rig locks your trait pool, which board you are scored on, and how much the roof
          hates you. Wardens barely mine at all. They spend their picks shielding other people,
          and they are scored on what they save.
        </p>
      </div>

      <div className="rigs">
        {RIGS.map((rig) => {
          const rule = RIG_RULES[rig];
          return (
            <button
              key={rig}
              className="rig"
              data-selected={selected === rig}
              onClick={() => setSelected(rig)}
              aria-pressed={selected === rig}
            >
              <span className="rig-name">{rule.label}</span>
              <span className="note" style={{ fontSize: 13 }}>
                {rule.blurb}
              </span>
              <span className="rig-stats">
                <span>Yield ×{rule.yield.toFixed(2)}</span>
                <span>Descend ×{rule.descend.toFixed(2)}</span>
                <span>Cave-in ×{rule.caveIn.toFixed(2)}</span>
                <span>
                  {rule.picksPerHour} picks/hr · cap {rule.picksPerHour * PICK_CAP_HOURS}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="row">
        <button
          className="btn"
          data-kind="primary"
          disabled={!selected || busy}
          onClick={() => selected && onPick(selected)}
        >
          {selected ? `Enlist as ${RIG_RULES[selected].label}` : "Pick a rig"}
        </button>
        <span className="note">Picks start accruing the moment you enlist.</span>
      </div>
    </div>
  );
}
