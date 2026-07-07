// Media Manager: outline + per-act script + typed components + audio.
const api = "/api";
const slug = () => (window.currentProject && window.currentProject() || {}).slug;

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
function selectedActs() {
  return ["act-1", "act-2", "act-3"].filter(k => document.getElementById(k).checked);
}

// --- outline ---
async function loadOutline() {
  try {
    const { outline } = await json(`${api}/projects/${slug()}/outline`);
    if (outline) {
      document.getElementById("outline-out").textContent = JSON.stringify(outline, null, 2);
      document.getElementById("outline-out").classList.remove("hidden");
      document.getElementById("outline-state").textContent = "outline ready";
    }
  } catch {}
}

// --- script ---
function renderScripts(acts) {
  const out = document.getElementById("script-out");
  out.innerHTML = "";
  const order = [["act-1", "Act 1 — Problem"], ["act-2", "Act 2 — Solution"], ["act-3", "Act 3 — Lesson"]];
  let any = false;
  for (const [key, title] of order) {
    if (!acts[key]) continue;
    any = true;
    const div = document.createElement("div");
    div.className = "act";
    div.innerHTML = `<h3>${title}</h3><pre>${escapeHtml(acts[key])}</pre>`;
    out.append(div);
  }
  if (!any) out.innerHTML = `<p class="muted">No script yet — generate one above.</p>`;
}
async function loadScript() {
  try { const { acts } = await json(`${api}/projects/${slug()}/script`); renderScripts(acts || {}); } catch {}
}

// --- components ---
function renderComponents(acts) {
  const out = document.getElementById("components-out");
  out.innerHTML = "";
  const order = [["act-1", "Act 1"], ["act-2", "Act 2"], ["act-3", "Act 3"]];
  let any = false;
  for (const [key, title] of order) {
    const list = acts[key] || [];
    if (!list.length) continue;
    any = true;
    const sec = document.createElement("div");
    sec.className = "panel";
    sec.innerHTML = `<h3>${title}</h3>`;
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const c of list) {
      const card = document.createElement("div");
      card.className = "comp";
      const url = `${api}/projects/${slug()}/raw/${c.file}`;
      card.innerHTML = `<img loading="lazy" src="${url}" alt="${escapeHtml(c.type)}">
        <div class="comp-meta"><span class="badge">${escapeHtml(c.type)}</span>
        <span class="muted">${escapeHtml(c.script_ref || "")}</span></div>`;
      grid.append(card);
    }
    sec.append(grid);
    out.append(sec);
  }
  if (!any) out.innerHTML = `<p class="muted">No components yet — generate above.</p>`;
}
async function loadComponents() {
  try { const { acts } = await json(`${api}/projects/${slug()}/components`); renderComponents(acts || {}); } catch {}
}

// --- audio ---
function renderAudio(audio) {
  const out = document.getElementById("audio-out");
  out.innerHTML = "";
  const order = [["act-1", "Act 1 — Problem"], ["act-2", "Act 2 — Solution"], ["act-3", "Act 3 — Lesson"]];
  let any = false;
  for (const [key, title] of order) {
    if (!audio[key]) continue;
    any = true;
    const url = `${api}/projects/${slug()}/raw/${audio[key]}`;
    const div = document.createElement("div");
    div.className = "act";
    div.innerHTML = `<h3>${title}</h3><audio controls src="${url}"></audio>`;
    out.append(div);
  }
  if (!any) out.innerHTML = `<p class="muted">No audio yet — generate above.</p>`;
}
async function loadAudio() {
  try { const { audio } = await json(`${api}/projects/${slug()}/audio`); renderAudio(audio || {}); } catch {}
}

async function loadBrowse() {
  const out = document.getElementById("files-out");
  try {
    const { files } = await json(`${api}/projects/${slug()}/browse`);
    if (!files || !files.length) { out.innerHTML = `<p class="muted">No files generated yet.</p>`; return; }
    out.innerHTML = files.map(f => {
      if (f.type === "image") return `<div class="file-card"><img loading="lazy" src="${f.url}" alt="${f.path}"><div class="file-meta"><a href="${f.url}" target="_blank">🖼️ ${f.path}</a></div></div>`;
      if (f.type === "audio") return `<div class="file-card"><audio controls src="${f.url}"></audio><div class="file-meta"><a href="${f.url}" target="_blank">🎵 ${f.path}</a></div></div>`;
      return `<div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><a href="${f.url}" target="_blank">${f.path}</a></div></div>`;
    }).join("");
  } catch { out.innerHTML = `<p class="muted">Could not load files.</p>`; }
}

document.addEventListener("layout:ready", () => {
  const s = slug();
  if (!s) return;
  document.getElementById("no-project").classList.add("hidden");
  document.getElementById("manager").classList.remove("hidden");
  const cur = window.currentProject();
  document.getElementById("mm-title").textContent = cur.title + " (" + s + ")";
  document.getElementById("mm-status").textContent = cur.slug;

  document.getElementById("gen-outline").addEventListener("click", async (e) => {
    const btn = e.currentTarget; setLoading(btn, true);
    try {
      const { outline } = await json(`${api}/projects/${s}/outline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      document.getElementById("outline-out").textContent = JSON.stringify(outline, null, 2);
      document.getElementById("outline-out").classList.remove("hidden");
      document.getElementById("outline-state").textContent = "outline ready";
    } catch (err) { alert(err.message); } finally { setLoading(btn, false); }
  });

  document.getElementById("gen-script").addEventListener("click", async (e) => {
    const btn = e.currentTarget; const acts = selectedActs();
    if (!acts.length) { alert("Select at least one act."); return; }
    setLoading(btn, true);
    try {
      await json(`${api}/projects/${s}/script`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts }) });
      await loadScript();
    } catch (err) { alert(err.message); } finally { setLoading(btn, false); }
  });

  document.getElementById("gen-components").addEventListener("click", async (e) => {
    const btn = e.currentTarget; const acts = selectedActs();
    if (!acts.length) { alert("Select at least one act."); return; }
    setLoading(btn, true);
    try {
      await json(`${api}/projects/${s}/components`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts }) });
      await loadComponents();
    } catch (err) { alert(err.message); } finally { setLoading(btn, false); }
  });

  document.getElementById("gen-audio").addEventListener("click", async (e) => {
    const btn = e.currentTarget; const acts = selectedActs();
    if (!acts.length) { alert("Select at least one act."); return; }
    setLoading(btn, true);
    try {
      await json(`${api}/projects/${s}/audio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts }) });
      await loadAudio();
    } catch (err) { alert(err.message); } finally { setLoading(btn, false); }
  });

  document.getElementById("refresh-files").addEventListener("click", () => loadBrowse());

  loadOutline(); loadScript(); loadComponents(); loadAudio(); loadBrowse();
});
