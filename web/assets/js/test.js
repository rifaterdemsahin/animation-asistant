function addResult(label, ok, detail) {
  var d = document.createElement("div");
  d.style.margin = "4px 0";
  d.style.padding = "8px";
  d.style.borderRadius = "6px";
  d.style.border = "1px solid var(--border)";
  d.style.background = ok ? "#17241a" : "#24171a";
  d.innerHTML = "<strong>" + (ok ? "✅" : "❌") + " " + label + "</strong>";
  if (detail) {
    var span = document.createElement("span");
    span.className = "muted";
    span.textContent = " " + detail;
    d.appendChild(span);
  }
  document.getElementById("results").appendChild(d);
}

document.addEventListener("layout:ready", function () {
  document.getElementById("btn-run").addEventListener("click", async function () {
    document.getElementById("results").innerHTML = "";

    addResult("Test Library", true, "Go testing package (go test ./...)");

    try {
      var r = await fetch("/healthz", { credentials: "same-origin" });
      if (!r.ok) throw new Error(r.statusText);
      var data = await r.json();
      addResult("GET /healthz", true, "200 OK — commit: " + (data.commit || "?").substring(0, 7) + ", started: " + (data.started_at || "?"));
    } catch (e) {
      addResult("GET /healthz", false, e.message);
    }

    try {
      var r2 = await fetch("/api/me", { credentials: "same-origin" });
      addResult("Auth check", r2.ok, r2.ok ? "Authenticated" : "Not authenticated");
    } catch (e) {
      addResult("Auth check", false, e.message);
    }

    var prompt = document.getElementById("test-prompt").value.trim();
    if (prompt) {
      addResult("Sample prompt", true, '"' + prompt.substring(0, 80) + (prompt.length > 80 ? "…" : "") + '"');
    }
  });
});
