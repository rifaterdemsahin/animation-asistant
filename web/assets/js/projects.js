const api = "/api";

// --- projects list cache (localStorage) -------------------------------------
// Speeds up the Projects page: while the cache is fresh (within CACHE_TTL) we
// paint from it and skip the network entirely. Once it auto-expires we
// revalidate against the server in the background (stale-while-revalidate).
// "Clear cache" wipes it immediately; "Refresh" forces a revalidate now.
const CACHE_KEY = "projects_cache_v1";
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours — cache auto-expires after this
const STATUSES = ["backlog", "inprogress", "done"];
const STATUS_LABELS = {
  backlog: "📋 Backlog",
  inprogress: "🔧 In Progress",
  done: "✅ Done",
};

function validStatus(s) {
  return STATUSES.includes(s) ? s : "backlog";
}

// getStaleCache returns the raw cache regardless of age (or null). Used for the
// offline fallback and for patching fields without touching the age.
function getStaleCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !Array.isArray(c.projects) || typeof c.ts !== "number") return null;
    return c; // { projects, ts }
  } catch { return null; }
}

// isCacheExpired reports whether a cache entry is older than CACHE_TTL.
function isCacheExpired(c) {
  return !c || Date.now() - c.ts > CACHE_TTL;
}

// getCache returns the cache only while it is still fresh (within CACHE_TTL).
function getCache() {
  const c = getStaleCache();
  return isCacheExpired(c) ? null : c;
}

// writeCache stores projects with a timestamp (defaults to now). Pass an
// explicit ts to preserve the original age (e.g. when patching a single field).
function writeCache(projects, ts = Date.now()) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ projects, ts }));
  } catch {}
}

// setCache writes a fresh cache and resets the 3h TTL countdown.
function setCache(projects) {
  writeCache(projects, Date.now());
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

// patchCacheProject updates one project in the stored cache without resetting
// its age, so a status change doesn't extend the TTL.
function patchCacheProject(slug, patch) {
  const c = getStaleCache();
  if (!c) return;
  const p = c.projects.find(x => x.slug === slug);
  if (p) Object.assign(p, patch);
  writeCache(c.projects, c.ts);
}

function cacheAgeText(ts) {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  const m = Math.round(s / 60);
  if (m < 60) return m + "m ago";
  return Math.round(m / 60) + "h ago";
}

// cacheExpiryText returns a short "expires in Xh Ym" label for a fresh cache,
// or "" once the TTL has elapsed.
function cacheExpiryText(ts) {
  if (!ts) return "";
  const ms = CACHE_TTL - (Date.now() - ts);
  if (ms <= 0) return "";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return "expires in " + mins + "m";
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return "expires in " + hrs + "h" + (rem ? " " + rem + "m" : "");
}

function setCacheIndicator({ ts = null, fromCache = false, loading = false, offline = false } = {}) {
  const el = document.getElementById("cache-status");
  if (!el) return;
  if (loading) {
    el.textContent = ts ? "Cached " + cacheAgeText(ts) + " · refreshing…" : "Refreshing…";
    return;
  }
  if (offline) {
    el.textContent = "Cached " + cacheAgeText(ts) + " (offline — showing cached)";
    return;
  }
  if (fromCache) {
    const exp = cacheExpiryText(ts);
    el.textContent = "Cached " + cacheAgeText(ts) + (exp ? " · " + exp : "");
    return;
  }
  el.textContent = "Updated " + cacheAgeText(ts);
}

// --- core -------------------------------------------------------------------

async function json(url, opts) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

// allProjects holds the most recent full list; searchTerm is the live filter.
// renderProjects always filters allProjects by searchTerm so a search survives
// background revalidation refreshes.
let allProjects = [];
let searchTerm = "";

// view + sort state (persisted so the chosen layout/order survives reloads).
let viewMode = "table";
let sortKey = "question_id";
let sortDir = "asc";
try {
  const v = localStorage.getItem("projects_view_v1");
  if (v === "list" || v === "table") viewMode = v;
  const s = JSON.parse(localStorage.getItem("projects_sort_v1") || "null");
  if (s && s.key) { sortKey = s.key; sortDir = s.dir === "desc" ? "desc" : "asc"; }
} catch {}

// projectSearchText joins the searchable text fields of a project for filtering.
function projectSearchText(p) {
  const fields = ["title", "slug", "topic", "component_type", "question_id",
    "type", "status", "question", "answer", "why", "canva_link"];
  return fields.map(f => (p && p[f]) || "").join(" ").toLowerCase();
}

// filterProjects returns the subset matching term (case-insensitive, across all
// searchable fields). An empty term returns everything.
function filterProjects(projects, term) {
  const q = (term || "").trim().toLowerCase();
  if (!q) return projects;
  return projects.filter(p => projectSearchText(p).includes(q));
}

function renderProjects(projects) {
  allProjects = Array.isArray(projects) ? projects : [];
  const topCount = document.getElementById("project-count");
  if (topCount) topCount.textContent = allProjects.length;
  const listEl = document.getElementById("project-list");
  const tableWrap = document.getElementById("project-table-wrap");
  const empty = document.getElementById("empty-state");
  const count = document.getElementById("search-count");

  const filtered = filterProjects(allProjects, searchTerm);
  const sorted = applySort(filtered);

  if (count) {
    if (!allProjects.length) count.textContent = "";
    else if (searchTerm.trim()) count.textContent = filtered.length + " of " + allProjects.length + " shown";
    else count.textContent = allProjects.length + (allProjects.length === 1 ? " project" : " projects");
  }

  if (!allProjects.length) {
    listEl.classList.add("hidden");
    tableWrap.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = "No projects yet.";
    return;
  }
  if (!sorted.length) {
    listEl.classList.add("hidden");
    tableWrap.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = 'No matches for "' + searchTerm.trim() + '".';
    return;
  }
  empty.classList.add("hidden");

  if (viewMode === "table") {
    listEl.classList.add("hidden");
    tableWrap.classList.remove("hidden");
    renderTable(sorted);
  } else {
    tableWrap.classList.add("hidden");
    listEl.classList.remove("hidden");
    renderList(sorted);
  }
}

// renderList paints the compact card/list view (one row per project).
function renderList(projects) {
  const list = document.getElementById("project-list");
  list.innerHTML = "";
  const current = window.currentProject && window.currentProject();
  for (const p of projects) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    const metaParts = [p.slug, p.component_type];
    if (p.question_id) metaParts.unshift(p.question_id);
    if (p.type) metaParts.splice(1, 0, p.type);
    left.innerHTML = `<strong>${escapeHtml(p.title)}</strong>
      <div class="meta">${metaParts.map(escapeHtml).join(" · ")}</div>`;
    const right = document.createElement("div");
    right.className = "row";
    const btns = [buildStatusSelect(p), makeEditButton(p), makeOpenButton(p, current), makeDeleteButton(p)];
    const canva = makeCanvaLink(p);
    if (canva) btns.push(canva);
    right.append(...btns);
    li.append(left, right);
    list.append(li);
  }
}

// renderTable paints the data-table view with Question / Answer / Category /
// Question ID columns plus Title, Status and Actions.
function renderTable(projects) {
  const tbody = document.getElementById("project-table-body");
  tbody.innerHTML = "";
  const current = window.currentProject && window.currentProject();
  for (const p of projects) {
    const tr = document.createElement("tr");
    if (current && (current.project_id === p.project_id || current.slug === p.slug)) tr.classList.add("current");
    tr.innerHTML =
      `<td class="cell-qid">${escapeHtml(p.question_id || "—")}</td>` +
      `<td class="cell-title"><strong>${escapeHtml(p.title || "")}</strong></td>` +
      `<td class="cell-clamp" title="${escapeHtml(p.question || "")}">${escapeHtml(p.question || "—")}</td>` +
      `<td class="cell-clamp" title="${escapeHtml(p.answer || "")}">${escapeHtml(p.answer || "—")}</td>` +
      `<td class="cell-cat">${escapeHtml(p.type || "—")}</td>` +
      `<td class="cell-status"></td>` +
      `<td class="cell-actions"></td>`;
    tr.querySelector(".cell-status").appendChild(buildStatusSelect(p));
    const actions = tr.querySelector(".cell-actions");
    const buttons = [makeEditButton(p), makeOpenButton(p, current), makeDeleteButton(p), makeCanvaLink(p)].filter(Boolean);
    actions.append(...buttons);
    tbody.appendChild(tr);
  }
}

// --- sorting ---------------------------------------------------------------

// sortValue extracts a comparable value for a column key.
function sortValue(p, key) {
  switch (key) {
    case "question_id": return parseInt((p.question_id || "").replace(/^q/i, "")) || 0;
    case "status": return STATUSES.indexOf(validStatus(p.status));
    default: return String(p[key] || "").toLowerCase();
  }
}

// applySort returns a sorted copy (never mutates the source) using the current
// sortKey/sortDir. Defaults to question_id ascending.
function applySort(projects) {
  const arr = projects.slice();
  const dir = sortDir === "desc" ? -1 : 1;
  arr.sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
  return arr;
}

// setSort toggles asc/desc on the same column, or switches to a new column asc.
function setSort(key) {
  if (sortKey === key) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortKey = key;
    sortDir = "asc";
  }
  try { localStorage.setItem("projects_sort_v1", JSON.stringify({ key: sortKey, dir: sortDir })); } catch {}
  updateSortArrows();
  renderProjects(allProjects);
}

function updateSortArrows() {
  document.querySelectorAll("#project-table th[data-sort]").forEach(th => {
    const active = th.dataset.sort === sortKey;
    th.classList.toggle("active", active);
    const arrow = th.querySelector(".sort-arrow");
    if (arrow) arrow.textContent = active ? (sortDir === "asc" ? "▲" : "▼") : "";
  });
}

// --- view toggle -----------------------------------------------------------

function setView(mode) {
  if (mode !== "list" && mode !== "table") mode = "table";
  viewMode = mode;
  try { localStorage.setItem("projects_view_v1", mode); } catch {}
  updateViewToggle();
  renderProjects(allProjects);
}

function updateViewToggle() {
  document.querySelectorAll("#view-toggle button[data-view]").forEach(b => {
    b.classList.toggle("active", b.dataset.view === viewMode);
  });
}

// --- shared action buttons (used by both views) ----------------------------

function makeEditButton(p) {
  const b = document.createElement("button");
  b.className = "btn";
  b.innerHTML = "&#9999;&#65039;";
  b.title = "Edit project";
  b.addEventListener("click", () => editProject(p));
  return b;
}

function makeOpenButton(p, current) {
  const b = document.createElement("button");
  b.className = "btn primary";
  b.innerHTML = "&#128193;";
  b.title = "Open and select project";
  if (current && (current.project_id === p.project_id || current.slug === p.slug)) {
    b.innerHTML = "&#9989;";
    b.title = "Currently selected";
    b.disabled = true;
  }
  b.addEventListener("click", () => selectProject(p));
  return b;
}

function makeDeleteButton(p) {
  const b = document.createElement("button");
  b.className = "btn";
  b.innerHTML = "&#128465;&#65039;";
  b.title = "Delete project";
  b.addEventListener("click", () => deleteProject(p));
  return b;
}

function makeCanvaLink(p) {
  if (!p.canva_link) return null;
  const a = document.createElement("a");
  a.className = "btn";
  a.innerHTML = "&#127912;";
  a.title = "Open Canva design";
  a.href = p.canva_link;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

// loadProjects: cache-first with a 3h TTL. While the cache is fresh we paint
// from it and skip the network entirely. Once expired (or on a hard refresh)
// we paint the stale cache as a placeholder and revalidate against the server.
// If the server is unreachable we fall back to whatever cache we have.
async function loadProjects({ refresh = false } = {}) {
  const cache = getStaleCache();
  const fresh = !isCacheExpired(cache);

  // Fresh cache (and not a hard refresh): serve from cache, no network.
  if (!refresh && fresh) {
    renderProjects(cache.projects);
    setCacheIndicator({ ts: cache.ts, fromCache: true });
    return;
  }

  // Expired cache: paint it as a placeholder while we revalidate.
  if (!refresh && cache) {
    renderProjects(cache.projects);
  }

  try {
    setCacheIndicator({ loading: true, ts: (!refresh && cache) ? cache.ts : null });
    const data = await json(api + "/projects");
    setCache(data.projects);
    renderProjects(data.projects);
    setCacheIndicator({ ts: Date.now() });
  } catch (err) {
    if (cache) {
      renderProjects(cache.projects);
      setCacheIndicator({ ts: cache.ts, fromCache: true, offline: true });
    } else {
      setCacheIndicator();
      alert(err.message);
    }
  }
}

function buildStatusSelect(p) {
  const sel = document.createElement("select");
  const cur = validStatus(p.status);
  sel.className = "status-select status-" + cur;
  sel.title = "Project status";
  sel.dataset.slug = p.slug;
  for (const v of STATUSES) {
    const op = document.createElement("option");
    op.value = v;
    op.textContent = STATUS_LABELS[v];
    if (v === cur) op.selected = true;
    sel.appendChild(op);
  }
  sel.addEventListener("change", () => updateStatus(p, sel.value));
  return sel;
}

async function updateStatus(p, status) {
  const sel = document.querySelector(`select.status-select[data-slug="${p.slug}"]`);
  try {
    await json(`${api}/projects/${encodeURIComponent(p.project_id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (sel) sel.className = "status-select status-" + status;
    patchCacheProject(p.slug, { status });
  } catch (err) {
    alert("Status update failed: " + err.message);
    loadProjects({ refresh: true });
  }
}

function selectProject(p) {
  localStorage.setItem("current_project", JSON.stringify({ project_id: p.project_id, slug: p.slug, title: p.title }));
  location.href = "/pages/storyboard.html?project=" + encodeURIComponent(p.project_id);
}

async function deleteProject(p) {
  if (!confirm(`Delete project "${p.title}"? This cannot be undone.`)) return;
  await json(`${api}/projects/${encodeURIComponent(p.project_id)}`, { method: "DELETE" });
  const cur = window.currentProject && window.currentProject();
  if (cur && (cur.project_id === p.project_id || cur.slug === p.slug)) localStorage.removeItem("current_project");
  clearCache();
  loadProjects({ refresh: true });
}

function buildEditModal(p) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "edit-modal";

  const tasks = p.tasks || [];
  const actNotes = p.actNotes || {};
  const taskGroups = { remember: [], apply: [], evaluate: [] };
  for (const t of tasks) {
    if (taskGroups[t.group]) taskGroups[t.group].push(t);
  }

  const groupLabels = {
    remember: "1. Remember & Understand (Foundation)",
    apply: "2. Apply & Analyze (Creation & Assembly)",
    evaluate: "3. Evaluate & Create (Refinement & Final Polish)",
  };

  let tasksHTML = "";
  for (const [group, items] of Object.entries(taskGroups)) {
    if (!items.length) continue;
    tasksHTML += `<div class="task-group"><h4>${escapeHtml(groupLabels[group] || group)}</h4>`;
    for (const t of items) {
      const checked = t.done ? " checked" : "";
      const cls = t.done ? " task-done" : "";
      tasksHTML += `<div class="task-row">
        <input type="checkbox" data-task-id="${escapeHtml(t.id)}"${checked}>
        <label class="${cls}">${escapeHtml(t.label)}</label>
      </div>`;
    }
    tasksHTML += "</div>";
  }

  const actKeys = ["act-1", "act-2", "act-3"];
  const actLabels = { "act-1": "Act 1 — Problem", "act-2": "Act 2 — Solution", "act-3": "Act 3 — Lesson" };
  let actNotesHTML = "";
  for (const key of actKeys) {
    actNotesHTML += `<label>${escapeHtml(actLabels[key])}
      <textarea name="act_note_${key}" rows="3" placeholder="Notes for ${escapeHtml(actLabels[key])}...">${escapeHtml(actNotes[key] || "")}</textarea>
    </label>`;
  }

  const cur = validStatus(p.status);
  const statusOptions = STATUSES.map(v =>
    `<option value="${v}"${v === cur ? " selected" : ""}>${escapeHtml(STATUS_LABELS[v])}</option>`).join("");

  overlay.innerHTML = `<div class="modal">
    <div class="modal-header">
      <h2>Edit: ${escapeHtml(p.title)}</h2>
      <button class="modal-close" id="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="section">
        <h3>Metadata</h3>
        <div class="row">
          <label>Question ID
            <input type="text" name="question_id" placeholder="q1" value="${escapeHtml(p.question_id || "")}">
          </label>
          <label>Type
            <input type="text" name="type" placeholder="multi-agent-research" value="${escapeHtml(p.type || "")}">
          </label>
          <label>Status
            <select name="status">${statusOptions}</select>
          </label>
        </div>
      </div>
      <div class="section">
        <h3>Q&A / Why</h3>
        <label>Question
          <textarea name="question" rows="2" placeholder="e.g. How does machine learning work?">${escapeHtml(p.question || "")}</textarea>
        </label>
        <label>Answer
          <textarea name="answer" rows="2" placeholder="e.g. It learns patterns from data to make predictions.">${escapeHtml(p.answer || "")}</textarea>
        </label>
        <label>Why (pedagogical rationale)
          <textarea name="why" rows="2" placeholder="Why this topic matters...">${escapeHtml(p.why || "")}</textarea>
        </label>
      </div>
      <div class="section">
        <h3>Tasks</h3>
        ${tasksHTML}
      </div>
      <div class="section">
        <h3>Notes</h3>
        <textarea name="notes" rows="4" placeholder="General project notes..." style="width:100%">${escapeHtml(p.notes || "")}</textarea>
      </div>
      <div class="section">
        <h3>Act Notes</h3>
        ${actNotesHTML}
      </div>
      <div class="section">
        <h3>Links</h3>
        <label>Canva Link
          <input type="url" name="canva_link" placeholder="https://www.canva.com/design/..." value="${escapeHtml(p.canva_link || "")}">
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="modal-cancel">Cancel</button>
      <button class="btn primary" id="modal-save">Save</button>
    </div>
  </div>`;

  return overlay;
}

async function editProject(p) {
  const existing = document.getElementById("edit-modal");
  if (existing) existing.remove();

  const full = await json(`${api}/projects/${encodeURIComponent(p.project_id)}`);
  const modal = buildEditModal(full);
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#modal-close").addEventListener("click", close);
  modal.querySelector("#modal-cancel").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  modal.querySelector("#modal-save").addEventListener("click", async () => {
    const saveBtn = modal.querySelector("#modal-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const questionId = modal.querySelector('[name="question_id"]').value.trim();
    const qtype = modal.querySelector('[name="type"]').value.trim();
    const status = modal.querySelector('[name="status"]').value;
    const question = modal.querySelector('[name="question"]').value;
    const answer = modal.querySelector('[name="answer"]').value;
    const why = modal.querySelector('[name="why"]').value;
    const canvaLink = modal.querySelector('[name="canva_link"]').value;

    const taskChecks = modal.querySelectorAll('[data-task-id]');
    const tasks = [];
    for (const cb of taskChecks) {
      const id = cb.dataset.taskId;
      const orig = (full.tasks || []).find(t => t.id === id);
      tasks.push({
        id,
        label: orig ? orig.label : "",
        group: orig ? orig.group : "",
        done: cb.checked,
      });
    }

    const notes = modal.querySelector('[name="notes"]').value;
    const actNotes = {};
    for (const key of ["act-1", "act-2", "act-3"]) {
      const ta = modal.querySelector(`[name="act_note_${key}"]`);
      if (ta) actNotes[key] = ta.value;
    }

    try {
      await json(`${api}/projects/${encodeURIComponent(p.project_id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: questionId || null,
          type: qtype || null,
          status,
          question, answer, why,
          canva_link: canvaLink || null,
          tasks, notes, act_notes: actNotes,
        }),
      });
      modal.remove();
      loadProjects({ refresh: true });
    } catch (err) {
      alert("Save failed: " + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.addEventListener("layout:ready", () => {
  const form = document.getElementById("new-project");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("p-title").value.trim();
    if (!title) return;
    const topic = document.getElementById("p-topic").value.trim();
    const component_type = document.getElementById("p-type").value.trim();
    const p = await json(api + "/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, topic, component_type }),
    });
    form.reset();
    selectProject(p);
  });

  const refreshBtn = document.getElementById("refresh-projects");
  const clearBtn = document.getElementById("clear-cache");
  if (refreshBtn) refreshBtn.addEventListener("click", () => loadProjects({ refresh: true }));
  if (clearBtn) clearBtn.addEventListener("click", () => {
    clearCache();
    loadProjects({ refresh: true });
  });

  // live client-side search: re-render the cached list as the user types.
  const searchInput = document.getElementById("project-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value;
      renderProjects(allProjects);
    });
  }

  // view toggle (table/list) + column sorting.
  const viewToggle = document.getElementById("view-toggle");
  if (viewToggle) {
    viewToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (btn) setView(btn.dataset.view);
    });
  }
  document.querySelectorAll("#project-table th[data-sort]").forEach(th => {
    th.addEventListener("click", () => setSort(th.dataset.sort));
  });
  updateViewToggle();
  updateSortArrows();

  // Auto-expire: when the tab becomes visible again after being idle, refresh
  // automatically if the cache has passed its 3h TTL (skipped while an edit
  // modal is open so we never disrupt an active edit).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (document.getElementById("edit-modal")) return;
    if (isCacheExpired(getStaleCache())) loadProjects({ refresh: true });
  });

  loadProjects();
});
