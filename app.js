/* ============================================================
   M365 License Finder — application logic
   Static, client-side only. Loads assets/products.json (curated
   pricing + feature dataset) and assets/matrix.json (full feature
   matrix from m365maps.com) and renders filters, recommendations,
   and the matrix table.
   ============================================================ */

(function () {
  "use strict";

  let PRODUCTS = null;
  let MATRIX = null;
  const state = {
    core: {
      mailbox: { enabled: false, tier: "plan1" },
      intune: { enabled: false, tier: "plan1" },
      entra: { enabled: false, tier: "p1" },
      encryption: { enabled: false, tier: "basic" },
    },
    advanced: {
      teams: { enabled: false },
      officeApps: { enabled: false },
      defenderO365: { enabled: false, tier: "plan1" },
      compliance: { enabled: false, tier: "standard" },
      windowsRights: { enabled: false },
    },
    userCount: null,
    matrixSearch: "",
    collapsedCategories: new Set(),
  };

  const CORE_FILTERS = [
    {
      key: "mailbox",
      title: "Mailbox",
      desc: "Hosted email via Exchange Online",
      tiers: [
        { value: "kiosk", label: "Any (Kiosk, 2 GB+)" },
        { value: "plan1", label: "Standard (Plan 1, 50–100 GB)" },
        { value: "plan2", label: "Large (Plan 2, 100 GB + 1.5 TB archive)" },
      ],
    },
    {
      key: "intune",
      title: "Intune",
      desc: "Mobile device & app management",
      tiers: [
        { value: "plan1", label: "Plan 1 (core MDM/MAM)" },
        { value: "plan2", label: "Plan 2 (+ Tunnel, specialty devices)" },
        { value: "suite", label: "Intune Suite (+ Remote Help, analytics)" },
      ],
    },
    {
      key: "entra",
      title: "Entra ID",
      desc: "Identity, SSO & conditional access",
      tiers: [
        { value: "p1", label: "Plan 1 (MFA, SSO, Conditional Access)" },
        { value: "p2", label: "Plan 2 (+ Identity Protection, PIM)" },
      ],
    },
    {
      key: "encryption",
      title: "Encrypted email",
      desc: "Message-level encryption for sensitive mail",
      tiers: [
        { value: "basic", label: "Basic (Purview Message Encryption)" },
        { value: "advanced", label: "Advanced (+ revocation, expiring links)" },
      ],
    },
  ];

  const ADVANCED_FILTERS = [
    { key: "teams", title: "Microsoft Teams", desc: "Chat, meetings & calling", kind: "bool" },
    { key: "officeApps", title: "Office desktop apps", desc: "Installed Word, Excel, PowerPoint, Outlook", kind: "bool" },
    {
      key: "defenderO365", title: "Defender for Office 365", desc: "Anti-phishing & attack protection", kind: "tier",
      tiers: [
        { value: "plan1", label: "Plan 1 (anti-phishing, Safe Links/Attachments)" },
        { value: "plan2", label: "Plan 2 (+ automated investigation & response)" },
      ],
    },
    {
      key: "compliance", title: "Compliance & DLP", desc: "Data loss prevention, eDiscovery, audit", kind: "tier",
      tiers: [
        { value: "standard", label: "Standard (DLP, standard audit/eDiscovery)" },
        { value: "premium", label: "Premium (insider risk, premium audit/eDiscovery)" },
      ],
    },
    { key: "windowsRights", title: "Windows Enterprise rights", desc: "Upgrade rights to Windows 11 Enterprise", kind: "bool" },
  ];

  const DIM_LABELS = {
    mailbox: "Mailbox", intune: "Intune", entra: "Entra ID", encryption: "Encrypted email",
    defenderO365: "Defender for Office 365", compliance: "Compliance & DLP",
    teams: "Teams", officeApps: "Office apps", windowsRights: "Windows rights",
  };

  async function loadData() {
    const [p, m] = await Promise.all([
      fetch("assets/products.json").then((r) => r.json()),
      fetch("assets/matrix.json").then((r) => r.json()),
    ]);
    PRODUCTS = p;
    MATRIX = m;
  }

  /* ---------------- Theme ---------------- */
  function initTheme() {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    document.getElementById("themeToggle").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
    });
  }

  /* ---------------- Filters UI ---------------- */
  function renderCoreFilters() {
    const root = document.getElementById("coreFilters");
    root.innerHTML = "";
    CORE_FILTERS.forEach((f) => {
      const s = state.core[f.key];
      const card = document.createElement("div");
      card.className = "feature-card" + (s.enabled ? " checked" : "");
      card.innerHTML = `
        <label class="feature-card-top">
          <input type="checkbox" class="feature-checkbox" data-core="${f.key}" ${s.enabled ? "checked" : ""} data-testid="checkbox-core-${f.key}" />
          <span>
            <span class="feature-card-title">${f.title}</span>
            <span class="feature-card-desc">${f.desc}</span>
          </span>
        </label>
        <div class="feature-card-tier">
          <select data-core-tier="${f.key}" ${s.enabled ? "" : "disabled"} data-testid="select-core-${f.key}-tier">
            ${f.tiers.map((t) => `<option value="${t.value}" ${t.value === s.tier ? "selected" : ""}>${t.label}</option>`).join("")}
          </select>
        </div>
      `;
      root.appendChild(card);
    });

    root.querySelectorAll("[data-core]").forEach((el) => {
      el.addEventListener("change", (e) => {
        state.core[e.target.dataset.core].enabled = e.target.checked;
        renderCoreFilters();
        renderResults();
      });
    });
    root.querySelectorAll("[data-core-tier]").forEach((el) => {
      el.addEventListener("change", (e) => {
        state.core[e.target.dataset.coreTier].tier = e.target.value;
        renderResults();
      });
    });
  }

  function renderAdvancedFilters() {
    const root = document.getElementById("advancedFilters");
    root.innerHTML = "";
    ADVANCED_FILTERS.forEach((f) => {
      const s = state.advanced[f.key];
      const card = document.createElement("div");
      card.className = "feature-card" + (s.enabled ? " checked" : "");
      let tierHtml = "";
      if (f.kind === "tier") {
        tierHtml = `<div class="feature-card-tier"><select data-adv-tier="${f.key}" ${s.enabled ? "" : "disabled"} data-testid="select-adv-${f.key}-tier">
          ${f.tiers.map((t) => `<option value="${t.value}" ${t.value === s.tier ? "selected" : ""}>${t.label}</option>`).join("")}
        </select></div>`;
      }
      card.innerHTML = `
        <label class="feature-card-top">
          <input type="checkbox" class="feature-checkbox" data-adv="${f.key}" ${s.enabled ? "checked" : ""} data-testid="checkbox-adv-${f.key}" />
          <span>
            <span class="feature-card-title">${f.title}</span>
            <span class="feature-card-desc">${f.desc}</span>
          </span>
        </label>
        ${tierHtml}
      `;
      root.appendChild(card);
    });
    root.querySelectorAll("[data-adv]").forEach((el) => {
      el.addEventListener("change", (e) => {
        state.advanced[e.target.dataset.adv].enabled = e.target.checked;
        renderAdvancedFilters();
        renderResults();
      });
    });
    root.querySelectorAll("[data-adv-tier]").forEach((el) => {
      el.addEventListener("change", (e) => {
        state.advanced[e.target.dataset.advTier].tier = e.target.value;
        renderResults();
      });
    });
  }

  function wireControlBar() {
    document.getElementById("resetFilters").addEventListener("click", () => {
      Object.values(state.core).forEach((s) => (s.enabled = false));
      Object.values(state.advanced).forEach((s) => (s.enabled = false));
      state.userCount = null;
      document.getElementById("userCount").value = "";
      renderCoreFilters();
      renderAdvancedFilters();
      renderResults();
    });

    const advToggle = document.getElementById("advancedToggle");
    const advPanel = document.getElementById("advancedFilters");
    advToggle.addEventListener("click", () => {
      const isOpen = advToggle.getAttribute("aria-expanded") === "true";
      advToggle.setAttribute("aria-expanded", String(!isOpen));
      advPanel.hidden = isOpen;
    });

    document.getElementById("userCount").addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      state.userCount = isNaN(v) ? null : v;
      renderResults();
    });
  }

  /* ---------------- Recommendation engine ---------------- */
  function getItemTierRank(item, dim) {
    const tr = PRODUCTS.tierRank;
    switch (dim) {
      case "teams": return item.teams ? 1 : 0;
      case "officeApps": return item.officeApps ? 1 : 0;
      case "windowsRights": return item.windowsRights ? 1 : 0;
      case "mailbox": return tr.mailbox[item.mailbox.tier] || 0;
      case "intune": return tr.intune[item.intune.tier] || 0;
      case "entra": return tr.entra[item.entra.tier] || 0;
      case "encryption": return tr.encryption[item.encryption.tier] || 0;
      case "defenderO365": return tr.defender_o365[item.defenderO365.tier] || 0;
      case "compliance": return tr.compliance[item.compliance.tier] || 0;
      default: return 0;
    }
  }

  function getRequiredDims() {
    // Returns array of {dim, rank}
    const reqs = [];
    CORE_FILTERS.forEach((f) => {
      const s = state.core[f.key];
      if (s.enabled) reqs.push({ dim: f.key, rank: PRODUCTS.tierRank[f.key === "mailbox" ? "mailbox" : f.key][s.tier] });
    });
    ADVANCED_FILTERS.forEach((f) => {
      const s = state.advanced[f.key];
      if (!s.enabled) return;
      if (f.kind === "bool") {
        reqs.push({ dim: f.key, rank: 1 });
      } else {
        const trKey = f.key === "defenderO365" ? "defender_o365" : f.key;
        reqs.push({ dim: f.key, rank: PRODUCTS.tierRank[trKey][s.tier] });
      }
    });
    return reqs;
  }

  function comboSatisfiesRequirement(comboItems, item, reqStr) {
    const [dim, tierName] = reqStr.split(":");
    if (dim === "base") {
      // e.g. "base:e3class" — some OTHER item in combo must carry the tag
      return comboItems.some((other) => other !== item && (other.tags || []).includes(tierName));
    }
    const trKey = dim === "defenderO365" ? "defender_o365" : dim;
    const requiredRank = PRODUCTS.tierRank[trKey][tierName];
    return comboItems.some((other) => other !== item && getItemTierRank(other, dim) >= requiredRank);
  }

  function comboIsValid(comboItems) {
    for (const item of comboItems) {
      for (const req of item.requires || []) {
        if (!comboSatisfiesRequirement(comboItems, item, req)) return false;
      }
    }
    return true;
  }

  function mergedTier(comboItems, dim) {
    return Math.max(0, ...comboItems.map((it) => getItemTierRank(it, dim)));
  }

  function comboPrice(comboItems) {
    return comboItems.reduce((sum, it) => sum + it.price, 0);
  }

  function* combinations(arr, k) {
    const n = arr.length;
    const idx = Array.from({ length: k }, (_, i) => i);
    if (k > n) return;
    while (true) {
      yield idx.map((i) => arr[i]);
      let i = k - 1;
      while (i >= 0 && idx[i] === n - k + i) i--;
      if (i < 0) return;
      idx[i]++;
      for (let j = i + 1; j < k; j++) idx[j] = idx[i] + (j - i);
    }
  }

  function findRecommendations() {
    const reqs = getRequiredDims();
    if (reqs.length === 0) return { reqs, best: null, bestSingle: null };

    let pool = PRODUCTS.items;
    const excludeBusinessNote = state.userCount && state.userCount > 300;
    if (excludeBusinessNote) pool = pool.filter((it) => it.family !== "Business");

    let best = null; // cheapest overall combo (any size)
    let bestSingle = null; // cheapest size-1 combo

    const maxSize = 4;
    for (let size = 1; size <= maxSize; size++) {
      for (const combo of combinations(pool, size)) {
        if (!comboIsValid(combo)) continue;
        const meetsAll = reqs.every((r) => mergedTier(combo, r.dim) >= r.rank);
        if (!meetsAll) continue;
        const price = comboPrice(combo);
        if (!best || price < best.price) best = { items: combo, price };
        if (size === 1 && (!bestSingle || price < bestSingle.price)) bestSingle = { items: combo, price };
      }
      // Early exit: if we already found a size-1 best, no need to search larger combos
      // that can't possibly beat it on price floor — but continue since add-on combos
      // can sometimes tie; keep searching all sizes up to maxSize for correctness.
    }

    return { reqs, best, bestSingle, excludedBusiness: excludeBusinessNote };
  }

  function formatMoney(n) {
    return "$" + n.toFixed(2);
  }

  function renderFeatureChecklist(reqs, combo) {
    return reqs.map((r) => {
      const rank = mergedTier(combo.items, r.dim);
      const ok = rank >= r.rank;
      const label = DIM_LABELS[r.dim];
      return `<li><span class="tick">${ok ? iconCheck("var(--color-success)") : iconCross()}</span> ${label}</li>`;
    }).join("");
  }

  function iconCheck(color) {
    return `<svg width="15" height="15" viewBox="0 0 24 24"><path d="M5 13l4.5 4.5L19 7" stroke="${color}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function iconCross() {
    return `<svg width="15" height="15" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="var(--color-error)" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  }

  function sourceLinksFor(combo) {
    const urls = new Map();
    combo.items.forEach((it) => (it.sources || []).forEach((u) => urls.set(u, it.name)));
    return Array.from(urls.entries()).map(([u]) => `<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname.replace("www.", "")}</a>`).join(" · ");
  }

  function renderResultCard(combo, reqs, { best } = {}) {
    const names = combo.items.map((it) => it.name).join(" + ");
    const partCount = combo.items.length;
    return `
      <div class="result-card ${best ? "best" : ""}" data-testid="card-result-${best ? "best" : "alt"}">
        ${best ? '<span class="result-badge">Cheapest match</span>' : ""}
        <span class="result-kicker">${partCount > 1 ? partCount + "-part combo" : "Single license"}</span>
        <h3 class="result-title">${names}</h3>
        <div class="result-price">${formatMoney(combo.price)} <small>/ user / month</small></div>
        ${partCount > 1 ? `<div class="result-parts">${combo.items.map((it) => `${it.name} (${formatMoney(it.price)})`).join(" + ")}</div>` : ""}
        <ul class="result-feature-list">${renderFeatureChecklist(reqs, combo)}</ul>
        ${combo.items.some((it) => (it.requiresLabel)) ? `<div class="result-note">${combo.items.filter((it) => it.requiresLabel).map((it) => it.requiresLabel).join(" · ")}</div>` : ""}
        <div class="result-sources">Sources: ${sourceLinksFor(combo)}</div>
      </div>
    `;
  }

  function renderResults() {
    const area = document.getElementById("resultsArea");
    const { reqs, best, bestSingle, excludedBusiness } = findRecommendations();

    if (reqs.length === 0) {
      area.innerHTML = `
        <div class="result-placeholder" data-testid="placeholder-no-filters">
          <svg width="40" height="40" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
          <p>Check at least one capability above to see recommended licenses.</p>
        </div>`;
      return;
    }

    if (!best) {
      area.innerHTML = `
        <div class="result-empty" data-testid="placeholder-no-match">
          <p><strong>No purchasable combination (up to 4 parts) satisfies every selected requirement.</strong></p>
          <p class="matrix-sub">Try lowering a tier requirement, or check the "Not sold as a standalone add-on" section below — some retired SKUs may be the reason.</p>
        </div>`;
      return;
    }

    let html = '<div class="results-grid">';
    html += renderResultCard(best, reqs, { best: true });
    if (bestSingle && (bestSingle.items[0] !== best.items[0] || best.items.length > 1) && bestSingle.price !== best.price) {
      html += renderResultCard(bestSingle, reqs, { best: false });
    }
    html += "</div>";
    if (excludedBusiness) {
      html += `<p class="result-note" style="margin-top:1rem;display:inline-block;" data-testid="note-business-cap">Microsoft 365 Business plans are capped at 300 users, so they were excluded for your ${state.userCount}-user estimate.</p>`;
    }
    area.innerHTML = html;
  }

  /* ---------------- Freshness / footer ---------------- */
  function renderFreshness() {
    const row = document.getElementById("freshnessRow");
    const chip = (text) => `<span class="freshness-chip"><svg width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>${text}</span>`;
    row.innerHTML = [
      chip(`Pricing verified ${PRODUCTS.meta.pricing_verified}`),
      chip(`Feature matrix dated ${PRODUCTS.meta.feature_matrix_dated}`),
      chip(`SKU reference checked ${PRODUCTS.meta.sku_identifier_checked}`),
      chip("Static snapshot — not a live Microsoft feed"),
    ].join("");
    document.getElementById("matrixDate").textContent = MATRIX.lastUpdated;

    document.getElementById("footerDisclaimer").textContent = PRODUCTS.meta.disclaimer;
    const links = [
      ["Business plans & pricing", "https://www.microsoft.com/en-us/microsoft-365/business/with-teams-plans-and-pricing"],
      ["Enterprise (Office 365) pricing", "https://www.microsoft.com/en-us/microsoft-365/enterprise/office-365-plans-and-pricing"],
      ["Enterprise (Microsoft 365) pricing", "https://www.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plans-and-pricing"],
      ["Entra ID pricing", "https://www.microsoft.com/en-us/security/business/microsoft-entra-pricing"],
      ["Intune pricing", "https://www.microsoft.com/en-us/security/microsoft-intune-pricing"],
      ["OME FAQ", "https://learn.microsoft.com/en-us/purview/ome-faq"],
      ["M365 Maps (feature matrix source)", "https://m365maps.com/"],
      ["Microsoft licensing reference CSV (SKU \u2192 service plans)", "https://learn.microsoft.com/en-us/entra/identity/users/licensing-service-plan-reference"],
      ["Microsoft 365 pricing & packaging updates (official summary)", "https://www.microsoft.com/en-us/licensing/news/2026-m365-packaging-pricing-updates"],
    ];
    document.getElementById("footerLinks").innerHTML = links.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join("");
  }

  function renderUnavailable() {
    const root = document.getElementById("unavailableList");
    root.innerHTML = PRODUCTS.unavailableReference.map((u) => `
      <div class="unavailable-card">
        <h3>${u.name}</h3>
        <p>${u.note}</p>
        ${(u.sources || []).map((s) => `<a href="${s}" target="_blank" rel="noopener">${new URL(s).hostname.replace("www.", "")}</a>`).join(" · ")}
      </div>
    `).join("");
  }

  /* ---------------- Matrix ---------------- */
  // The source workbook (m365maps.com) uses a handful of single-character
  // marker symbols (⊡, Δ, +, ~, --) in place of a checkmark, but does not
  // publish a legend defining them anywhere on the site or in the file's
  // metadata/comments. Rather than presenting an unexplained glyph as if it
  // were meaningful, we label these honestly as "Conditional" and point to
  // the source for verification. Descriptive text values (e.g. "Plan 2 (100
  // GB)", "Optional", "36 months") ARE self-explanatory and are shown as-is.
  const UNDOCUMENTED_SYMBOLS = new Set(["⊡", "Δ", "+", "~", "--", "-"]);

  function cellRender(value) {
    if (value === "✔" || value === "Yes") {
      return `<span class="cell-dot" title="Included">${iconCheck("var(--color-success)")}</span>`;
    }
    if (value === null || value === undefined || value === "") {
      return `<span class="cell-dot" title="Not included">–</span>`;
    }
    const raw = String(value).replace(/\s+/g, " ").trim();
    if (UNDOCUMENTED_SYMBOLS.has(raw)) {
      const title = "Conditional — the source matrix flags this cell but publishes no legend for its marker. Verify against official Microsoft documentation before relying on it.";
      return `<span class="cell-dot" title="${title}">◐</span><span class="cell-partial-label">Conditional<sup>†</sup></span>`;
    }
    // descriptive text (plan tier, storage size, duration, etc.) — self-explanatory
    return `<span class="cell-dot" title="${raw.replace(/"/g, "&quot;")}">◐</span><span class="cell-partial-label">${raw}</span>`;
  }

  function cellClass(value) {
    if (value === "✔" || value === "Yes") return "cell-yes";
    if (value === null || value === undefined || value === "") return "cell-no";
    return "cell-partial";
  }

  function categoryColor(idx) {
    return `var(--cat-${(idx % 15) + 1})`;
  }

  function renderMatrixLegend() {
    const root = document.getElementById("matrixLegend");
    root.innerHTML = `
      <span class="legend-item"><span class="legend-dot" style="background:var(--color-success-highlight)"></span>Included</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--color-warning-highlight)"></span>Conditional / requires add-on</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--color-neutral-highlight)"></span>Not included</span>
      <span class="legend-item legend-footnote">† Hover a “Conditional” cell marked only with a dagger — the source matrix flags it but does not define the marker; confirm details with Microsoft directly.</span>
    `;
  }

  function renderMatrixHead() {
    const head = document.getElementById("matrixHead");
    const cols = MATRIX.planOrder;
    head.innerHTML = `<tr>
      <th class="feature-col">Feature</th>
      ${cols.map((c) => `<th>${MATRIX.planMeta[c] ? MATRIX.planMeta[c].label : c}</th>`).join("")}
    </tr>`;
  }

  function renderMatrixBody() {
    const body = document.getElementById("matrixBody");
    const cols = MATRIX.planOrder;
    const search = state.matrixSearch.trim().toLowerCase();
    let html = "";
    let anyVisible = false;

    MATRIX.categoryOrder.forEach((cat, catIdx) => {
      const rows = MATRIX.features.filter((f) => f.category === cat);
      const matchingRows = search ? rows.filter((r) => r.feature.toLowerCase().includes(search)) : rows;
      const hasMatch = matchingRows.length > 0;
      if (search && !hasMatch) return;
      anyVisible = true;
      const collapsed = search ? false : state.collapsedCategories.has(cat);

      html += `<tr class="category-row ${collapsed ? "collapsed" : ""}" data-cat="${cat}">
        <td class="feature-col" colspan="${cols.length + 1}">
          <span class="category-chip"><span class="category-caret">▾</span><span class="dot" style="background:${categoryColor(catIdx)}"></span>${cat} <span style="color:var(--color-text-faint);font-weight:400;">(${rows.length})</span></span>
        </td>
      </tr>`;

      const rowsToShow = search ? matchingRows : rows;
      rowsToShow.forEach((r) => {
        html += `<tr class="feature-row" data-cat-row="${cat}" style="${collapsed ? "display:none" : ""}">
          <td class="feature-col">${r.feature}</td>
          ${cols.map((c) => `<td class="${cellClass(r.values[c])}">${cellRender(r.values[c])}</td>`).join("")}
        </tr>`;
      });
    });

    document.getElementById("matrixEmpty").hidden = anyVisible;
    body.innerHTML = html;

    body.querySelectorAll(".category-row").forEach((row) => {
      row.addEventListener("click", () => {
        const cat = row.dataset.cat;
        if (state.collapsedCategories.has(cat)) state.collapsedCategories.delete(cat);
        else state.collapsedCategories.add(cat);
        renderMatrixBody();
      });
    });
  }

  function initMatrixDefaults() {
    // default-expand a few key categories, collapse the rest
    const expandByDefault = new Set(["Office 365", "Enterprise Mobility + Security", "Microsoft Entra", "Security & Compliance"]);
    MATRIX.categoryOrder.forEach((cat) => {
      if (!expandByDefault.has(cat)) state.collapsedCategories.add(cat);
    });
  }

  function wireMatrixSearch() {
    document.getElementById("matrixSearch").addEventListener("input", (e) => {
      state.matrixSearch = e.target.value;
      renderMatrixBody();
    });
  }

  /* ---------------- Init ---------------- */
  async function init() {
    initTheme();
    await loadData();
    initMatrixDefaults();
    renderCoreFilters();
    renderAdvancedFilters();
    wireControlBar();
    renderResults();
    renderFreshness();
    renderUnavailable();
    renderMatrixLegend();
    renderMatrixHead();
    renderMatrixBody();
    wireMatrixSearch();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
