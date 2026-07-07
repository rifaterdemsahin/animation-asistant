// Shared shell: top nav (links + search + logout), header (current project), footer.
// Each page includes empty <div id="topnav">, <header id="app-header">, <footer id="app-footer">.

const PAGES = [
  { name: "Dashboard", url: "/" },
  { name: "Projects", url: "/pages/projects.html" },
  { name: "Media Manager", url: "/pages/media-manager.html" },
  { name: "Storyboard (soon)", url: "" },
  { name: "Login", url: "/pages/login.html" },
];

const REPO = "https://github.com/rifaterdemsahin/animation-asistant";
const REPO_COMMITS = REPO + "/commits/main";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function currentProject() {
  try { return JSON.parse(localStorage.getItem("current_project") || "null"); }
  catch { return null; }
}

function renderNav() {
  const nav = document.getElementById("topnav");
  if (!nav) return;
  const links = PAGES.map(p =>
    `<a href="${p.url || "#"}" class="${p.url ? "" : "disabled"}">${p.name}</a>`).join("");
  nav.innerHTML = `
    <div class="navbar">
      <a class="brand" href="/">Animation Assistant</a>
      <nav class="nav-links">${links}</nav>
      <div class="search">
        <input id="nav-search" type="search" placeholder="Search pages…" autocomplete="off">
        <div id="search-results" class="search-results"></div>
      </div>
      <button id="logout-btn">Log out</button>
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
      <span class="name">${p ? (p.title + " (" + p.slug + ")") : "none selected"}</span>
    </div>`;
}

function renderFooter() {
  const f = document.getElementById("app-footer");
  if (!f) return;
  f.innerHTML = `<div class="footer">
      <span>Animation Assistant</span>
      <a href="${REPO}" target="_blank">GitHub</a>
      <a href="${REPO_COMMITS}" target="_blank">Commits</a>
      <a href="https://animation-assistant.fly.dev" target="_blank">fly.io</a>
      <a href="http://localhost:8080">Local</a>
    </div>`;
}

function wireSearch() {
  const input = document.getElementById("nav-search");
  const box = document.getElementById("search-results");
  if (!input || !box) return;
  const render = (q) => {
    const items = PAGES.filter(p => p.url && p.name.toLowerCase().includes(q.toLowerCase()));
    box.innerHTML = items.map(p => `<a href="${p.url}">${p.name}</a>`).join("") ||
      `<a class="disabled">No matches</a>`;
    box.style.display = items.length ? "block" : "none";
  };
  input.addEventListener("input", () => render(input.value));
  input.addEventListener("focus", () => { if (input.value) render(input.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = PAGES.find(p => p.url && p.name.toLowerCase().includes(input.value.toLowerCase()));
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
