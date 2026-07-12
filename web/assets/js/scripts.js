// scripts.js — Browse all generated voiceover scripts with pagination, search, copy, cache.
const api = "/api";
const CACHE_KEY = "scripts_cache_v1";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const PAGE_SIZE = 1;

let allScripts = [];
let filtered = [];
let currentPage = 0;
let searchTerm = "";

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const WPS = 2.5;
function estimateSeconds(text) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / WPS);
}
function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? m + "m " + s + "s" : s + "s";
}

async function json(url, opts) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

function getCache() {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function setCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function cacheAgeText() {
  const c = getCache();
  if (!c) return "no cache";
  const age = Math.round((Date.now() - c.ts) / 1000);
  if (age < 60) return age + "s ago";
  return Math.round(age / 60) + "m ago";
}

async function loadScripts(refresh) {
  const cache = getCache();
  const fresh = cache && (Date.now() - cache.ts) < CACHE_TTL;

  if (!refresh && fresh) {
    allScripts = cache.data;
    applySearch();
    return;
  }

  try {
    const data = await json(api + "/scripts");
    allScripts = data.scripts || [];
    setCache(allScripts);
    applySearch();
  } catch (err) {
    const cache = getCache();
    if (cache) { allScripts = cache.data; applySearch(); }
    document.getElementById("script-view").innerHTML = '<p class="error">Failed to load: ' + escapeHtml(err.message) + '</p>';
  }
}

function applySearch() {
  const q = searchTerm.toLowerCase();
  filtered = q ? allScripts.filter(s => {
    const t = (s.project_id + " " + s.title + " " + s.topic).toLowerCase();
    return t.includes(q);
  }) : allScripts;
  currentPage = Math.min(currentPage, Math.max(0, filtered.length - 1));
  if (filtered.length === 0) currentPage = 0;
  render();
}

function render() {
  document.getElementById("count-label").textContent = filtered.length + " scripts";
  document.getElementById("cache-label").textContent = "cached " + cacheAgeText();

  if (filtered.length === 0) {
    document.getElementById("script-view").innerHTML = '<p>No scripts found. Generate scripts first.</p>';
    renderPager("pager-top", 0, 0);
    renderPager("pager-bottom", 0, 0);
    return;
  }

  const idx = currentPage;
  const s = filtered[idx];
  const total = filtered.length;

  let html = '<div class="script-card">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">';
  html += '<h2 style="margin:0;">' + escapeHtml(s.title) + ' <code>' + escapeHtml(s.project_id) + '</code></h2>';
  html += '<div style="display:flex;gap:6px;">';
  html += '<button class="btn btn-copy-act" data-act="all" style="font-size:0.85em;">Copy All</button>';
  html += '<span class="copy-status" style="color:var(--accent-2);font-size:0.85em;"></span>';
  html += '</div></div>';
  html += '<span class="copy-global-status" style="color:var(--accent-2);font-size:0.85em;margin-left:8px;"></span>';

  if (s.topic) {
    html += '<p style="color:var(--muted);margin:0 0 12px;">' + escapeHtml(s.topic) + '</p>';
  }

  const actBgColors = ["#1a1c2b", "#1b2a1e", "#2a1e24", "#1e232a", "#2a221d"];
  let actIdx = 0;
  for (const act of (s.acts || [])) {
    const dur = estimateSeconds(act.voiceover || "");
    const bgColor = actBgColors[actIdx % actBgColors.length];
    html += '<div class="act-section" style="margin-bottom:16px;border-left:3px solid var(--accent);padding:12px;background:' + bgColor + ';border-radius:8px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
    html += '<strong>' + escapeHtml(act.title) + ' (' + escapeHtml(act.role) + ')</strong>';
    html += '<span style="color:var(--muted);font-size:0.85em;">~' + formatDuration(dur) + '</span>';
    html += '<button class="btn btn-copy-act" data-act="' + escapeHtml(act.key) + '" style="font-size:0.8em;">Copy</button>';
    html += ' <span class="copy-act-status" style="color:var(--accent-2);font-size:0.85em;"></span>';
    html += '</div>';
    html += '<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.95em;line-height:1.6;background:var(--panel-2,var(--bg));padding:12px;border-radius:6px;max-height:300px;overflow-y:auto;">' + escapeHtml(act.voiceover || "") + '</pre>';
    html += '</div>';
    actIdx++;
  }

  html += '</div>'; // script-card
  document.getElementById("script-view").innerHTML = html;

  // Wire copy buttons
  document.querySelectorAll(".btn-copy-act").forEach(btn => {
    btn.addEventListener("click", () => {
      const actKey = btn.dataset.act;
      let text = "";
      if (actKey === "all") {
        for (const act of (s.acts || [])) {
          text += act.title + "\n" + "=".repeat(act.title.length) + "\n" + (act.voiceover || "") + "\n\n";
        }
      } else {
        const act = (s.acts || []).find(a => a.key === actKey);
        if (act) text = act.voiceover || "";
      }
      const statusEl = btn.nextElementSibling && btn.nextElementSibling.classList.contains("copy-act-status")
        ? btn.nextElementSibling
        : btn.closest(".script-card").querySelector(".copy-global-status");
      navigator.clipboard.writeText(text.trim()).then(() => {
        if (statusEl) {
          statusEl.textContent = "✅";
          setTimeout(() => { statusEl.textContent = ""; }, 1500);
        }
      }).catch(err => {
        if (statusEl) { statusEl.textContent = "Copy failed"; setTimeout(() => { statusEl.textContent = ""; }, 2000); }
      });
    });
  });

  renderPager("pager-top", idx, total);
  renderPager("pager-bottom", idx, total);
}

function renderPager(id, idx, total) {
  const el = document.getElementById(id);
  if (total <= 1) { el.innerHTML = ""; return; }
  let html = "";
  html += '<button class="btn" id="' + id + '-first" ' + (idx === 0 ? "disabled" : "") + '>First</button>';
  html += '<button class="btn" id="' + id + '-prev" ' + (idx === 0 ? "disabled" : "") + '>Prev</button>';
  html += '<span style="min-width:80px;text-align:center;">' + (idx + 1) + ' / ' + total + '</span>';
  html += '<button class="btn" id="' + id + '-next" ' + (idx >= total - 1 ? "disabled" : "") + '>Next</button>';
  html += '<button class="btn" id="' + id + '-last" ' + (idx >= total - 1 ? "disabled" : "") + '>Last</button>';
  el.innerHTML = html;

  document.getElementById(id + "-first").addEventListener("click", () => { currentPage = 0; render(); });
  document.getElementById(id + "-prev").addEventListener("click", () => { if (currentPage > 0) { currentPage--; render(); } });
  document.getElementById(id + "-next").addEventListener("click", () => { if (currentPage < total - 1) { currentPage++; render(); } });
  document.getElementById(id + "-last").addEventListener("click", () => { currentPage = total - 1; render(); });
}

document.addEventListener("layout:ready", async () => {
  await loadScripts(false);

  document.getElementById("search-input").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    applySearch();
  });

  document.getElementById("refresh-btn").addEventListener("click", () => loadScripts(true));

  // Keyboard nav
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft" && currentPage > 0) { currentPage--; render(); }
    if (e.key === "ArrowRight" && currentPage < filtered.length - 1) { currentPage++; render(); }
  });
});
