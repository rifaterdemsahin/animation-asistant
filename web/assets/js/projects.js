const api = "/api";

// --- projects list cache (localStorage) -------------------------------------
// Speeds up the Projects page: we paint from cache instantly, then revalidate
// against the server in the background. "Clear cache" wipes it.
const CACHE_KEY = "projects_cache_v1";
const STATUSES = ["backlog", "inprogress", "done"];
const STATUS_LABELS = {
  backlog: "📋 Backlog",
  inprogress: "🔧 In Progress",
  done: "✅ Done",
};

function validStatus(s) {
  return STATUSES.includes(s) ? s : "backlog";
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !Array.isArray(c.projects)) return null;
    return c; // { projects, ts }
  } catch { return null; }
}

function setCache(projects) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ projects, ts: Date.now() }));
  } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

function patchCacheProject(slug, patch) {
  const c = getCache();
  if (!c) return;
  const p = c.projects.find(x => x.slug === slug);
  if (p) Object.assign(p, patch);
  setCache(c.projects);
}

function cacheAgeText(ts) {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  return Math.round(s / 60) + "m ago";
}

function setCacheIndicator({ ts = null, fromCache = false, loading = false, offline = false } = {}) {
  const el = document.getElementById("cache-status");
  if (!el) return;
  if (loading) { el.textContent = "Refreshing…"; return; }
  const suffix = offline ? " (offline — showing cached)" : "";
  el.textContent = fromCache
    ? "Cached " + cacheAgeText(ts) + suffix
    : "Updated " + cacheAgeText(ts);
}

// --- core -------------------------------------------------------------------

async function json(url, opts) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

function renderProjects(projects) {
  const list = document.getElementById("project-list");
  const empty = document.getElementById("empty-state");
  projects.sort((a, b) => {
    const aNum = parseInt((a.question_id || "").replace(/^q/i, "")) || 0;
    const bNum = parseInt((b.question_id || "").replace(/^q/i, "")) || 0;
    return aNum - bNum;
  });
  list.innerHTML = "";
  if (!projects.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
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

    const status = buildStatusSelect(p);
    const edit = document.createElement("button");
    edit.className = "btn";
    edit.innerHTML = "&#9999;&#65039;";
    edit.title = "Edit project";
    edit.addEventListener("click", () => editProject(p));

    const open = document.createElement("button");
    open.className = "btn primary";
    open.innerHTML = "&#128193;";
    open.title = "Open and select project";
    open.addEventListener("click", () => selectProject(p));

    const del = document.createElement("button");
    del.className = "btn";
    del.innerHTML = "&#128465;&#65039;";
    del.title = "Delete project";
    del.addEventListener("click", () => deleteProject(p));

    if (current && current.slug === p.slug) {
      open.innerHTML = "&#9989;";
      open.title = "Currently selected";
      open.disabled = true;
    }

    const btns = [status, edit, open, del];

    if (p.canva_link) {
      const canva = document.createElement("a");
      canva.className = "btn";
      canva.innerHTML = "&#127912;";
      canva.title = "Open Canva design";
      canva.href = p.canva_link;
      canva.target = "_blank";
      canva.rel = "noopener";
      btns.push(canva);
    }

    right.append(...btns);
    li.append(left, right);
    list.append(li);
  }
}

// loadProjects: stale-while-revalidate. Paints from cache first (unless a hard
// refresh is requested), then fetches fresh data from the server.
async function loadProjects({ refresh = false } = {}) {
  if (!refresh) {
    const c = getCache();
    if (c) {
      renderProjects(c.projects);
      setCacheIndicator({ ts: c.ts, fromCache: true });
    }
  }
  try {
    setCacheIndicator({ loading: true });
    const data = await json(api + "/projects");
    setCache(data.projects);
    renderProjects(data.projects);
    setCacheIndicator({ ts: Date.now() });
  } catch (err) {
    const c = getCache();
    if (c) {
      setCacheIndicator({ ts: c.ts, fromCache: true, offline: true });
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
  sel.addEventListener("change", () => updateStatus(p.slug, sel.value));
  return sel;
}

async function updateStatus(slug, status) {
  const sel = document.querySelector(`select.status-select[data-slug="${slug}"]`);
  try {
    await json(`${api}/projects/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (sel) sel.className = "status-select status-" + status;
    patchCacheProject(slug, { status });
  } catch (err) {
    alert("Status update failed: " + err.message);
    loadProjects({ refresh: true });
  }
}

function selectProject(p) {
  localStorage.setItem("current_project", JSON.stringify({ slug: p.slug, title: p.title }));
  location.href = "/pages/storyboard.html";
}

async function deleteProject(p) {
  if (!confirm(`Delete project "${p.title}"? This cannot be undone.`)) return;
  await json(`${api}/projects/${encodeURIComponent(p.slug)}`, { method: "DELETE" });
  const cur = window.currentProject && window.currentProject();
  if (cur && cur.slug === p.slug) localStorage.removeItem("current_project");
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

  const full = await json(`${api}/projects/${encodeURIComponent(p.slug)}`);
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

    const actNotes = {};
    for (const key of ["act-1", "act-2", "act-3"]) {
      const ta = modal.querySelector(`[name="act_note_${key}"]`);
      if (ta) actNotes[key] = ta.value;
    }

    try {
      await json(`${api}/projects/${encodeURIComponent(p.slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: questionId || null,
          type: qtype || null,
          status,
          question, answer, why,
          canva_link: canvaLink || null,
          tasks, act_notes: actNotes,
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

  loadProjects();
});
