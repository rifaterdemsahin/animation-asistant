// Dashboard: show the current project panel if one is selected.
document.addEventListener("layout:ready", () => {
  const p = window.currentProject && window.currentProject();
  const panel = document.getElementById("current-project-panel");
  const name = document.getElementById("current-project-name");
  if (p && panel) {
    panel.classList.remove("hidden");
    name.textContent = `${p.title} (${p.slug})`;
  }
});
