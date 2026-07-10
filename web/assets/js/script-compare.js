// Compare Script Models — OpenRouter (Gemini) vs DeepSeek.
// Runs the same act's script prompt through both providers in parallel and
// shows the generated scripts side by side with latency / length stats.
const api = "/api";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
async function json(url, opts) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}
function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Working…"; }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
}

let projects = [];
let modelsInfo = {};
const ACT_TITLES = { "act-1": "Act 1 — Problem", "act-2": "Act 2 — Solution", "act-3": "Act 3 — Lesson" };

async function loadModels() {
  try {
    modelsInfo = await json("/api/models") || {};
  } catch {}
  const note = document.getElementById("ds-note");
  const ds = modelsInfo.deepseek || {};
  if (!ds.configured) {
    note.innerHTML = "⚠️ DeepSeek is <strong>not configured</strong> (<code>DEEPSEEK_API_KEY</code> missing) — its column will error. Get keys at <a href=\"https://platform.deepseek.com/api_keys\" target=\"_blank\">platform.deepseek.com/api_keys</a>.";
  } else {
    note.innerHTML = `DeepSeek model: <code>${escapeHtml(ds.model || "deepseek-chat")}</code> · OpenRouter model: <code>${escapeHtml(modelsInfo.text || "google/gemini-3.5-flash")}</code>.`;
  }
}

async function loadProjects() {
  const cur = (window.currentProject && window.currentProject()) || null;
  try {
    const data = await json(`${api}/projects`);
    projects = (data.projects || []).filter(p => p.project_id);
    projects.sort((a, b) => {
      const an = parseQN(a.project_id), bn = parseQN(b.project_id);
      if (an && bn) return an - bn;
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return (a.title || "").localeCompare(b.title || "");
    });
  } catch (err) {
    document.getElementById("status").textContent = "Failed to load projects: " + err.message;
    return;
  }
  if (!projects.length) {
    document.getElementById("status").textContent = "No projects available.";
    return;
  }
  document.getElementById("no-project").classList.add("hidden");
  document.getElementById("controls").classList.remove("hidden");
  const sel = document.getElementById("project-sel");
  sel.innerHTML = projects.map(p =>
    `<option value="${escapeHtml(p.project_id)}">${escapeHtml(p.title || p.project_id)} (${escapeHtml(p.project_id)})</option>`).join("");
  if (cur && cur.project_id && projects.some(p => p.project_id === cur.project_id)) {
    sel.value = cur.project_id;
  }
}

function parseQN(id) {
  const m = /^q(\d+)$/.exec(String(id || ""));
  return m ? parseInt(m[1], 10) : 0;
}

function stat(label, value, cls) {
  return `<div class="stat"><div class="label">${label}</div><div class="value ${cls || ""}">${value}</div></div>`;
}

function providerCard(title, badgeClass, res) {
  const card = document.createElement("div");
  card.className = "sc-card";
  if (!res) {
    card.innerHTML = `<h3>${title}</h3><p class="muted">No result.</p>`;
    return card;
  }
  const sec = (res.elapsed_ms / 1000).toFixed(2);
  const body = res.ok
    ? `<pre>${escapeHtml(res.markdown || "(empty)")}</pre>`
    : `<p class="err">❌ ${escapeHtml(res.error || "failed")}</p>`;
  card.innerHTML = `
    <h3><span class="${badgeClass}">${title}</span> <code>${escapeHtml(res.model || "?")}</code></h3>
    <div class="meta">
      <span>⏱ ${escapeHtml(sec)}s</span>
      <span>📝 ${res.chars != null ? res.chars : (res.markdown ? res.markdown.length : 0)} chars</span>
      <span>${res.ok ? "✅ ok" : "❌ error"}</span>
    </div>
    ${body}`;
  return card;
}

async function runCompare() {
  const pidVal = document.getElementById("project-sel").value;
  const act = document.getElementById("act-sel").value;
  if (!pidVal) return;

  // Pull current Q&A from the project so the comparison uses fresh inputs.
  let question = "", answer = "", why = "";
  try {
    const p = await json(`${api}/projects/${pidVal}`);
    question = p.question || "";
    answer = p.answer || "";
    why = p.why || "";
  } catch {}

  const btn = document.getElementById("run-btn");
  const status = document.getElementById("status");
  const results = document.getElementById("results");
  const stats = document.getElementById("stats");
  setLoading(btn, true);
  status.textContent = `Generating ${ACT_TITLES[act] || act} with both providers in parallel…`;
  stats.innerHTML = "";
  results.innerHTML = `<p class="muted">Running…</p>`;

  try {
    const res = await json(`${api}/projects/${pidVal}/script/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ act, question, answer, why }),
    });
    const or = res.openrouter, ds = res.deepseek;
    status.textContent = `Done — ${ACT_TITLES[res.act] || act}.`;

    // Summary stats: latency winner, length delta.
    const orSec = or ? (or.elapsed_ms / 1000).toFixed(2) : "—";
    const dsSec = ds ? (ds.elapsed_ms / 1000).toFixed(2) : "—";
    let latencyWinner = "—";
    if (or && ds && or.ok && ds.ok) {
      latencyWinner = or.elapsed_ms <= ds.elapsed_ms ? "OpenRouter 🟣" : "DeepSeek 🔵";
    }
    const orChars = or && or.ok ? or.chars : 0;
    const dsChars = ds && ds.ok ? ds.chars : 0;
    const lenDelta = (orChars && dsChars) ? (((dsChars - orChars) / orChars) * 100).toFixed(0) + "%" : "—";
    stats.innerHTML =
      stat("OpenRouter latency", orSec + "s") +
      stat("DeepSeek latency", dsSec + "s") +
      stat("Faster", latencyWinner, "winner") +
      stat("OpenRouter length", orChars ? orChars.toLocaleString() + " chars" : "—") +
      stat("DeepSeek length", dsChars ? dsChars.toLocaleString() + " chars" : "—") +
      stat("DeepSeek vs OR length", lenDelta);

    results.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "compare-grid";
    grid.append(providerCard("OpenRouter", "badge-or", or));
    grid.append(providerCard("DeepSeek", "badge-ds", ds));
    results.append(grid);
  } catch (err) {
    results.innerHTML = `<p class="err">Failed: ${escapeHtml(err.message)}</p>`;
    status.textContent = "Error.";
  } finally {
    setLoading(btn, false);
  }
}

document.addEventListener("layout:ready", async () => {
  await loadModels();
  await loadProjects();
  const btn = document.getElementById("run-btn");
  if (btn) btn.addEventListener("click", runCompare);
});
