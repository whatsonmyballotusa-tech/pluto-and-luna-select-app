/* Pluto & Luna Select — product detail view (js/product.js).
 *
 * Full-screen modal opened when a shop product card is tapped. It receives the
 * already-fetched Product object from the grid — it NEVER re-queries Shopify.
 * Add to Cart goes through the single shared flow:
 *   PLS.Cart.add(productId, qty, variantId?)  ->  toast + badge + drawer.
 * No checkout logic lives here.
 *
 * Pure helpers (also used by tests):
 *   PLS.PDP.optionGroups(product)            -> [{ name, values[] }]
 *   PLS.PDP.resolveVariant(product, sel)     -> variant | null
 *     sel = { OptionName: value }; prefers an availableForSale match.
 */

(function () {
  "use strict";

  function esc(s) { return PLS.esc(s); }
  function money(n) { return "$" + Number(n || 0).toFixed(2); }

  /* ---------------- pure variant helpers ---------------- */

  function optionGroups(p) {
    var groups = [];
    var seen = {};
    (p.variants || []).forEach(function (v) {
      Object.keys(v.options || {}).forEach(function (name) {
        if (!seen[name]) { seen[name] = { name: name, values: [], vseen: {} }; groups.push(seen[name]); }
        var val = v.options[name];
        if (!seen[name].vseen[val]) { seen[name].vseen[val] = true; seen[name].values.push(val); }
      });
    });
    return groups.map(function (g) { return { name: g.name, values: g.values }; });
  }

  function matches(v, sel) {
    return Object.keys(sel || {}).every(function (name) {
      return (v.options || {})[name] === sel[name];
    });
  }

  function resolveVariant(p, sel) {
    var vs = p.variants || [];
    if (!vs.length) return null;
    var full = vs.filter(function (v) { return matches(v, sel); });
    if (!full.length) return null;
    return full.filter(function (v) { return v.availableForSale; })[0] || full[0];
  }

  function defaultVariant(p) {
    var vs = p.variants || [];
    if (!vs.length) return null;
    var byId = vs.filter(function (v) { return v.id === p.variantId; })[0];
    return byId || vs.filter(function (v) { return v.availableForSale; })[0] || vs[0];
  }

  function defaultSelection(p) {
    var v = defaultVariant(p);
    var sel = {};
    if (v) Object.keys(v.options || {}).forEach(function (n) { sel[n] = v.options[n]; });
    return sel;
  }

  /* ---------------- modal ---------------- */

  var el = {};          // overlay, sheet, and inner refs
  var isOpen = false;
  var state = null;     // { product, sel, qty }

  function pimg(p) {
    if (p.image && p.image.indexOf("http") === 0) {
      return '<img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt || p.name) + '"' +
        ' style="width:100%;height:100%;object-fit:cover;display:block">';
    }
    return '<span style="font-size:64px">🐾</span>';
  }

  function buildUI() {
    if (document.getElementById("pls-pdp-overlay")) {
      el.overlay = document.getElementById("pls-pdp-overlay");
      el.sheet = document.getElementById("pls-pdp-sheet");
      return;
    }
    var overlay = document.createElement("div");
    overlay.id = "pls-pdp-overlay";
    overlay.className = "pdp-overlay";
    overlay.onclick = close;
    document.body.appendChild(overlay);
    el.overlay = overlay;

    var sheet = document.createElement("div");
    sheet.id = "pls-pdp-sheet";
    sheet.className = "pdp-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    document.body.appendChild(sheet);
    el.sheet = sheet;

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) close();
    });
  }

  function currentVariant() {
    return resolveVariant(state.product, state.sel) || defaultVariant(state.product);
  }

  function renderOptions(p) {
    var groups = optionGroups(p);
    if (groups.length <= 1 && (p.variants || []).length <= 1) return "";
    return groups.map(function (g) {
      var pills = g.values.map(function (val) {
        var on = state.sel[g.name] === val;
        return '<button class="opt-pill' + (on ? " on" : "") + '"' +
          ' data-opt="' + esc(g.name) + '" data-val="' + esc(val) + '"' +
          ' aria-pressed="' + on + '">' + esc(val) + "</button>";
      }).join("");
      return '<div class="opt-group"><div class="opt-name">' + esc(g.name) + "</div>" +
        '<div class="opt-pills">' + pills + "</div></div>";
    }).join("");
  }

  function render() {
    var p = state.product;
    var v = currentVariant();
    var price = v ? v.price : p.price;
    var compare = v && v.compareAtPrice ? v.compareAtPrice : p.compareAtPrice;
    var sellable = v ? v.availableForSale : p.inStock;
    var multi = (p.variants || []).length > 1;

    el.sheet.setAttribute("aria-label", p.name);
    el.sheet.innerHTML =
      '<div class="pdp-head">' +
        '<span class="p-cat">' + esc(p.category) + "</span>" +
        '<button class="cart-close" id="pls-pdp-close" aria-label="Close product details">✕</button>' +
      "</div>" +
      '<div class="pdp-scroll">' +
        '<div class="pdp-img">' + pimg(p) + "</div>" +
        '<h2 class="pdp-name">' + esc(p.name) + "</h2>" +
        '<div class="pdp-price">' + money(price) +
          (compare && compare > price
            ? ' <span class="pdp-compare">' + money(compare) + "</span>" : "") +
        "</div>" +
        renderOptions(p) +
        (p.description
          ? '<div class="pdp-desc">' + esc(p.description) + "</div>"
          : "") +
      "</div>" +
      '<div class="pdp-foot">' +
        '<span class="qty-stepper">' +
          '<button id="pls-pdp-dec" aria-label="Decrease quantity">−</button>' +
          '<span id="pls-pdp-qty">' + state.qty + "</span>" +
          '<button id="pls-pdp-inc" aria-label="Increase quantity">+</button>' +
        "</span>" +
        (sellable
          ? '<button class="btn block" id="pls-pdp-add" style="flex:1">Add to cart · ' + money(price * state.qty) + "</button>"
          : '<button class="btn block" id="pls-pdp-add" disabled style="flex:1">Out of stock</button>') +
      "</div>";

    el.sheet.querySelector("#pls-pdp-close").onclick = close;

    el.sheet.querySelectorAll("[data-opt]").forEach(function (b) {
      b.onclick = function () {
        state.sel[b.getAttribute("data-opt")] = b.getAttribute("data-val");
        render();
      };
    });

    var qEl = el.sheet.querySelector("#pls-pdp-qty");
    el.sheet.querySelector("#pls-pdp-dec").onclick = function () {
      state.qty = Math.max(1, state.qty - 1);
      qEl.textContent = state.qty;
      refreshAddLabel();
    };
    el.sheet.querySelector("#pls-pdp-inc").onclick = function () {
      state.qty = Math.min(99, state.qty + 1);
      qEl.textContent = state.qty;
      refreshAddLabel();
    };

    var addBtn = el.sheet.querySelector("#pls-pdp-add");
    if (sellable) {
      addBtn.onclick = function () {
        var vv = currentVariant();
        // Only multi-variant products need the variant pinned on the cart line;
        // single-variant products keep the classic (id, null) line.
        var vid = multi && vv ? vv.id : null;
        PLS.Cart.add(p.id, state.qty, vid);
        close();
      };
    }
  }

  function refreshAddLabel() {
    var btn = el.sheet.querySelector("#pls-pdp-add");
    var v = currentVariant();
    if (btn && !btn.disabled && v) {
      btn.textContent = "Add to cart · " + money(v.price * state.qty);
    }
  }

  function open(p) {
    if (!p) return;
    buildUI();
    state = { product: p, sel: defaultSelection(p), qty: 1 };
    render();
    isOpen = true;
    el.overlay.classList.add("open");
    el.sheet.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    state = null;
    el.overlay.classList.remove("open");
    el.sheet.classList.remove("open");
    document.body.style.overflow = "";
  }

  window.PLS = window.PLS || {};
  window.PLS.PDP = {
    open: open,
    close: close,
    isOpen: function () { return isOpen; },
    optionGroups: optionGroups,
    resolveVariant: resolveVariant,
  };
})();
