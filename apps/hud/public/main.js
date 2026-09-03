/** HUD consumer: connects to /ws (falls back to /api/state polling) and renders. */
(() => {
  const qs = new URLSearchParams(location.search);
  const usePolling = qs.get("mode") === "overlay" && false; // WS works in overlay too

  const el = {
    scoreBlue: document.getElementById("score-blue"),
    scoreRed: document.getElementById("score-red"),
    roundChip: document.getElementById("round-chip"),
    spike: document.getElementById("spike-banner"),
    killfeed: document.getElementById("killfeed"),
    pipsBlue: document.getElementById("pips-blue"),
    pipsRed: document.getElementById("pips-red"),
  };

  let renderedSeq = new Set();
  let liveSeq = 0;

  function render(state) {
    if (!state || typeof state !== "object" || state.revision === -1) return;

    el.scoreBlue.textContent = String(state.score?.blue ?? 0);
    el.scoreRed.textContent = String(state.score?.red ?? 0);

    const phase = state.round?.phase ?? "unknown";
    const num = state.round?.number ?? 0;
    const session = state.sessionPhase ?? "idle";
    el.roundChip.textContent =
      session !== "live"
        ? `menu / ${session}`
        : num > 0
          ? `R${num} · ${phase}`
          : "connecting…";

    el.spike.classList.toggle("hidden", state.spike !== "planted");

    // Killfeed: only add entries we have not rendered yet.
    for (const kf of state.killfeed ?? []) {
      if (renderedSeq.has(kf.seq)) continue;
      renderedSeq.add(kf.seq);
      if (kf.seq < liveSeq) continue; // backfill after reconnect -> skip stale
      const div = document.createElement("div");
      div.className = "kf-entry";
      div.innerHTML = "";
      const a = span(kf.attacker, "attacker");
      const w = span(`[${kf.weapon}]`, "weapon");
      const v = span(kf.victim, "victim");
      div.append(a, w, v);
      if (kf.modifier && kf.modifier !== "bodyshot") {
        div.append(span(kf.modifier.toUpperCase(), "mod"));
      }
      el.killfeed.prepend(div);
      setTimeout(() => div.remove(), 7500);
    }
    liveSeq = Math.max(liveSeq, ...((state.killfeed ?? []).map((k) => k.seq) || [0]));

    renderPips(el.pipsBlue, "on-blue", 5);
    renderPips(el.pipsRed, "on-blue", 5);
  }

  function span(text, cls) {
    const s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    return s;
  }

  /** Alive pips are roster-derived when present; placeholder of 5 otherwise. */
  function renderPips(container, clsOn, count) {
    container.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement("div");
      p.className = `pip ${clsOn}`;
      container.appendChild(p);
    }
  }

  function connectWs() {
    const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
    ws.onmessage = (ev) => {
      try { render(JSON.parse(ev.data)); } catch {}
    };
    ws.onclose = () => setTimeout(connectWs, 1500);
    ws.onerror = () => ws.close();
  }

  async function pollOnce() {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      render(await res.json());
    } catch {}
    if (usePolling) setTimeout(pollOnce, 500);
  }

  connectWs();
  pollOnce();
})();
