/* Pluto and Luna Select — shared app shell: nav, tiers, storage, disclaimers.
 *
 * FREE tier (generous): 3 pet profiles, 5 scans/week, full knowledge base,
 *   community, recipes.
 * PAID tier ($6.99/mo — PLACEHOLDER price, founder to confirm): unlimited scans,
 *   advanced nutrition planner, health records + med reminders, unlimited pets,
 *   store discount.
 *
 * Storage is localStorage today. Every key below has a Supabase-ready shape
 * documented in README.md (table: app_users, pets, scans, validation_responses).
 */

(function () {
  "use strict";

  var LS_KEYS = {
    tier: "pls_tier",           // "free" | "paid"
    pets: "pls_pets",           // array of pet objects
    activePet: "pls_active_pet",// pet id
    scans: "pls_scans",         // { weekStart: ISO, count: n }
    scanHistory: "pls_scan_history",
    claims: "pls_claims",
  };

  var FREE_LIMITS = {
    maxPets: 3,
    scansPerWeek: 5,
  };

  var PAID_PRICE = "$6.99/mo"; // PLACEHOLDER — founder to confirm before launch

  function getTier() {
    return localStorage.getItem(LS_KEYS.tier) || "free";
  }
  function isPaid() {
    return getTier() === "paid";
  }
  function setTier(t) {
    localStorage.setItem(LS_KEYS.tier, t);
    document.dispatchEvent(new CustomEvent("pls:tierchange", { detail: t }));
  }

  function getPets() {
    try { return JSON.parse(localStorage.getItem(LS_KEYS.pets) || "[]"); }
    catch (e) { return []; }
  }
  function savePets(pets) {
    localStorage.setItem(LS_KEYS.pets, JSON.stringify(pets));
  }
  function getActivePet() {
    var pets = getPets();
    var id = localStorage.getItem(LS_KEYS.activePet);
    return pets.find(function (p) { return p.id === id; }) || pets[0] || null;
  }
  function setActivePet(id) {
    localStorage.setItem(LS_KEYS.activePet, id);
    document.dispatchEvent(new CustomEvent("pls:petchange", { detail: id }));
  }

  // Weekly scan budget. Week starts Monday (UTC).
  function weekStartISO() {
    var d = new Date();
    var day = (d.getUTCDay() + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }
  function scansUsedThisWeek() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEYS.scans) || "{}");
      if (s.weekStart !== weekStartISO()) return 0;
      return s.count || 0;
    } catch (e) { return 0; }
  }
  function recordScan() {
    var s = { weekStart: weekStartISO(), count: scansUsedThisWeek() + 1 };
    localStorage.setItem(LS_KEYS.scans, JSON.stringify(s));
  }
  function scansRemaining() {
    if (isPaid()) return Infinity;
    return Math.max(0, FREE_LIMITS.scansPerWeek - scansUsedThisWeek());
  }

  // ---------- shared chrome ----------
  var NAV = [
    { href: "index.html", icon: "🏠", label: "Home", pages: ["index.html"] },
    { href: "scanner.html", icon: "📷", label: "Scan", pages: ["scanner.html"] },
    { href: "recipes.html", icon: "🦴", label: "Recipes", pages: ["recipes.html"] },
    { href: "community.html", icon: "💬", label: "Pack", pages: ["community.html"] },
    { href: "shop.html", icon: "🛒", label: "Shop", pages: ["shop.html"] },
  ];

  function injectHeader() {
    var tier = getTier();
    var badge = tier === "paid"
      ? '<span class="tier-badge paid">⭐ PLUS</span>'
      : '<span class="tier-badge">FREE</span>';
    var header = document.createElement("header");
    header.className = "app-header";
    header.innerHTML =
      '<span class="paw">🐾</span>' +
      '<div class="brand">Pluto &amp; Luna Select<small>One pack. One app. One store.</small></div>' +
      badge;
    document.body.insertBefore(header, document.body.firstChild);
  }

  function injectNav(activePage) {
    var nav = document.createElement("nav");
    nav.className = "bottom-nav";
    nav.setAttribute("aria-label", "Main navigation");
    nav.innerHTML = NAV.map(function (n) {
      var active = n.pages.indexOf(activePage) !== -1 ? " active" : "";
      return '<a href="' + n.href + '" class="' + active.trim() + '">' +
        '<span class="icon">' + n.icon + '</span>' + n.label + "</a>";
    }).join("");
    document.body.appendChild(nav);
  }

  function injectDisclaimer() {
    var el = document.createElement("div");
    el.className = "footer-note";
    el.innerHTML = "🐾 Pluto &amp; Luna Select · " +
      "Content is educational only and <strong>not veterinary advice</strong>. " +
      "Always consult your veterinarian. " +
      'Questions? <a href="mailto:plutoandlunaselect@gmail.com">plutoandlunaselect@gmail.com</a> · ' +
      'AI posts are labeled — see <a href="community.html#ai-policy">our AI policy</a>.';
    document.body.appendChild(el);
  }

  function init(page) {
    injectHeader();
    injectNav(page || "index.html");
    injectDisclaimer();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Tasteful upgrade nudge (used when a free limit is hit — never nagging).
  function upgradeNudge(feature) {
    return '<div class="card paywall">' +
      '<div class="lock">🔒</div>' +
      "<h2>You've hit a Free limit</h2>" +
      "<p>" + esc(feature) + " is unlimited with <strong>Pluto &amp; Luna Plus</strong>.</p>" +
      '<p><a class="btn" href="upgrade.html">See Plus — ' + PAID_PRICE + '</a></p>' +
      '<p style="font-size:12px;color:var(--brown-soft)">No pressure — everything else stays free forever.</p>' +
      "</div>";
  }

  window.PLS = {
    LS_KEYS: LS_KEYS,
    FREE_LIMITS: FREE_LIMITS,
    PAID_PRICE: PAID_PRICE,
    getTier: getTier, isPaid: isPaid, setTier: setTier,
    getPets: getPets, savePets: savePets,
    getActivePet: getActivePet, setActivePet: setActivePet,
    scansUsedThisWeek: scansUsedThisWeek, recordScan: recordScan,
    scansRemaining: scansRemaining,
    init: init, esc: esc, upgradeNudge: upgradeNudge,
  };
})();
