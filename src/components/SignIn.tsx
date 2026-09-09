"use client";

import { useState } from "react";
import type { ShaftState } from "@/lib/shaft/state";

// Step one, and it comes before the shaft renders at all.
export function SignIn({ state, onDone }: { state: ShaftState; onDone: () => void }) {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function devSignIn() {
    const response = await fetch("/api/auth/x/dev", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const data = await response.json().catch(() => ({}));
    if (data.ok) onDone();
    else setError(data.reason ?? "Couldn't sign in.");
  }

  return (
    <div className="panel">
      <div className="stack">
        <span className="eyebrow">Step 01 · Identity</span>
        <h2>Light your lamp</h2>
        <p className="note">
          A run is held against an X handle from its first pick. Only the handle is kept. The
          access token is never stored, because the shaft never acts on your behalf.
        </p>
      </div>

      {state.configured ? (
        <a className="btn" data-kind="primary" href="/api/auth/x/start?from=/">
          Sign in with X
        </a>
      ) : (
        <p className="note">
          X sign-in isn&rsquo;t configured on this deployment.{" "}
          {state.devSignIn ? "Use the development sign-in below." : "Set X_CLIENT_ID and X_CLIENT_SECRET."}
        </p>
      )}

      {state.devSignIn ? (
        <div className="stack">
          <span className="eyebrow">Development sign-in</span>
          <div className="row">
            <input
              type="text"
              value={handle}
              placeholder="handle"
              onChange={(event) => setHandle(event.target.value)}
              style={{ maxWidth: 220 }}
            />
            <button className="btn" onClick={devSignIn} disabled={!handle}>
              Sign in
            </button>
          </div>
          {error ? <span className="error">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
