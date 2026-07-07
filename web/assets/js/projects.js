// Projects: list, create, select (set current), delete.
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
    right.append(open, del);
    li.append(left, right);
    list.append(li);
  }
}

function selectProject(p) {
  localStorage.setItem("current_project", JSON.stringify({ slug: p.slug, title: p.title }));
  location.href = "/pages/media-manager.html";
}

async function deleteProject(p) {
  if (!confirm(`Delete project "${p.title}"? This cannot be undone.`)) return;
  await json(`${api}/projects/${encodeURIComponent(p.slug)}`, { method: "DELETE" });
  const cur = window.currentProject && window.currentProject();
  if (cur && cur.slug === p.slug) localStorage.removeItem("current_project");
  loadProjects();
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
