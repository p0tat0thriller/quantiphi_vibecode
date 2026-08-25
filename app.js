(() => {
  "use strict";

  const STORAGE_KEY = "ledger.subscriptions.v1";
  const CEILING_KEY = "ledger.ceiling.v1";
  const SOON_THRESHOLD_DAYS = 7;

  /** ---------- State ---------- **/

  /** @typedef {{id:string,name:string,cost:number,cycle:'monthly'|'yearly',renewal:string,active:boolean}} Subscription */

  /** @type {Subscription[]} */
  let subscriptions = loadSubscriptions();
  let ceiling = loadCeiling();

  function loadSubscriptions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("Could not read saved subscriptions, starting fresh.", err);
      return [];
    }
  }

  function saveSubscriptions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
    } catch (err) {
      console.error("Could not save subscriptions.", err);
    }
  }

  function loadCeiling() {
    const raw = localStorage.getItem(CEILING_KEY);
    const parsed = raw ? Number(raw) : 500;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
  }

  function saveCeiling() {
    localStorage.setItem(CEILING_KEY, String(ceiling));
  }

  /** ---------- Cost Uniformity Engine ---------- **/

  /** Normalize any billing cycle down to a monthly rate. */
  function toMonthlyRate(sub) {
    const cost = Number(sub.cost) || 0;
    return sub.cycle === "yearly" ? cost / 12 : cost;
  }

  /** ---------- Date Intersect Calculator ---------- **/

  /** Parses a YYYY-MM-DD string as a local calendar date (midnight). */
  function parseCalendarDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /** Whole days remaining until target date, relative to a fixed "today". */
  function daysUntil(dateStr, today) {
    const target = parseCalendarDate(dateStr);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((startOfDay(target) - startOfDay(today)) / msPerDay);
  }

  function isRenewingSoon(sub, today) {
    if (!sub.active) return false;
    const remaining = daysUntil(sub.renewal, today);
    return remaining >= 0 && remaining <= SOON_THRESHOLD_DAYS;
  }

  /** ---------- Derived metrics ---------- **/

  function computeMetrics(today) {
    const activeSubs = subscriptions.filter((s) => s.active);
    const pausedSubs = subscriptions.filter((s) => !s.active);

    const monthlyBurn = activeSubs.reduce((sum, s) => sum + toMonthlyRate(s), 0);
    const pausedSavings = pausedSubs.reduce((sum, s) => sum + toMonthlyRate(s), 0);

    const soon = activeSubs.filter((s) => isRenewingSoon(s, today));

    return { monthlyBurn, pausedSavings, soon };
  }

  /** ---------- Formatting ---------- **/

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  function formatCurrency(n) {
    return currencyFormatter.format(n);
  }

  function formatDateReadable(dateStr) {
    const d = parseCalendarDate(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  /** ---------- DOM refs ---------- **/

  const els = {
    todayDisplay: document.getElementById("today-display"),
    burnAmount: document.getElementById("burn-amount"),
    burnSub: document.getElementById("burn-sub"),
    ceilingInput: document.getElementById("ceiling-input"),
    gaugeFill: document.getElementById("gauge-fill"),
    gaugeNeedleGroup: document.getElementById("gauge-needle-group"),
    alertCount: document.getElementById("alert-count"),
    alertNames: document.getElementById("alert-names"),
    pausedSavings: document.getElementById("paused-savings"),
    ticketToggle: document.getElementById("ticket-toggle"),
    ticketBody: document.getElementById("entry-form"),
    entryForm: document.getElementById("entry-form"),
    manifestBody: document.getElementById("manifest-body"),
    rowCount: document.getElementById("row-count"),
    emptyState: document.getElementById("empty-state"),
    manifestTable: document.querySelector(".manifest-table"),
  };

  const GAUGE_ARC_LENGTH = 283; // ~pi * r(90), matches stroke-dasharray in CSS/SVG

  /** ---------- Rendering ---------- **/

  function render() {
    const today = new Date();
    const { monthlyBurn, pausedSavings, soon } = computeMetrics(today);

    renderMasthead(today);
    renderGauge(monthlyBurn);
    renderAlertCard(soon, pausedSavings);
    renderTable(today);
  }

  function renderMasthead(today) {
    els.todayDisplay.textContent = today.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function renderGauge(monthlyBurn) {
    els.burnAmount.textContent = formatCurrency(monthlyBurn);
    els.burnSub.textContent = `of ${formatCurrency(ceiling)} ceiling · active subs only`;

    const pct = Math.max(0, Math.min(1, ceiling > 0 ? monthlyBurn / ceiling : 0));
    const offset = GAUGE_ARC_LENGTH - GAUGE_ARC_LENGTH * pct;
    els.gaugeFill.style.strokeDashoffset = String(offset);

    const overBudget = ceiling > 0 && monthlyBurn > ceiling;
    els.gaugeFill.style.stroke = overBudget
      ? "var(--rust)"
      : pct > 0.75
      ? "var(--gold)"
      : "var(--teal)";

    const angle = (pct - 0.5) * 180; // -90deg (empty) to +90deg (full)
    els.gaugeNeedleGroup.style.transform = `rotate(${angle}deg)`;
  }

  function renderAlertCard(soon, pausedSavings) {
    els.alertCount.textContent = String(soon.length);
    els.alertNames.textContent = soon.length
      ? soon.map((s) => s.name).join(", ")
      : "Nothing due soon";
    els.pausedSavings.textContent = `${formatCurrency(pausedSavings)} / mo saved from paused subscriptions`;
  }

  function renderTable(today) {
    els.manifestBody.innerHTML = "";

    const sorted = [...subscriptions].sort(
      (a, b) => daysUntil(a.renewal, today) - daysUntil(b.renewal, today)
    );

    for (const sub of sorted) {
      els.manifestBody.appendChild(buildRow(sub, today));
    }

    const hasRows = subscriptions.length > 0;
    els.emptyState.classList.toggle("is-visible", !hasRows);
    els.manifestTable.classList.toggle("is-empty", !hasRows);
    els.rowCount.textContent = `${subscriptions.length} subscription${subscriptions.length === 1 ? "" : "s"}`;
  }

  function buildRow(sub, today) {
    const tr = document.createElement("tr");
    const remaining = daysUntil(sub.renewal, today);
    const soon = isRenewingSoon(sub, today);

    tr.className = [soon ? "row--soon" : "", !sub.active ? "row--paused" : ""]
      .filter(Boolean)
      .join(" ");

    const nameTd = document.createElement("td");
    nameTd.className = "cell-name";
    nameTd.textContent = sub.name;
    tr.appendChild(nameTd);

    const costTd = document.createElement("td");
    costTd.className = "cell-mono";
    costTd.textContent = formatCurrency(Number(sub.cost));
    tr.appendChild(costTd);

    const cycleTd = document.createElement("td");
    cycleTd.textContent = sub.cycle === "yearly" ? "Yearly" : "Monthly";
    tr.appendChild(cycleTd);

    const monthlyTd = document.createElement("td");
    monthlyTd.className = "cell-mono";
    monthlyTd.textContent = formatCurrency(toMonthlyRate(sub));
    tr.appendChild(monthlyTd);

    const renewalTd = document.createElement("td");
    renewalTd.className = "cell-mono";
    renewalTd.textContent = formatDateReadable(sub.renewal);
    tr.appendChild(renewalTd);

    const statusTd = document.createElement("td");
    statusTd.appendChild(buildStatusBadge(sub, remaining, soon));
    tr.appendChild(statusTd);

    const toggleTd = document.createElement("td");
    toggleTd.appendChild(buildToggle(sub));
    tr.appendChild(toggleTd);

    const removeTd = document.createElement("td");
    removeTd.appendChild(buildRemoveButton(sub));
    tr.appendChild(removeTd);

    return tr;
  }

  function buildStatusBadge(sub, remaining, soon) {
    const span = document.createElement("span");
    if (!sub.active) {
      span.className = "badge badge--paused";
      span.textContent = "Paused";
    } else if (soon) {
      span.className = "badge badge--soon";
      span.textContent = remaining <= 0 ? "Renewing today" : "Renewing soon";
    } else {
      span.className = "badge badge--ok";
      span.textContent = `${remaining}d left`;
    }
    return span;
  }

  function buildToggle(sub) {
    const label = document.createElement("label");
    label.className = "switch";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = sub.active;
    input.setAttribute("aria-label", `${sub.active ? "Pause" : "Resume"} ${sub.name}`);
    input.addEventListener("change", () => {
      sub.active = input.checked;
      saveSubscriptions();
      render();
    });

    const track = document.createElement("span");
    track.className = "switch__track";

    label.appendChild(input);
    label.appendChild(track);
    return label;
  }

  function buildRemoveButton(sub) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "remove-btn";
    btn.title = `Remove ${sub.name}`;
    btn.setAttribute("aria-label", `Remove ${sub.name}`);
    btn.textContent = "✕";
    btn.addEventListener("click", () => {
      subscriptions = subscriptions.filter((s) => s.id !== sub.id);
      saveSubscriptions();
      render();
    });
    return btn;
  }

  /** ---------- Form handling ---------- **/

  function handleSubmit(evt) {
    evt.preventDefault();

    const form = evt.currentTarget;
    const name = form.name.value.trim();
    const cost = Number(form.cost.value);
    const cycle = form.cycle.value === "yearly" ? "yearly" : "monthly";
    const renewal = form.renewal.value;

    if (!name || !Number.isFinite(cost) || cost < 0 || !renewal) {
      form.reportValidity();
      return;
    }

    subscriptions.push({
      id: (crypto.randomUUID && crypto.randomUUID()) || `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name,
      cost,
      cycle,
      renewal,
      active: true,
    });

    saveSubscriptions();
    form.reset();
    form.cycle.value = "monthly";
    render();
  }

  /** ---------- Wiring ---------- **/

  function initTicket() {
    els.ticketToggle.addEventListener("click", () => {
      const isOpen = els.ticketBody.classList.toggle("is-open");
      els.ticketToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function initCeilingInput() {
    els.ceilingInput.value = ceiling;
    els.ceilingInput.addEventListener("input", () => {
      const val = Number(els.ceilingInput.value);
      ceiling = Number.isFinite(val) && val > 0 ? val : ceiling;
      saveCeiling();
      render();
    });
  }

  function init() {
    els.entryForm.addEventListener("submit", handleSubmit);
    initTicket();
    initCeilingInput();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
