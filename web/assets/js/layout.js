// Shared shell: top nav (links + search + logout), header (current project), footer.
// Each page includes empty <div id="topnav">, <header id="app-header">, <footer id="app-footer">.

const NAV_ITEMS = [
  { name: "🏠 Dashboard", url: "/" },
  { name: "📁 Projects", url: "/pages/projects.html", children: [
    { name: "📁 Projects", url: "/pages/projects.html" },
    { name: "🆕 Create", url: "/pages/create.html" },
  ]},
  { name: "📋 Storyboard", url: "/pages/storyboard.html" },
  { name: "📜 Script", url: "/pages/script-page.html" },
  { name: "🎛️ Media Manager", url: "/pages/media-manager.html" },
  { name: "🎧 Audio", url: "/pages/audio.html" },
  { name: "🛠️ Tools", url: "/pages/tools.html", children: [
    { name: "🛠️ Tools", url: "/pages/tools.html" },
    { name: "🔬 Compare Models", url: "/pages/compare-models.html" },
  ]},
  { name: "🎓 Self Learning", url: "/pages/self_learning.html" },
];

function flatPages() {
  const out = [];
  for (const item of NAV_ITEMS) {
    out.push(item);
    if (item.children) out.push(...item.children);
  }
  return out;
}

const REPO = "https://github.com/rifaterdemsahin/animation-asistant";
const REPO_COMMITS = REPO + "/commits/main";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function currentProject() {
  // Deep-link support: ?project=<project_id> (or legacy ?slug=<slug>) selects
  // the project. project_id is the canonical URL identifier.
  try {
    const params = new URLSearchParams(location.search);
    const qs = params.get("project") || params.get("slug");
    if (qs) {
      const cur = JSON.parse(localStorage.getItem("current_project") || "null");
      const same = cur && (cur.project_id === qs || cur.slug === qs);
      localStorage.setItem("current_project", JSON.stringify({
        project_id: qs,
        slug: (same && cur.slug) || qs,
        title: (same && cur.title) ? cur.title : qs,
      }));
    }
  } catch {}
  try {
    const c = JSON.parse(localStorage.getItem("current_project") || "null");
    // Back-compat: older entries stored only {slug, title} — treat slug as the
    // project_id (the backend resolves either).
    if (c && !c.project_id && c.slug) c.project_id = c.slug;
    return c;
  } catch { return null; }
}

// setCurrentProject updates the active project (project_id is the URL id;
// slug is kept for display/cache) and refreshes the header.
function setCurrentProject(projectID, slug, title) {
  localStorage.setItem("current_project", JSON.stringify({
    project_id: projectID,
    slug: slug || projectID,
    title: title || projectID,
  }));
  renderHeader();
}

let isAuthenticated = false;

async function checkAuth() {
  try {
    const r = await fetch("/api/me", { credentials: "same-origin" });
    isAuthenticated = r.ok;
  } catch {
    isAuthenticated = false;
  }
}

function buildNavItem(item) {
  if (item.children) {
    const links = item.children.map(c => `<a href="${c.url}">${c.name}</a>`).join("");
    return `<div class="nav-dropdown">
      <a href="${item.url}" class="nav-group-trigger">${item.name} ▾</a>
      <div class="nav-dropdown-menu">${links}</div>
    </div>`;
  }
  return `<a href="${item.url}">${item.name}</a>`;
}

async function renderNav() {
  const nav = document.getElementById("topnav");
  if (!nav) return;
  await checkAuth();
  const pageLinks = NAV_ITEMS.map(buildNavItem).join(" <span class=\"nav-sep\">&gt;</span> ");
  const authItem = isAuthenticated
    ? `<span class="logged-in-badge">👤 Logged in</span>`
    : `<a href="/pages/login.html">🔐 Login</a>`;
  const logoutBtn = isAuthenticated ? `<button id="logout-btn">Log out</button>` : "";
  nav.innerHTML = `
    <div class="navbar">
      <a class="brand" href="/">🎬 Animation Assistant</a>
      <nav class="nav-links">${pageLinks}</nav>
      <div class="search">
        <input id="nav-search" type="search" placeholder="Search pages…" autocomplete="off">
        <div id="search-results" class="search-results"></div>
      </div>
      ${authItem}
      ${logoutBtn}
    </div>`;
  wireSearch();
  const btn = document.getElementById("logout-btn");
  if (btn) btn.addEventListener("click", logout);
}

function renderHeader() {
  const h = document.getElementById("app-header");
  if (!h) return;
  const p = currentProject();
  h.innerHTML = `<div class="app-header">
      <span class="label">Project:</span>
      <span class="name">${p ? (p.title + " (" + (p.project_id || p.slug) + ")") : "none selected"}</span>
    </div>`;
}

function renderFooter() {
  const f = document.getElementById("app-footer");
  if (!f) return;
  f.innerHTML = `<div class="footer">
      <span>🎬 Animation Assistant</span>
      <a href="/pages/tools.html">🛠️ Tools</a>
      <a href="${REPO}" target="_blank">GitHub</a>
      <a href="https://openrouter.ai/logs" target="_blank">OpenRouter Logs</a>
      <a href="https://animation-assistant.fly.dev" target="_blank">fly.io</a>
      <a href="http://localhost:8080">Local</a>
      <span id="deploy-time" class="muted"></span>
    </div>`;
  fetchDeployTime();
}

function fetchDeployTime() {
  const el = document.getElementById("deploy-time");
  if (!el) return;
  fetch("/healthz", { credentials: "same-origin" })
    .then(r => r.json())
    .then(d => {
      var commit = (d.commit && d.commit !== "unknown") ? d.commit : "";
      var url = commit ? "https://github.com/rifaterdemsahin/animation-asistant/commit/" + commit : "https://github.com/rifaterdemsahin/animation-asistant/commits/main";
      var short = commit ? commit.substring(0, 7) : "local";
      el.innerHTML = '🚀 <a href="' + url + '" target="_blank" style="color:var(--accent)">' + short + '</a> — ' + (d.started_at || "");
    })
    .catch(() => {});
}

function wireSearch() {
  const input = document.getElementById("nav-search");
  const box = document.getElementById("search-results");
  if (!input || !box) return;
  const allPages = flatPages();
  const render = (q) => {
    const items = allPages.filter(p => p.url && p.name.toLowerCase().includes(q.toLowerCase()));
    box.innerHTML = items.map(p => `<a href="${p.url}">${p.name}</a>`).join("") ||
      `<a class="disabled">No matches</a>`;
    box.style.display = items.length ? "block" : "none";
  };
  input.addEventListener("input", () => render(input.value));
  input.addEventListener("focus", () => { if (input.value) render(input.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = allPages.find(p => p.url && p.name.toLowerCase().includes(input.value.toLowerCase()));
      if (first) location.href = first.url;
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search")) box.style.display = "none";
  });
}

async function logout() {
  try { await fetch("/api/logout", { method: "POST" }); } catch {}
  localStorage.removeItem("current_project");
  location.href = "/pages/login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  renderNav();
  renderHeader();
  renderFooter();
  document.dispatchEvent(new CustomEvent("layout:ready"));
});

window.currentProject = currentProject;
window.setCurrentProject = setCurrentProject;
