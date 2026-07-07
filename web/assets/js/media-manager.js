// Media Manager: outline + per-act script generation for the current project.
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

function setLoading(btn, on, label) {
  if (!btn) return;
  btn.disabled = on;
  if (on) btn.dataset.label = btn.textContent;
  btn.textContent = on ? "Working…" : (label || btn.dataset.label || btn.textContent);
}

async function loadExisting() {
  const s = slug();
  if (!s) return;
  try {
    const [outline, script] = await Promise.all([
      json(`${api}/projects/${s}/outline`),
      json(`${api}/projects/${s}/script`),
    ]);
    if (outline.outline) {
      document.getElementById("outline-out").textContent = JSON.stringify(outline.outline, null, 2);
      document.getElementById("outline-out").classList.remove("hidden");
      document.getElementById("outline-state").textContent = "outline ready";
    }
    renderScripts(script.acts || {});
  } catch {}
}

function renderScripts(acts) {
  const out = document.getElementById("script-out");
  out.innerHTML = "";
  const order = [["act-1", "Act 1 — Problem"], ["act-2", "Act 2 — Solution"], ["act-3", "Act 3 — Lesson"]];
  let any = false;
  for (const [key, title] of order) {
    const md = acts[key];
    if (!md) continue;
    any = true;
    const div = document.createElement("div");
    div.className = "act";
    div.innerHTML = `<h3>${title}</h3><pre>${escapeHtml(md)}</pre>`;
    out.append(div);
  }
  if (!any) out.innerHTML = `<p class="muted">No script yet — generate one above.</p>`;
}

document.addEventListener("layout:ready", () => {
  const s = slug();
  if (!s) return;
  document.getElementById("no-project").classList.add("hidden");
  document.getElementById("manager").classList.remove("hidden");
  const cur = window.currentProject && window.currentProject();
  document.getElementById("mm-title").textContent = cur.title + " (" + s + ")";
  document.getElementById("mm-status").textContent = cur.slug;

  document.getElementById("gen-outline").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    setLoading(btn, true);
    try {
      const res = await json(`${api}/projects/${s}/outline`, { method: "POST" });
      document.getElementById("outline-out").textContent = JSON.stringify(res.outline, null, 2);
      document.getElementById("outline-out").classList.remove("hidden");
      document.getElementById("outline-state").textContent = "outline ready";
    } catch (err) { alert(err.message); }
    finally { setLoading(btn, false); }
  });

  document.getElementById("gen-script").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const selected = ["act-1", "act-2", "act-3"].filter(k => document.getElementById(k).checked);
    if (!selected.length) { alert("Select at least one act."); return; }
    setLoading(btn, true);
    try {
      await json(`${api}/projects/${s}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acts: selected }),
      });
      const script = await json(`${api}/projects/${s}/script`);
      renderScripts(script.acts || {});
    } catch (err) { alert(err.message); }
    finally { setLoading(btn, false); }
  });

  loadExisting();
});
