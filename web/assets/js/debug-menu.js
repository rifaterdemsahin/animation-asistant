// Shared debug overlay menu — used by index.html and markdown_renderer.html
(function () {
  "use strict";

  function setCookie(name, value, days) {
    days = days || 7;
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + "=" + value + ";path=/;expires=" + d.toUTCString() + ";SameSite=Strict";
  }

  function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  function debugLog(message, data) {
    if (getCookie("debug") === "true") {
      console.log("%c[Debug Mode] " + message, "color: #06b6d4; font-weight: bold;", data || "");
    }
  }

  window.debugLog = debugLog;
  window.getCookie = getCookie;
  window.setCookie = setCookie;

  var navigationData = {
    projectMenu: [
      { label: "Home",     url: "index.html" },
      { label: "Docs",     url: "markdown_renderer.html?file=2_Environment/README.md" },
      { label: "API",      url: "markdown_renderer.html?file=4_Formula/README.md" }
    ],
    debugMenu: [
      { label: "1. Real Unknown",                url: "1_Real_Unknown/" },
      { label: "   ├─ Kanban Board",             url: "1_Real_Unknown/kanban.md" },
      { label: "   ├─ Cost Tracker",             url: "1_Real_Unknown/costs.md" },
      { label: "2. Environment",                 url: "2_Environment/" },
      { label: "   ├─ Architecture",             url: "2_Environment/architecture.md" },
      { label: "   ├─ Tools Overview",           url: "2_Environment/tools.md" },
      { label: "   ├─ Fly.io (Deployments)",     url: "2_Environment/fly_io.md" },
      { label: "   ├─ Supabase (Database)",      url: "2_Environment/supabase.md" },
      { label: "   ├─ Axiom (Logs)",             url: "2_Environment/axiom.md" },
      { label: "3. Simulation",                  url: "3_Simulation/" },
      { label: "4. Formula",                     url: "4_Formula/" },
      { label: "   ├─ Database",                 url: "4_Formula/database.md" },
      { label: "   ├─ Extensions",               url: "4_Formula/extensions.md" },
      { label: "   ├─ Navigation",               url: "4_Formula/navigation.md" },
      { label: "   ├─ Logging & Auto-Fix",       url: "4_Formula/logging_and_autofix.md" },
      { label: "5. Symbols",                     url: "5_Symbols/" },
      { label: "6. Semblance",                   url: "6_Semblance/" },
      { label: "7. Testing Known",              url: "7_Testing_Known/" },
      { label: "---",                            url: "divider" },
      { label: "agents.md",                      url: "agents.md" },
      { label: "prompts.md",                     url: "prompts.md" },
      { label: "claude.md",                      url: "claude.md" },
      { label: "gemini.md",                      url: "gemini.md" },
      { label: "copilot.md",                     url: "copilot.md" },
      { label: "kilocode.md",                    url: "kilocode.md" }
    ]
  };

  function routeUrl(url) {
    if (url === "index.html" || url === "divider" || url.startsWith("http") || url.includes("markdown_renderer.html")) return url;
    return "markdown_renderer.html?file=" + url;
  }

  function buildDebugMenu(container, filterText) {
    var query = (filterText || "").toLowerCase();
    container.innerHTML = "";
    for (var i = 0; i < navigationData.debugMenu.length; i++) {
      var item = navigationData.debugMenu[i];
      if (query && item.label === "---") continue;
      if (query && item.label.toLowerCase().indexOf(query) === -1) continue;

      if (item.label === "---") {
        var divider = document.createElement("li");
        divider.className = "debug-divider";
        container.appendChild(divider);
      } else {
        var li = document.createElement("li");
        li.className = "debug-item";
        var a = document.createElement("a");
        a.href = routeUrl(item.url);
        a.className = "debug-link";
        a.innerHTML = "<span>" + item.label + "</span><i class=\"fa-solid fa-chevron-right debug-link-icon\"></i>";
        li.appendChild(a);
        container.appendChild(li);
      }
    }
  }

  function buildProjectMenu(container) {
    container.innerHTML = "";
    for (var i = 0; i < navigationData.projectMenu.length; i++) {
      var item = navigationData.projectMenu[i];
      var link = document.createElement("a");
      link.href = routeUrl(item.url);
      link.className = "menu-link" + (i === 0 ? " active" : "");
      link.textContent = item.label;
      container.appendChild(link);
    }
  }

  function init() {
    debugLog("DOM content fully loaded.");

    var debugToggle    = document.getElementById("debugToggle");
    var debugClose     = document.getElementById("debugClose");
    var debugOverlay   = document.getElementById("debugMenuOverlay");
    var debugSearch    = document.getElementById("debugSearch");
    var debugLinksList = document.getElementById("debugLinksList");
    var projectMenu    = document.getElementById("projectMenu");

    function boot() {
      if (projectMenu) buildProjectMenu(projectMenu);
      if (debugLinksList) buildDebugMenu(debugLinksList);
    }

    fetch("navigation_config.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        debugLog("Dynamic navigation config loaded.", data);
        navigationData = data;
        boot();
      })
      .catch(function (err) {
        console.warn("Failed to load navigation config, using local fallback.", err);
        boot();
      });

    if (debugSearch) {
      var searchTimer;
      debugSearch.addEventListener("input", function (e) {
        clearTimeout(searchTimer);
        var val = e.target.value;
        searchTimer = setTimeout(function () {
          if (debugLinksList) buildDebugMenu(debugLinksList, val);
        }, 150);
      });
    }

    if (debugOverlay && getCookie("debug") === "true") {
      debugOverlay.classList.add("open");
    }

    if (debugToggle && debugOverlay) {
      debugToggle.addEventListener("click", function () {
        var isOpen = debugOverlay.classList.toggle("open");
        setCookie("debug", isOpen ? "true" : "false");
        debugLog("Debug overlay toggled. Active state:", isOpen);
      });
    }

    if (debugClose && debugOverlay) {
      debugClose.addEventListener("click", function () {
        debugOverlay.classList.remove("open");
        setCookie("debug", "false");
        debugLog("Debug overlay closed.");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
