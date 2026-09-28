/* Pluto & Luna Select — shared cart (js/cart.js).
 *
 * ONE cart, ONE checkout path for the whole app.
 *
 *  - Cart state: a single localStorage cart ("pls_cart") -> [{ id: productGID, qty, variantId? }].
 *    Product details (name/price/image) always come live from PLS.Store (Shopify).
 *    variantId is the Shopify variant chosen on the product detail view (optional;
 *    older lines without it use the product's default sellable variant).
 *  - Cart UI: a single drawer, opened from the header cart button injected on every
 *    page. No page may implement its own cart card or its own checkout button.
 *  - Checkout: PLS.Cart.checkout() is the ONLY checkout action. It builds one
 *    Shopify cart via the Storefront API and redirects to Shopify's hosted
 *    checkout. The app never collects card details.
 *
 * Include order on every page: js/app.js, js/store.js, js/cart.js, then the
 * page's own inline script.
 */

(function () {
  "use strict";

  var KEY = "pls_cart";
  var MAX_QTY = 99;

  /* ---------------- cart state (single source of truth) ---------------- */

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  var listeners = [];
  function emit() {
    var lines = load();
    listeners.forEach(function (fn) { try { fn(lines); } catch (e) {} });
  }
  function save(lines) {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) {}
    emit();
  }

  function findLine(lines, id, variantId) {
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].id === id && (lines[i].variantId || null) === (variantId || null)) return lines[i];
    }
    return null;
  }

  function add(id, qty, variantId) {
    qty = Math.max(1, qty | 0 || 1);
    var lines = load();
    var l = findLine(lines, id, variantId);
    if (l) l.qty = Math.min(MAX_QTY, l.qty + qty);
    else lines.push({ id: id, qty: qty, variantId: variantId || null });
    save(lines);
    toast("Added to cart", "View cart", openDrawer);
  }

  function setQty(id, qty, variantId) {
    qty = qty | 0;
    var lines = load();
    var l = findLine(lines, id, variantId);
    if (!l) return;
    if (qty <= 0) lines.splice(lines.indexOf(l), 1);
    else l.qty = Math.min(MAX_QTY, qty);
    save(lines);
  }

  function removeLine(id, variantId) { setQty(id, 0, variantId); }
  function clear() { save([]); }

  function count() {
    return load().reduce(function (n, l) { return n + (l.qty | 0); }, 0);
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  /* ---------------- the single checkout path ---------------- */

  var checkingOut = false;

  function checkout() {
    if (checkingOut) return Promise.resolve(null); // one checkout at a time
    var lines = load();
    if (!lines.length) return Promise.reject(new Error("Your cart is empty."));
    checkingOut = true;
    setCheckoutBusy(true, null);
    return PLS.Store.createCheckout(lines).then(function (res) {
      // Hosted Shopify checkout — the app never sees card data.
      window.location.href = res.url;
      // Safety: if navigation didn't actually happen and this page is still
      // alive, unlock the button so the user isn't stranded.
      setTimeout(function () {
        checkingOut = false;
        setCheckoutBusy(false, null);
      }, 4000);
      return res;
    }).catch(function (err) {
      checkingOut = false;
      setCheckoutBusy(false, err);
      throw err;
    });
  }

  /* ---------------- drawer UI ---------------- */

  var el = {};          // cached DOM refs
  var drawerOpen = false;
  var renderToken = 0;

  function money(n) { return "$" + Number(n || 0).toFixed(2); }

  function esc(s) { return PLS.esc(s); }

  function buildUI() {
    // 1. Header cart button with badge (every page gets one).
    var header = document.querySelector(".app-header");
    if (header && !document.getElementById("pls-cart-btn")) {
      var btn = document.createElement("button");
      btn.id = "pls-cart-btn";
      btn.className = "cart-btn";
      btn.setAttribute("aria-label", "Open cart");
      btn.innerHTML = '🛒<span class="cart-badge" id="pls-cart-badge" hidden>0</span>' +
        '<span class="cart-total" id="pls-cart-total" hidden></span>';
      btn.onclick = openDrawer;
      header.appendChild(btn);
      el.badge = btn.querySelector("#pls-cart-badge");
      el.total = btn.querySelector("#pls-cart-total");
    }

    // 2. Overlay + drawer + toast (built once).
    if (!document.getElementById("pls-cart-drawer")) {
      var overlay = document.createElement("div");
      overlay.id = "pls-cart-overlay";
      overlay.className = "cart-overlay";
      overlay.onclick = closeDrawer;
      document.body.appendChild(overlay);
      el.overlay = overlay;

      var drawer = document.createElement("aside");
      drawer.id = "pls-cart-drawer";
      drawer.className = "cart-drawer";
      drawer.setAttribute("aria-label", "Shopping cart");
      drawer.innerHTML =
        '<div class="cart-drawer-head"><h2>🧺 Your cart</h2>' +
        '<button class="cart-close" id="pls-cart-close" aria-label="Close cart">✕</button></div>' +
        '<div class="cart-drawer-body" id="pls-cart-body"></div>' +
        '<div class="cart-drawer-foot" id="pls-cart-foot" hidden>' +
        '<p class="cart-total-row"><span>Subtotal</span><strong id="pls-cart-subtotal">$0.00</strong></p>' +
        '<button class="btn block" id="pls-cart-checkout">Checkout securely →</button>' +
        '<p class="cart-err" id="pls-cart-err" hidden></p>' +
        '<p class="hint">Checkout always happens on Shopify\'s secure hosted page — we never see your card.</p>' +
        "</div>";
      document.body.appendChild(drawer);
      el.drawer = drawer;
      el.body = drawer.querySelector("#pls-cart-body");
      el.foot = drawer.querySelector("#pls-cart-foot");
      el.subtotal = drawer.querySelector("#pls-cart-subtotal");
      el.checkoutBtn = drawer.querySelector("#pls-cart-checkout");
      el.err = drawer.querySelector("#pls-cart-err");
      drawer.querySelector("#pls-cart-close").onclick = closeDrawer;
      el.checkoutBtn.onclick = function () {
        checkout().catch(function () { /* error shown inline in drawer */ });
      };
      // Qty steppers + remove via delegation (body content re-renders).
      el.body.addEventListener("click", function (e) {
        var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
        if (!t) return;
        var id = t.getAttribute("data-id");
        var variantId = t.getAttribute("data-variant") || null;
        var cur = findLine(load(), id, variantId);
        var q = cur ? cur.qty : 0;
        var act = t.getAttribute("data-act");
        if (act === "inc") setQty(id, q + 1, variantId);
        else if (act === "dec") setQty(id, q - 1, variantId);
        else if (act === "rm") removeLine(id, variantId);
      });

      var toastEl = document.createElement("div");
      toastEl.id = "pls-cart-toast";
      toastEl.className = "cart-toast";
      toastEl.hidden = true;
      document.body.appendChild(toastEl);
      el.toast = toastEl;
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawerOpen) closeDrawer();
    });
  }

  function renderBadge() {
    if (!el.badge) return;
    var n = count();
    el.badge.textContent = n > 99 ? "99+" : String(n);
    el.badge.hidden = n === 0;
  }

  // Live running total on the header cart button. Prices come from the same
  // cached Store lookups the drawer uses — no extra network when cached.
  var totalToken = 0;
  function renderTotal() {
    if (!el.total) return;
    totalToken++; // invalidate any in-flight lookup, even when the cart is now empty
    var lines = load();
    if (!lines.length) { el.total.hidden = true; return; }
    var t = totalToken;
    Promise.all(lines.map(function (l) { return PLS.Store.getProduct(l.id); }))
      .then(function (ps) {
        if (t !== totalToken) return; // superseded
        var sum = 0;
        ps.forEach(function (p, i) {
          if (p) sum += lineUnitPrice(lines[i], p) * lines[i].qty;
        });
        el.total.textContent = money(sum);
        el.total.hidden = false;
      })
      .catch(function () { if (t === totalToken) el.total.hidden = true; });
  }

  function pimg(p, size) {
    size = size || 44;
    if (p.image && p.image.indexOf("http") === 0) {
      return '<img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt || p.name) +
        '" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">';
    }
    return '<span style="font-size:' + Math.round(size * 0.4) + 'px">🐾</span>';
  }

  // The variant label for a cart line, e.g. "Size: Large" — empty for default variant.
  function variantLabel(l, p) {
    if (!l.variantId || !p.variants) return "";
    var v = p.variants.filter(function (x) { return x.id === l.variantId; })[0];
    if (!v) return "";
    var names = Object.keys(v.options || {});
    return names.length ? names.map(function (n) { return n + ": " + v.options[n]; }).join(" · ") : v.title;
  }

  // Unit price for a line: the chosen variant's price when present, else the
  // product's default price.
  function lineUnitPrice(l, p) {
    if (l.variantId && p.variants) {
      var v = p.variants.filter(function (x) { return x.id === l.variantId; })[0];
      if (v) return v.price;
    }
    return p.price;
  }

  function lineRow(l, p) {
    var vAttr = l.variantId ? ' data-variant="' + esc(l.variantId) + '"' : "";
    var vLabel = variantLabel(l, p);
    var unit = lineUnitPrice(l, p);
    return '<div class="cart-line">' +
      '<span class="cart-thumb">' + pimg(p, 44) + "</span>" +
      '<span class="cart-line-info"><strong>' + esc(p.name) + "</strong>" +
      (vLabel ? '<span class="cart-line-variant">' + esc(vLabel) + "</span>" : "") +
      '<span class="cart-line-price">' + money(unit) + " each</span></span>" +
      '<span class="qty-stepper">' +
      '<button data-act="dec" data-id="' + esc(l.id) + '"' + vAttr + ' aria-label="Decrease quantity">−</button>' +
      "<span>" + (l.qty | 0) + "</span>" +
      '<button data-act="inc" data-id="' + esc(l.id) + '"' + vAttr + ' aria-label="Increase quantity">+</button>' +
      "</span>" +
      '<span class="cart-line-total">' + money(unit * l.qty) + "</span>" +
      '<button class="cart-rm" data-act="rm" data-id="' + esc(l.id) + '"' + vAttr + ' aria-label="Remove item">✕</button>' +
      "</div>";
  }

  function unavailableRow(l) {
    return '<div class="cart-line cart-unavailable">' +
      '<span class="cart-thumb">🐾</span>' +
      '<span class="cart-line-info"><strong>Item no longer available</strong>' +
      '<span class="cart-line-price">It will be skipped at checkout</span></span>' +
      '<button class="cart-rm" data-act="rm" data-id="' + esc(l.id) + '" aria-label="Remove item">✕</button>' +
      "</div>";
  }

  function renderDrawer() {
    var lines = load();
    renderToken++;
    var t = renderToken;
    if (!lines.length) {
      el.foot.hidden = true;
      el.body.innerHTML =
        '<div class="cart-empty"><div class="cart-empty-icon">🛒</div>' +
        "<p><strong>Your cart is empty.</strong></p>" +
        '<p style="color:var(--brown-soft);font-size:13px">Treats, toys &amp; care your dog will love.</p>' +
        '<p><button class="btn" id="pls-cart-browse">Browse the shop</button></p></div>';
      var b = el.body.querySelector("#pls-cart-browse");
      if (b) b.onclick = function () {
        closeDrawer();
        if (window.location.pathname.indexOf("shop.html") === -1) window.location.href = "shop.html";
      };
      return;
    }
    el.foot.hidden = true;
    el.err.hidden = true;
    el.body.innerHTML = '<p class="cart-loading">Loading your cart…</p>';
    var proms = lines.map(function (l) {
      return PLS.Store.getProduct(l.id).then(function (p) { return { line: l, p: p }; });
    });
    Promise.all(proms).then(function (rows) {
      if (t !== renderToken) return; // superseded by a newer render
      var subtotal = 0, html = "";
      rows.forEach(function (r) {
        if (!r.p || !r.p.variantId) { html += unavailableRow(r.line); return; }
        subtotal += lineUnitPrice(r.line, r.p) * r.line.qty;
        html += lineRow(r.line, r.p);
      });
      el.body.innerHTML = html;
      el.subtotal.textContent = money(subtotal);
      el.foot.hidden = false;
    }).catch(function () {
      if (t !== renderToken) return;
      el.body.innerHTML =
        '<p class="cart-loading">Couldn\'t load cart details — check your connection and try again.</p>';
    });
  }

  function setCheckoutBusy(busy, err) {
    if (!el.checkoutBtn) return;
    el.checkoutBtn.disabled = busy;
    el.checkoutBtn.textContent = busy ? "Opening secure checkout…" : "Checkout securely →";
    if (err) {
      el.err.textContent = "Couldn't start checkout: " + (err && err.message ? err.message : "please try again.");
      el.err.hidden = false;
    } else if (!busy) {
      el.err.hidden = true;
    }
  }

  function openDrawer() {
    if (drawerOpen || !el.drawer) return;
    drawerOpen = true;
    renderDrawer();
    el.overlay.classList.add("open");
    el.drawer.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    if (!drawerOpen || !el.drawer) return;
    drawerOpen = false;
    el.overlay.classList.remove("open");
    el.drawer.classList.remove("open");
    document.body.style.overflow = "";
  }

  var toastTimer = null;
  function hideToast() {
    if (el.toast) el.toast.hidden = true;
  }
  function toast(msg, actionLabel, actionFn) {
    if (!el.toast) return;
    el.toast.innerHTML = "<span>" + esc(msg) + "</span>" +
      (actionLabel ? '<button class="cart-toast-btn">' + esc(actionLabel) + "</button>" : "");
    var btn = el.toast.querySelector(".cart-toast-btn");
    if (btn && actionFn) btn.onclick = function () { hideToast(); actionFn(); };
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 2600);
  }

  function init() {
    if (!window.PLS || !PLS.Store) return; // store.js must be included before cart.js
    buildUI();
    renderBadge();
    renderTotal();
    onChange(function () {
      renderBadge();
      renderTotal();
      if (drawerOpen) renderDrawer();
    });
  }

  window.PLS = window.PLS || {};
  window.PLS.Cart = {
    add: add,
    setQty: setQty,
    removeLine: removeLine,
    clear: clear,
    count: count,
    getLines: load,
    onChange: onChange,
    checkout: checkout,   // the single checkout path
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
