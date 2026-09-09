"use client";

import { useState } from "react";
import { HANDLE_RE, normalizeHandle } from "@/lib/shaft/rules";

export function SignIn({ onDone }: { onDone: () => void }) {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clean = normalizeHandle(handle);
  const valid = HANDLE_RE.test(clean);

  async function submit() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: clean }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (data.ok) onDone();
    else setError(data.reason ?? "Could not start a run.");
  }

  return (
    <div className="panel">
      <div className="stack">
        <span className="eyebrow">Step 01 · Identity</span>
        <h2>Light your lamp</h2>
        <p className="note">
          A run is held against an X handle from its first pick, so it has to be named before the
          shaft opens. Use the handle you intend to post from. Clearing the post gate later
          requires a post authored by this exact account, so a handle you do not own gets you as
          far as the boards and no further.
        </p>
      </div>

      <div className="row">
        <input
          type="text"
          value={handle}
          placeholder="@yourhandle"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setHandle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && valid && !busy) submit();
          }}
          style={{ maxWidth: 260 }}
        />
        <button className="btn" data-kind="primary" disabled={!valid || busy} onClick={submit}>
          Enter the shaft
        </button>
      </div>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
