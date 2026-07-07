// Storyboard Creator: assemble acts + components into scenes via Gemini.
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

function renderStoryboard(sb) {
  const out = document.getElementById("sb-out");
  const img = document.getElementById("sb-image");
  const rawUrl = `${api}/projects/${slug()}/raw/storyboard/storyboard.png`;
  img.src = rawUrl;
  img.classList.remove("hidden");
  img.onerror = () => img.classList.add("hidden");

  out.innerHTML = "";
  const actsObj = (sb && sb.acts) || {};
  const order = [["act-1", "Act 1 — Problem"], ["act-2", "Act 2 — Solution"], ["act-3", "Act 3 — Lesson"]];
  let any = false;
  for (const [key, title] of order) {
    const scenes = (actsObj[key] && actsObj[key].scenes) || [];
    if (!scenes.length) continue;
    any = true;
    const sec = document.createElement("div");
    sec.className = "panel";
    sec.innerHTML = `<h3>${title}</h3>`;
    for (const sc of scenes) {
      const row = document.createElement("div");
      row.className = "act";
      row.innerHTML = `<h3>${escapeHtml(sc.scene_id || "")} · ${escapeHtml(String(sc.duration || ""))}s</h3>
        <pre>${escapeHtml(sc.description || "")}</pre>
        <div class="muted">beat: ${escapeHtml(sc.beat_ref || "")} · components: ${escapeHtml((sc.component_ids || []).join(", "))}</div>`;
      sec.append(row);
    }
    out.append(sec);
  }
  if (!any) out.innerHTML = `<p class="muted">Storyboard has no scenes.</p>`;
}

async function loadStoryboard() {
  try {
    const { storyboard } = await json(`${api}/projects/${slug()}/storyboard`);
    if (storyboard) renderStoryboard(storyboard);
  } catch {}
}

document.addEventListener("layout:ready", () => {
  const s = slug();
  if (!s) return;
  document.getElementById("no-project").classList.add("hidden");
  document.getElementById("manager").classList.remove("hidden");
  const cur = window.currentProject();
  document.getElementById("sb-title").textContent = cur.title + " (" + s + ")";

  document.getElementById("gen-storyboard").addEventListener("click", async (e) => {
    const btn = e.currentTarget; setLoading(btn, true);
    try {
      await json(`${api}/projects/${s}/storyboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await loadStoryboard();
    } catch (err) { alert(err.message); } finally { setLoading(btn, false); }
  });
  loadStoryboard();
});
