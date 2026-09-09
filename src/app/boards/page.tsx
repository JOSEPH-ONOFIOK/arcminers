"use client";

import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { TierChip } from "@/components/Bits";
import { BOARDS, BOARD_LABELS, RIG_RULES, SPOTS, type Board } from "@/lib/shaft/rules";
import type { BoardsView } from "@/lib/shaft/state";

const MEASURE: Record<Board, string> = {
  richest: "Ore banked",
  deepest: "Weighted depth",
  watch: "Shield value",
};

const EXPLAINER: Record<Board, string> = {
  richest: "Total Ore banked over the window. Prospectors and Drillers.",
  deepest: "Deepest tier held, with seconds there breaking the tie. Blasters.",
  watch: "Cave-ins absorbed for other people, weighted by how deep they were. Wardens only.",
};

export default function BoardsPage() {
  const [data, setData] = useState<(BoardsView & { spotsTotal: number }) | null>(null);
  const [board, setBoard] = useState<Board>("richest");
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    // Polls at a third of the shaft's rate: a board is read, not operated, and
    // ranking a few thousand rows is the most expensive read on the site.
    const load = () => {
      fetch("/api/boards", { cache: "no-store" })
        .then((response) => response.json())
        .then(setData)
        .catch(() => {});
      fetch("/api/auth/x/me")
        .then((response) => response.json())
        .then((session) => setHandle(session.handle))
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 45_000);
    return () => clearInterval(timer);
  }, []);

  const standings = data?.boards[board] ?? [];

  return (
    <div className="page">
      <SiteNav handle={handle} />
      <div className="stack-lg">
        <header className="stack">
          <span className="eyebrow">
            {data ? `${data.entrants} entrants · ${data.spotsTaken}/${SPOTS.total} spots claimed` : "Loading"}
          </span>
          <h1>The boards</h1>
          <p className="lede">
            Three boards, because one would collapse the four rigs into a single optimal build.
            Every board resolves to the same standing out of 1000, so a Warden and a Blaster can be
            compared for a spot without pretending they played the same game.
          </p>
        </header>

        <div className="stack">
          <div className="tabs">
            {BOARDS.map((option) => (
              <button
                key={option}
                className="tab"
                data-active={board === option}
                onClick={() => setBoard(option)}
              >
                {BOARD_LABELS[option]}
              </button>
            ))}
          </div>
          <p className="note">{EXPLAINER[board]}</p>
        </div>

        <div className="scroller">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Miner</th>
                <th>Rig</th>
                <th>Tier</th>
                <th className="num">{MEASURE[board]}</th>
                <th className="num">Likes</th>
                <th className="num">Standing</th>
              </tr>
            </thead>
            <tbody>
              {standings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: "var(--dim)" }}>
                    Nobody on this board yet.
                  </td>
                </tr>
              ) : (
                standings.map((standing) => {
                  const mine = handle?.toLowerCase() === standing.handle.toLowerCase();
                  return (
                    <tr key={standing.handle}>
                      <td>{standing.rank}</td>
                      <td className={mine ? "you" : undefined}>
                        @{standing.handle}
                        {standing.verified ? "" : " ·"}
                      </td>
                      <td>{RIG_RULES[standing.rig].label}</td>
                      <td>
                        <TierChip tier={standing.tier} />
                      </td>
                      <td className="num">{Math.round(standing.primary).toLocaleString()}</td>
                      <td className="num">{standing.likes}</td>
                      <td className="num">{standing.standing.toFixed(1)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="note">
          A trailing dot means the post gate has not been cleared. That run is ranked, but it
          cannot take a spot. Spots go to the top {SPOTS.richest} of Richest, the top{" "}
          {SPOTS.deepest} of Deepest, the top {SPOTS.watch} of The Watch, and{" "}
          {SPOTS.lottery} by standing-weighted lottery among everyone else who cleared the gate and
          banked something.
        </p>
      </div>
    </div>
  );
}
