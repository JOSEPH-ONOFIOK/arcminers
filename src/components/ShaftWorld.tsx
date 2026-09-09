"use client";

import { useEffect, useRef } from "react";
import { TIER_RULES, type Tier } from "@/lib/shaft/rules";

const RINGS = 34;

type Glint = { ring: number; edge: number; offset: number; size: number };

const GLINTS: Glint[] = Array.from({ length: 90 }, (_, i) => {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  const r = n - Math.floor(n);
  const m = Math.sin(i * 78.233) * 12345.6789;
  const s = m - Math.floor(m);
  return {
    ring: i % RINGS,
    edge: Math.floor(r * 4),
    offset: s,
    size: s > 0.85 ? 3 : 2,
  };
});

export function ShaftWorld({ tier, falling }: { tier: Tier; falling: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tierRef = useRef(tier);
  const fallRef = useRef(0);
  const lastFall = useRef(falling);

  tierRef.current = tier;
  if (falling !== lastFall.current) {
    lastFall.current = falling;
    fallRef.current = 1;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let progress = 0;
    let last = performance.now();
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      const delta = Math.min(64, time - last);
      last = time;

      const rule = TIER_RULES[tierRef.current];
      const glow = rule.glow;
      const lit = rule.glowStrength;

      // A descent shoves the shaft past you, then settles back to the drift.
      const surge = fallRef.current;
      if (surge > 0) fallRef.current = Math.max(0, surge - delta / 900);
      const speed = 0.000045 + surge * 0.0011;
      progress = (progress + delta * speed) % 1;

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height * 0.42;
      const reach = Math.max(width, height) * 0.95;

      const floor = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
      floor.addColorStop(0, "#000000");
      floor.addColorStop(0.55, "#0d0b09");
      floor.addColorStop(1, "#15120e");
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < RINGS; i++) {
        const z = ((i / RINGS + progress) % 1) ** 2.4;
        const w = reach * z * 1.5;
        const h = w * (height / width) * 1.15;
        const x = cx - w / 2;
        const y = cy - h / 2;
        const near = Math.min(1, z * 2.4);

        ctx.strokeStyle = `rgba(${58 + lit * 40}, ${50 + lit * 26}, ${42 + lit * 10}, ${0.06 + near * 0.3})`;
        ctx.lineWidth = 1 + z * 2.5;
        ctx.strokeRect(x, y, w, h);

        // Strata: a heavier band every few rings, so depth reads as rock layers
        // rather than an abstract tunnel.
        if (i % 5 === 0) {
          ctx.strokeStyle = `rgba(20, 16, 12, ${0.2 + near * 0.45})`;
          ctx.lineWidth = 3 + z * 7;
          ctx.strokeRect(x, y, w, h);
        }
      }

      // Ore in the walls, brighter the deeper the player is.
      for (const glint of GLINTS) {
        const z = ((glint.ring / RINGS + progress) % 1) ** 2.4;
        const w = reach * z * 1.5;
        const h = w * (height / width) * 1.15;
        const x = cx - w / 2;
        const y = cy - h / 2;
        const near = Math.min(1, z * 2.6);
        if (near < 0.05) continue;

        const px = glint.edge % 2 === 0 ? x + w * glint.offset : glint.edge === 1 ? x + w : x;
        const py = glint.edge % 2 === 0 ? (glint.edge === 0 ? y : y + h) : y + h * glint.offset;

        ctx.fillStyle = glow;
        ctx.globalAlpha = near * (0.18 + lit * 0.55);
        const size = glint.size * (0.5 + z * 2.5);
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      // The lamp: what the miner is carrying, and the only warm light down here.
      const lamp = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 0.5);
      lamp.addColorStop(0, `${glow}${lit > 0 ? "2e" : "16"}`);
      lamp.addColorStop(1, "#00000000");
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, width, height);

      if (!still) frame = requestAnimationFrame(draw);
    };

    resize();
    // Reduced motion draws a single frame, so a resize has to ask for another
    // one or the canvas is left cleared.
    const onResize = () => {
      resize();
      if (still) requestAnimationFrame(draw);
    };
    window.addEventListener("resize", onResize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="world" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="world-grain" />
      <div className="world-vignette" />
    </div>
  );
}

export function DepthRail({ tier, deepest }: { tier: Tier; deepest: Tier }) {
  const order: Tier[] = ["surface", "cave", "deep", "core"];
  return (
    <div className="rail" aria-hidden="true">
      {order.map((step) => (
        <div
          key={step}
          className="rail-step"
          data-tier={step}
          data-here={step === tier}
          data-reached={order.indexOf(step) <= order.indexOf(deepest)}
        >
          <span className="rail-dot" />
          <span className="rail-label">{TIER_RULES[step].label}</span>
        </div>
      ))}
    </div>
  );
}
