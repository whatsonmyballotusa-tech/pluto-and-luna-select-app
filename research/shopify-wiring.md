# Shopify wiring note — PWA shop tab (2026-09-28)

## Connection
- **Endpoint:** `https://aqt333-x1.myshopify.com/api/2026-01/graphql.json`
- **Auth header:** `X-Shopify-Storefront-Access-Token: 972ed659183de7200a426757fa0a4d77`
  (public Storefront token from the Headless sales channel — designed for client-side use)
- **Scopes exercised:** `unauthenticated_read_product_listings` (products, collections),
  `unauthenticated_write_checkouts` (`cartCreate`). No Admin API calls — none are made from the app, ever.

## What was replaced
- `app/js/store.js`: deleted the 12-product mock catalog and `MOCK_MODE`. Now implements the
  same `PLS.Store` interface against the live Storefront API:
  - `listProducts({category, query})` → `products(first:100, query:)` or `collectionByHandle` + client filter
  - `getProduct(id)` → `node(id:)` (with in-memory cache, so cart lines don't refetch)
  - `createCheckout(items)` → `cartCreate` mutation → returns Shopify-**hosted** `checkoutUrl`
    (verified: URL lands on `plutoandlunaselect.com/cart/c/...` — the real store domain)
  - `categories` → 14 real collections (Shop All excluded; "Everything" chip covers it)
  - `Store.ready` promise resolves when collections load; `isMock()` now returns `false`
- `app/shop.html`: removed the "Store preview / illustrative prices" notice; product cards and
  cart now render real product photos (`<img>`, paw-emoji fallback); rating row hidden (Shopify
  has no native ratings); search debounced 350ms; network-error empty states; checkout button
  disables while creating the cart and redirects to Shopify on success.
- Product price shown = the price of the first sellable variant (the same variant added to the
  cart), so displayed price always matches what checkout charges. `inStock` = variant
  `availableForSale`.

## Verified live (2026-09-28)
- `{ shop { name } }` → "Pluto And Luna Select"
- 15 collections incl. Nutrition, Dog Toys, Treats & Chews
- `products(first:100)` → 100 items; `collectionByHandle("dog-toys")` → 62 products;
  `products(query:"shampoo")` → 24 results; `getProduct` by GID works
- `cartCreate` with a real variant GID → `checkoutUrl` returned, no errors

## Still pending / follow-ups (not implemented)
- **Customer Account API auth:** identifying shoppers (and the Plus 10% discount) needs the
  Customer Account API, whose allowed callback/redirect URLs must be registered — that requires
  the **deployed PWA URL** first. Flag for post-deploy.
- **Plus discount at checkout:** currently marketing copy only; needs either a Shopify discount
  code surfaced in-app or the Customer Account integration above.
- **Pagination:** listings cap at 100 products per view; add cursor pagination if the catalog grows.
- **Phone test:** verify the checkout redirect + PWA install on a real phone after deploy.
