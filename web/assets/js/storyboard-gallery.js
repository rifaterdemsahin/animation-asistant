// Storyboard Gallery: lists every storyboard image across all projects,
// grouped by project. Shows ONE project at a time with Previous/Next paging.
// Each image has a copy-to-clipboard button (image data → clipboard).
const api = "/api";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fileName(path) { var i = String(path).lastIndexOf("/"); return i >= 0 ? path.slice(i + 1) : path; }
function fullUrl(u) { try { return new URL(u, window.location.origin).href; } catch { return u; } }
async function json(url, opts) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

// State: list of projects that have at least one storyboard image, with their
// resolved image versions. currentIdx is the project currently shown.
let groups = [];
let currentIdx = 0;

const ACT_ORDER = ["act-1", "act-2", "act-3"];
function actRank(act) {
  const i = ACT_ORDER.indexOf(act);
  return i >= 0 ? i : ACT_ORDER.length; // legacy/blank sorts last
}
function actLabel(act) {
  switch (act) {
    case "act-1": return "Act 1 — Problem";
    case "act-2": return "Act 2 — Solution";
    case "act-3": return "Act 3 — Lesson";
    default: return "Storyboard";
  }
}

// Sort projects: qN-style ids numerically first, then by title.
function projectCmp(a, b) {
  const an = qNum(a.project_id), bn = qNum(b.project_id);
  if (an && bn) return an - bn;
  if (an && !bn) return -1;
  if (!an && bn) return 1;
  return (a.project_id || "").localeCompare(b.project_id || "");
}
function qNum(id) {
  const m = /^q(\d+)$/.exec(String(id || ""));
  return m ? parseInt(m[1], 10) : 0;
}

// Sort a project's versions: by act order, then newest-first within an act.
function sortVersions(list) {
  return [...list].sort((a, b) => {
    const d = actRank(a.act) - actRank(b.act);
    if (d) return d;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

// Context-aware copy: image data → clipboard, fallback to URL.
function flash(btn, msg, ok) {
  if (!btn) return;
  const old = btn.dataset.label || btn.textContent;
  btn.textContent = ok ? "✅ " + msg : "❌ failed";
  setTimeout(() => { btn.textContent = old; }, 1500);
}
async function copyImage(url, btn) {
  try {
    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
      const resp = await fetch(url, { credentials: "same-origin" });
      if (!resp.ok) throw new Error("fetch failed");
      const blob = await resp.blob();
      const mime = (blob.type && blob.type.indexOf("image/") === 0) ? blob.type : "image/png";
      const item = {}; item[mime] = blob;
      await navigator.clipboard.write([new ClipboardItem(item)]);
      flash(btn, "Image copied", true);
      return;
    }
    await navigator.clipboard.writeText(fullUrl(url));
    flash(btn, "URL copied", true);
  } catch (err) {
    try { await navigator.clipboard.writeText(fullUrl(url)); flash(btn, "URL copied", true); }
    catch { flash(btn, "failed", false); }
  }
}

function downloadImage(url, downloadName) {
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  a.click();
}

// One image card.
function imageCard(proj, v) {
  const baseUrl = `${api}/projects/${encodeURIComponent(proj.project_id)}/raw/${v.file}`;
  const bust = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "_t=" + encodeURIComponent(v.created_at || ("v" + v.id));
  const act = v.act || "storyboard";
  const downloadName = `${proj.slug || proj.project_id}-${act}-v${v.id}.png`;

  const card = document.createElement("div");
  card.className = "file-card";
  card.innerHTML = `
    <div class="file-thumb" title="Click to view" style="cursor:zoom-in">
      <img alt="${escapeHtml(act)} v${escapeHtml(String(v.id))}" loading="lazy">
    </div>
    <div class="file-meta">
      <span class="badge">${escapeHtml(actLabel(v.act))} · v${escapeHtml(String(v.id))}</span>
      <div class="muted" style="font-size:11px;margin-top:4px">${escapeHtml(v.created_at || "")}${v.image_model ? " · " + escapeHtml(v.image_model) : ""}</div>
    </div>
    <div class="file-actions">
      <button class="btn sbg-copy" data-label="📋 Copy">📋 Copy</button>
      <button class="btn sbg-view">🔍 View</button>
      <button class="btn sbg-dl">⬇️</button>
    </div>`;

  const img = card.querySelector("img");
  img.src = bust;
  img.onerror = () => { img.alt = "image not found"; img.removeAttribute("src"); img.style.height = "120px"; img.style.background = "#0b0d12"; };

  card.querySelector(".file-thumb").addEventListener("click", () => openModal(proj, v, bust));
  card.querySelector(".sbg-view").addEventListener("click", () => openModal(proj, v, bust));
  card.querySelector(".sbg-copy").addEventListener("click", (e) => copyImage(bust, e.currentTarget));
  card.querySelector(".sbg-dl").addEventListener("click", () => downloadImage(bust, downloadName));
  return card;
}

// Full-size preview modal (reuses shared .modal-overlay / .modal CSS).
function openModal(proj, v, url) {
  const existing = document.getElementById("sbg-modal");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "sbg-modal";
  overlay.innerHTML = `
    <div class="modal" style="max-width:820px">
      <div class="modal-header">
        <h2>${escapeHtml(actLabel(v.act))} · v${escapeHtml(String(v.id))} <span class="badge">${escapeHtml(proj.title || proj.project_id)}</span></h2>
        <button class="modal-close" id="sbg-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="section"><img src="${url}" alt="${escapeHtml(v.act || "storyboard")}" style="max-width:100%;border-radius:8px;display:block;margin:0 auto"></div>
        ${v.image_prompt ? `<div class="section"><h3>Image prompt</h3><pre style="white-space:pre-wrap;word-break:break-word;font-size:12px;margin:0;max-height:220px;overflow:auto;background:var(--panel-2);padding:10px;border-radius:6px">${escapeHtml(v.image_prompt)}</pre></div>` : ""}
      </div>
      <div class="modal-footer">
        <button class="btn sbg-copy">📋 Copy image</button>
        <button class="btn sbg-dl">⬇️ Download</button>
      </div>
    </div>`;
  document.body.append(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#sbg-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
  const dlName = `${proj.slug || proj.project_id}-${v.act || "storyboard"}-v${v.id}.png`;
  overlay.querySelector(".sbg-copy").addEventListener("click", (e) => copyImage(url, e.currentTarget));
  overlay.querySelector(".sbg-dl").addEventListener("click", () => downloadImage(url, dlName));
}

function renderProject() {
  if (!groups.length) return;
  const proj = groups[currentIdx];
  document.getElementById("cur-title").textContent = proj.title || proj.project_id;
  const idStr = proj.project_id + (proj.slug && proj.slug !== proj.project_id ? " · " + proj.slug : "");
  document.getElementById("cur-meta").textContent = `Project ${currentIdx + 1} of ${groups.length} — ${idStr}`;
  document.getElementById("cur-count").textContent = `${proj.versions.length} image${proj.versions.length === 1 ? "" : "s"}`;

  const wrap = document.getElementById("images-wrap");
  wrap.innerHTML = "";
  for (const v of proj.versions) wrap.append(imageCard(proj, v));

  document.getElementById("prev-btn").disabled = currentIdx === 0;
  document.getElementById("next-btn").disabled = currentIdx === groups.length - 1;
  document.getElementById("pager-info").textContent = `${currentIdx + 1} / ${groups.length}`;
  const picker = document.getElementById("project-picker");
  if (picker) picker.value = String(currentIdx);

  // Persist last-viewed position in the URL hash (e.g. #2).
  if (history.replaceState) history.replaceState(null, "", "#" + (currentIdx + 1));
}

function buildPicker() {
  const picker = document.getElementById("project-picker");
  picker.innerHTML = "";
  groups.forEach((g, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${g.title || g.project_id} · ${g.project_id} (${g.versions.length})`;
    picker.append(opt);
  });
  picker.addEventListener("change", () => {
    currentIdx = parseInt(picker.value, 10) || 0;
    renderProject();
  });
}

async function load() {
  try {
    const data = await json(`${api}/projects`);
    const projects = (data.projects || []).filter(p => p.project_id);
    // Fetch storyboard versions for each project in parallel.
    const results = await Promise.all(projects.map(async (p) => {
      try {
        const sb = await json(`${api}/projects/${encodeURIComponent(p.project_id)}/storyboard`);
        return { project: p, versions: sb.versions || [] };
      } catch { return { project: p, versions: [] }; }
    }));
    groups = results
      .filter(r => r.versions.length > 0)
      .map(r => ({
        project_id: r.project.project_id,
        slug: r.project.slug,
        title: r.project.title,
        versions: sortVersions(r.versions),
      }))
      .sort(projectCmp);

    document.getElementById("loading").classList.add("hidden");
    if (!groups.length) {
      document.getElementById("empty").classList.remove("hidden");
      return;
    }

    // Restore position from URL hash (#N, 1-indexed).
    const hashIdx = parseInt((location.hash || "").replace("#", ""), 10);
    currentIdx = (hashIdx >= 1 && hashIdx <= groups.length) ? hashIdx - 1 : 0;

    document.getElementById("gallery").classList.remove("hidden");
    buildPicker();
    renderProject();

    document.getElementById("prev-btn").addEventListener("click", () => {
      if (currentIdx > 0) { currentIdx--; renderProject(); }
    });
    document.getElementById("next-btn").addEventListener("click", () => {
      if (currentIdx < groups.length - 1) { currentIdx++; renderProject(); }
    });
    // Keyboard paging (left/right) when no modal/input is focused.
    document.addEventListener("keydown", (e) => {
      if (document.getElementById("sbg-modal")) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (e.key === "ArrowLeft" && currentIdx > 0) { currentIdx--; renderProject(); }
      if (e.key === "ArrowRight" && currentIdx < groups.length - 1) { currentIdx++; renderProject(); }
    });
  } catch (err) {
    document.getElementById("loading").classList.add("hidden");
    const empty = document.getElementById("empty");
    empty.classList.remove("hidden");
    empty.querySelector("p").textContent = "Failed to load storyboard images: " + err.message;
  }
}

document.addEventListener("layout:ready", load);
