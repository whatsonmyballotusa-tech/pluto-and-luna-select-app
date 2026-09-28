/* Pluto & Luna Select — Store-in-app: live Shopify Storefront API wiring.
 *
 * INTERFACE (the UI only talks to Store.* — never to Shopify directly):
 *   Store.listProducts({ category, query }) -> Promise<Product[]>
 *   Store.getProduct(id)                   -> Promise<Product | null>
 *   Store.createCheckout(items)             -> Promise<{ url }>  // Shopify-hosted checkout
 *   Store.isMock()                         -> false (live catalog)
 *   Store.categories                       -> [{ id: collectionHandle, label: title }] (async-filled)
 *   Store.ready                            -> Promise resolving when categories load
 *
 * Product shape:
 *   { id (product GID), name, category, price, compareAtPrice?, image (URL|null),
 *     imageAlt, description, tags[], rating (null — no native reviews), reviews (null),
 *     inStock, variantId (first sellable variant GID, used for checkout) }
 *
 * AUTH: public Storefront API token (designed for client-side use).
 *   Endpoint: https://aqt333-x1.myshopify.com/api/2026-01/graphql.json
 *   Header:   X-Shopify-Storefront-Access-Token
 *   Scopes used: unauthenticated_read_product_listings, unauthenticated_write_checkouts.
 *   NO Admin API calls are made from this file — never add any.
 *
 * CHECKOUT CONTRACT (PCI — do not regress):
 *   createCheckout() builds a Shopify cart via cartCreate and returns the
 *   hosted checkoutUrl. The app NEVER collects card details — the user is
 *   redirected to Shopify's secure checkout page to pay.
 */

(function () {
  "use strict";

  var SHOPIFY = {
    domain: "aqt333-x1.myshopify.com",
    token: "972ed659183de7200a426757fa0a4d77", // public Storefront token — safe client-side
    apiVersion: "2026-01",
  };
  var ENDPOINT = "https://" + SHOPIFY.domain + "/api/" + SHOPIFY.apiVersion + "/graphql.json";
  var PAGE_SIZE = 100;

  var productCache = {}; // product GID -> mapped Product (avoids refetch for cart lines)

  function gql(query, variables) {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY.token,
      },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    }).then(function (res) {
      if (!res.ok) throw new Error("Store request failed (HTTP " + res.status + ")");
      return res.json();
    }).then(function (json) {
      if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
      return json.data;
    });
  }

  var PRODUCT_FIELDS = [
    "id",
    "title",
    "description",
    "tags",
    "featuredImage { url altText }",
    "priceRange { minVariantPrice { amount } }",
    "variants(first: 10) { edges { node { id price { amount } compareAtPrice { amount } availableForSale } } }",
    "collections(first: 5) { edges { node { title handle } } }",
  ].join(" ");

  // Map a Storefront Product node to the app's Product shape.
  // The sellable variant chosen here is the one added to the cart, so the
  // displayed price always matches what checkout charges.
  function mapProduct(node) {
    var variants = (node.variants.edges || []).map(function (e) { return e.node; });
    var sellable = variants.filter(function (v) { return v.availableForSale; });
    var chosen = sellable[0] || variants[0] || null;
    var price = chosen
      ? parseFloat(chosen.price.amount)
      : parseFloat(node.priceRange.minVariantPrice.amount);
    var compareAt = chosen && chosen.compareAtPrice
      ? parseFloat(chosen.compareAtPrice.amount)
      : null;
    var cols = (node.collections.edges || [])
      .map(function (e) { return e.node; })
      .filter(function (c) { return c.handle !== "shop-all"; });
    return {
      id: node.id,
      name: node.title,
      category: cols.length ? cols[0].title : "Shop",
      price: price,
      compareAtPrice: compareAt,
      image: node.featuredImage ? node.featuredImage.url : null,
      imageAlt: node.featuredImage ? node.featuredImage.altText : null,
      description: (node.description || "").slice(0, 300),
      tags: node.tags || [],
      rating: null,   // Shopify has no native ratings — UI hides the rating row
      reviews: null,
      inStock: sellable.length > 0,
      variantId: chosen ? chosen.id : null,
    };
  }

  function cacheAll(edges) {
    return edges.map(function (e) {
      var p = mapProduct(e.node);
      productCache[p.id] = p;
      return p;
    });
  }

  function filterByQuery(items, q) {
    if (!q) return items;
    q = q.toLowerCase();
    return items.filter(function (p) {
      return (p.name + " " + p.description + " " + (p.tags || []).join(" "))
        .toLowerCase().indexOf(q) !== -1;
    });
  }

  function listProducts(opts) {
    opts = opts || {};
    var query, variables;
    if (opts.category) {
      // Filter via the collection — Storefront search can't filter by collection directly.
      query = "query CollectionProducts($handle: String!) {" +
        " collectionByHandle(handle: $handle) {" +
        "  products(first: " + PAGE_SIZE + ") { edges { node { " + PRODUCT_FIELDS + " } } } } }";
      variables = { handle: opts.category };
      return gql(query, variables).then(function (data) {
        var col = data.collectionByHandle;
        var items = col ? cacheAll(col.products.edges) : [];
        return filterByQuery(items, opts.query);
      });
    }
    query = "query Products($q: String) {" +
      " products(first: " + PAGE_SIZE + ", query: $q) { edges { node { " + PRODUCT_FIELDS + " } } } }";
    variables = { q: opts.query || null };
    return gql(query, variables).then(function (data) {
      return cacheAll(data.products.edges);
    });
  }

  function getProduct(id) {
    if (productCache[id]) return Promise.resolve(productCache[id]);
    var query = "query ProductById($id: ID!) {" +
      " node(id: $id) { ... on Product { " + PRODUCT_FIELDS + " } } }";
    return gql(query, { id: id }).then(function (data) {
      if (!data.node) return null;
      var p = mapProduct(data.node);
      productCache[p.id] = p;
      return p;
    });
  }

  // Builds a Shopify cart from app cart lines and returns the HOSTED checkout URL.
  // Card data is only ever entered on Shopify's page — never in this app.
  function createCheckout(items) {
    var lookups = (items || []).map(function (l) {
      return getProduct(l.id).then(function (p) { return { p: p, qty: l.qty || 1 }; });
    });
    return Promise.all(lookups).then(function (lines) {
      var cartLines = lines
        .filter(function (x) { return x.p && x.p.variantId; })
        .map(function (x) { return { merchandiseId: x.p.variantId, quantity: x.qty }; });
      if (!cartLines.length) throw new Error("Your cart is empty or those items are no longer available.");
      var mutation = "mutation CartCreate($lines: [CartLineInput!]!) {" +
        " cartCreate(input: { lines: $lines }) {" +
        "  cart { checkoutUrl } userErrors { field message } } }";
      return gql(mutation, { lines: cartLines });
    }).then(function (data) {
      var errs = (data.cartCreate && data.cartCreate.userErrors) || [];
      if (errs.length) throw new Error(errs[0].message);
      return { url: data.cartCreate.cart.checkoutUrl };
    });
  }

  // Category chips come from real store collections (async — see Store.ready).
  // "Shop All" is excluded: the "Everything" chip already covers it.
  var CATEGORIES = [];
  var ready = gql("{ collections(first: 20) { edges { node { handle title } } } }")
    .then(function (data) {
      (data.collections.edges || []).forEach(function (e) {
        var n = e.node;
        if (n.handle === "shop-all") return;
        CATEGORIES.push({ id: n.handle, label: n.title });
      });
      return CATEGORIES;
    })
    .catch(function () { return CATEGORIES; }); // degrade to "Everything" only

  window.PLS = window.PLS || {};
  window.PLS.Store = {
    listProducts: listProducts,
    getProduct: getProduct,
    createCheckout: createCheckout,
    isMock: function () { return false; },
    categories: CATEGORIES,
    ready: ready,
  };
})();
