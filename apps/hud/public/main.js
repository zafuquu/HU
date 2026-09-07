/** HUD consumer: connects to /ws (falls back to /api/state polling) and renders. */
(() => {
  const qs = new URLSearchParams(location.search);
  const usePolling = qs.get("mode") === "overlay" && false; // WS works in overlay too
  const debug = qs.get("debug") === "1" || qs.get("debug") === "true";

  const el = {
    scoreBlue: document.getElementById("score-blue"),
    scoreRed: document.getElementById("score-red"),
    roundChip: document.getElementById("round-chip"),
    roundTimer: document.getElementById("round-timer"),
    spike: document.getElementById("spike-banner"),
    killfeed: document.getElementById("killfeed"),
    pipsBlue: document.getElementById("pips-blue"),
    pipsRed: document.getElementById("pips-red"),
    rosters: document.getElementById("rosters"),
    rosterBlue: document.getElementById("roster-blue"),
    rosterRed: document.getElementById("roster-red"),
    root: document.getElementById("root"),
    debug: document.getElementById("pipeline-debug"),
  };

  // Standard Valorant phase lengths (seconds) used to derive the round timer.
  const PHASE_SECONDS = { shopping: 30, combat: 100, end: 5 };

  let renderedSeq = new Set();
  let liveSeq = 0;
  let framesReceived = 0;
  let wsConnected = false;
  let lastRoundState = null;

  const debugLog = (msg) => {
    if (!debug) return;
    console.debug("[hud]", msg);
  };

  const updateDebugLine = () => {
    if (!debug || !el.debug) return;
    el.debug.style.display = "block";
    el.debug.textContent =
      `ws=${wsConnected ? "on" : "off"} frames=${framesReceived} scene=${el.root?.dataset.scene || "-"}`;
  };

  /** mm:ss countdown from phaseStartedAt + the phase's standard length. */
  function renderTimer(round) {
    if (!el.roundTimer) return;
    const phase = round?.phase ?? "unknown";
    const startedAt = round?.phaseStartedAt ?? null;
    const duration = PHASE_SECONDS[phase];
    if (!startedAt || !duration || phase === "unknown") {
      el.roundTimer.textContent = "--:--";
      el.roundTimer.classList.remove("urgent");
      return;
    }
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const remaining = Math.max(0, duration - elapsed);
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    el.roundTimer.textContent = `${m}:${String(s).padStart(2, "0")}`;
    el.roundTimer.classList.toggle("urgent", remaining <= 10 && remaining > 0);
  }

  /** Group roster into blue/red by teamId, falling back to teamIndex. */
  function splitRoster(roster) {
    const blue = [];
    const red = [];
    for (const p of roster ?? []) {
      const idx = typeof p.teamIndex === "number" ? p.teamIndex : null;
      const isBlue = p.teamId ? String(p.teamId).toLowerCase() === "blue" : idx === 0;
      const isRed = p.teamId ? String(p.teamId).toLowerCase() === "red" : idx === 1;
      if (isBlue || (!isRed && idx === null && blue.length <= red.length)) blue.push(p);
      else red.push(p);
    }
    return { blue, red };
  }

  function renderRosterRow(p) {
    const row = document.createElement("div");
    row.className = "r-row" + (p.isAlive === false ? " dead" : "");
    const name = document.createElement("span");
    name.className = "r-name";
    name.textContent = (p.displayName ?? "?").split("#")[0];
    const agent = document.createElement("span");
    agent.className = "r-agent";
    agent.textContent = p.agentName ?? "";
    row.append(name, agent);
    return row;
  }

  /** Render the team rosters; returns the split (or null when roster is empty). */
  function renderRosters(roster) {
    const { blue, red } = splitRoster(roster);
    const hasRoster = blue.length + red.length > 0;
    if (el.rosters) el.rosters.classList.toggle("hidden", !hasRoster);
    if (!hasRoster) return null;
    if (el.rosterBlue) {
      el.rosterBlue.innerHTML = "";
      for (const p of blue) el.rosterBlue.append(renderRosterRow(p));
    }
    if (el.rosterRed) {
      el.rosterRed.innerHTML = "";
      for (const p of red) el.rosterRed.append(renderRosterRow(p));
    }
    return { blue, red };
  }

  /** Alive pips: roster-derived counts when present, static 5 otherwise. */
  function renderPipsFromRoster(split) {
    if (!split) {
      renderPips(el.pipsBlue, "on-blue", 5);
      renderPips(el.pipsRed, "on-blue", 5);
      return;
    }
    const alive = (list) => list.filter((p) => p.isAlive !== false).length;
    renderPips(el.pipsBlue, "on-blue", Math.max(1, Math.min(5, alive(split.blue) || 5)));
    renderPips(el.pipsRed, "on-blue", Math.max(1, Math.min(5, alive(split.red) || 5)));
  }

  function render(state) {
    if (!state || typeof state !== "object" || state.revision === -1) return;
    framesReceived += 1;

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
    renderTimer(state.round);

    // Scene switch: the projection's derived scene drives which blocks show
    // (same scene contract the site popout consumes).
    const scene = state.scene ?? "";
    if (el.root) el.root.dataset.scene = scene;
    debugLog(`scene=${scene || "-"} phase=${phase} roster=${state.roster?.length ?? 0}`);

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

    // Rosters + roster-driven alive pips (static 5 fallback when empty).
    const split = renderRosters(state.roster);
    renderPipsFromRoster(split);

    // Match winner banner on the post-game scene.
    if (el.roundChip && state.match?.winner && session === "live") {
      el.roundChip.textContent =
        `MATCH OVER · ${state.match.winner === "blue" ? "BLUE" : "RED"} WINS`;
    }
    updateDebugLine();
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

  // Keep the countdown ticking between pushed frames.
  setInterval(() => {
    if (lastRoundState) renderTimer(lastRoundState);
  }, 500);

  function connectWs() {
    const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
    ws.onopen = () => {
      wsConnected = true;
      updateDebugLine();
    };
    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        lastRoundState = parsed.round ?? lastRoundState;
        render(parsed);
      } catch {}
    };
    ws.onclose = () => {
      wsConnected = false;
      updateDebugLine();
      setTimeout(connectWs, 1500);
    };
    ws.onerror = () => ws.close();
  }

  async function pollOnce() {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const parsed = await res.json();
      lastRoundState = parsed.round ?? lastRoundState;
      render(parsed);
    } catch {}
    if (usePolling) setTimeout(pollOnce, 500);
  }

  connectWs();
  pollOnce();
  updateDebugLine();
})();
