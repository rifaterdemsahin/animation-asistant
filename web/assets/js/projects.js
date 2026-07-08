const api = "/api";

async function json(url, opts) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

async function loadProjects() {
  const list = document.getElementById("project-list");
  const empty = document.getElementById("empty-state");
  const data = await json(api + "/projects");
  list.innerHTML = "";
  if (!data.projects.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  const current = window.currentProject && window.currentProject();
  for (const p of data.projects) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<strong>${escapeHtml(p.title)}</strong>
      <div class="meta">${escapeHtml(p.slug)} · ${escapeHtml(p.component_type)} · ${p.status}</div>`;
    const right = document.createElement("div");
    right.className = "row";

    const edit = document.createElement("button");
    edit.className = "btn";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editProject(p));

    const open = document.createElement("button");
    open.className = "btn primary";
    open.textContent = "Open";
    open.addEventListener("click", () => selectProject(p));

    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteProject(p));

    if (current && current.slug === p.slug) {
      open.textContent = "Selected";
      open.disabled = true;
    }
    right.append(edit, open, del);
    li.append(left, right);
    list.append(li);
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
  loadProjects();
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

  overlay.innerHTML = `<div class="modal">
    <div class="modal-header">
      <h2>Edit: ${escapeHtml(p.title)}</h2>
      <button class="modal-close" id="modal-close">&times;</button>
    </div>
    <div class="modal-body">
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
      const updated = await json(`${api}/projects/${encodeURIComponent(p.slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question, answer, why,
          canva_link: canvaLink,
          tasks, act_notes: actNotes,
        }),
      });
      modal.remove();
      loadProjects();
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
  loadProjects().catch(err => alert(err.message));
});
