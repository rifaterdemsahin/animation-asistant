// Compare Image Models — Pro vs Flash storyboard comparison
// Loads q10 storyboard data and renders side-by-side comparison.

const PROJECT = "q10-multi-agent-research-system";
const ACT_NAMES = { "act-1": "Act 1 — Problem", "act-2": "Act 2 — Solution", "act-3": "Act 3 — Lesson" };

document.addEventListener("layout:ready", async () => {
  await window.setCurrentProject("q10", PROJECT, "Lost-in-the-Middle: Primacy & Recency");
  loadComparison();
});

async function loadComparison() {
  const container = document.getElementById("comparison");
  const promptEl = document.getElementById("prompt-text");
  const statsEl = document.getElementById("stats");
  const sizeBody = document.getElementById("size-body");

  try {
    const r = await fetch(`/api/projects/${PROJECT}/storyboard`, { credentials: "same-origin" });
    const data = await r.json();
    const versions = data.versions || [];

    // Separate pro and flash versions
    const proVersions = versions.filter(v => v.image_model.includes("pro"));
    const flashVersions = versions.filter(v => v.image_model.includes("flash"));

    if (proVersions.length === 0) {
      container.innerHTML = "<p class='empty'>No pro storyboard images found for q10.</p>";
      return;
    }

    // Render prompt
    const prompt = proVersions[0].image_prompt || "";
    promptEl.textContent = prompt;
    document.getElementById("prompt-body").classList.remove("hidden");

    // Compute stats
    const proCost = 0.146;
    const flashCost = 0.036;
    const proCost3 = (proCost * 3).toFixed(2);
    const flashCost3 = (flashCost * 3).toFixed(2);
    const savings = ((proCost - flashCost) / proCost * 100).toFixed(0);

    statsEl.innerHTML = `
      <div class="stat">
        <div class="label">Pro Cost / Image</div>
        <div class="value">$${proCost}</div>
      </div>
      <div class="stat">
        <div class="label">Flash Cost / Image</div>
        <div class="value" style="color:#34d399">$${flashCost}</div>
      </div>
      <div class="stat">
        <div class="label">Savings</div>
        <div class="value" style="color:#34d399">${savings}%</div>
      </div>
      <div class="stat">
        <div class="label">Prompt Length</div>
        <div class="value">${prompt.length.toLocaleString()} chars</div>
      </div>
    `;

    // Render acts side by side
    const acts = ["act-1", "act-2", "act-3"];
    const proSizes = {};
    const flashSizes = {};
    let html = "";

    for (const act of acts) {
      const proV = proVersions.find(v => v.act === act);
      const flashV = flashVersions.find(v => v.act === act);

      if (!proV) continue;

      const proFile = proV.file;
      const flashFile = flashV ? flashV.file : null;

      html += `<div class="act-section">`;
      html += `<h2>${ACT_NAMES[act] || act}</h2>`;
      html += `<div class="compare-grid">`;

      // Pro card
      html += `<div class="compare-card">`;
      html += `<h3><span class="model-badge-pro">PRO</span> ${proV.image_model}</h3>`;
      html += `<a href="/api/projects/${PROJECT}/raw/${proFile}" target="_blank">`;
      html += `<img src="/api/projects/${PROJECT}/raw/${proFile}" alt="Pro ${act}" loading="lazy" onload="window.sizeCallback && window.sizeCallback('pro', '${act}', this.naturalWidth, this.naturalHeight)" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%23334155%22 width=%22400%22 height=%22300%22/><text fill=%22%2394a3b8%22 x=%22200%22 y=%22150%22 text-anchor=%22middle%22>Image not loaded</text></svg>'">`;
      html += `</a>`;
      html += `<p style="margin-top:0.5rem;font-size:0.85em;color:#94a3b8">Model: <code>${proV.image_model}</code><br>File: <code>${proFile}</code></p>`;
      html += `</div>`;

      // Flash card
      html += `<div class="compare-card">`;
      if (flashV) {
        html += `<h3><span class="model-badge-flash">FLASH</span> ${flashV.image_model}</h3>`;
        html += `<a href="/api/projects/${PROJECT}/raw/${flashFile}" target="_blank">`;
        html += `<img src="/api/projects/${PROJECT}/raw/${flashFile}" alt="Flash ${act}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%23334155%22 width=%22400%22 height=%22300%22/><text fill=%22%2394a3b8%22 x=%22200%22 y=%22150%22 text-anchor=%22middle%22>Image not loaded</text></svg>'">`;
        html += `</a>`;
        html += `<p style="margin-top:0.5rem;font-size:0.85em;color:#94a3b8">Model: <code>${flashV.image_model}</code><br>File: <code>${flashFile}</code></p>`;
      } else {
        html += `<h3><span class="model-badge-flash">FLASH</span> Not yet generated</h3>`;
        html += `<p style="color:#94a3b8">Set <code>STORYBOARD_IMAGE_MODEL=google/gemini-3.1-flash-image</code> and regenerate to see flash output here.</p>`;
      }
      html += `</div>`;

      html += `</div></div>`;
    }

    container.innerHTML = html;

    // Fetch image sizes for the size table
    fetchImageSizes(proVersions, flashVersions, sizeBody);

  } catch (err) {
    container.innerHTML = `<p class="empty">Failed to load comparison: ${escapeHtml(String(err))}</p>`;
    console.error(err);
  }
}

async function fetchImageSizes(proVersions, flashVersions, sizeBody) {
  const rows = [];
  for (const act of ["act-1", "act-2", "act-3"]) {
    const proV = proVersions.find(v => v.act === act);
    const flashV = flashVersions.find(v => v.act === act);
    if (!proV) continue;

    let proSizeStr = "—";
    let flashSizeStr = "—";
    let deltaStr = "—";

    try {
      const proResp = await fetch(`/api/projects/${PROJECT}/raw/${proV.file}`, { method: "HEAD", credentials: "same-origin" });
      const proSize = parseInt(proResp.headers.get("content-length") || "0");
      proSizeStr = formatBytes(proSize);

      if (flashV) {
        const flashResp = await fetch(`/api/projects/${PROJECT}/raw/${flashV.file}`, { method: "HEAD", credentials: "same-origin" });
        const flashSize = parseInt(flashResp.headers.get("content-length") || "0");
        flashSizeStr = formatBytes(flashSize);
        if (proSize > 0) {
          const pct = ((flashSize - proSize) / proSize * 100).toFixed(0);
          const emoji = flashSize > proSize ? "📈" : "📉";
          deltaStr = `${emoji} ${pct > 0 ? "+" : ""}${pct}%`;
        }
      }
    } catch (e) { /* ignore */ }

    rows.push(`<tr><td>${ACT_NAMES[act] || act}</td><td>${proSizeStr}</td><td>${flashSizeStr}</td><td>${deltaStr}</td></tr>`);
  }
  sizeBody.innerHTML = rows.join("");
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
