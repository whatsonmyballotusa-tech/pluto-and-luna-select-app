# Cart → Checkout Unification (2026-09-28)

## What Ray reported
Adding to cart in the app did not flow through to a working checkout "in one way."

## What was actually broken
The Shopify API layer was fine — `cartCreate` returned a real hosted checkout URL
on plutoandlunaselect.com (verified live via the Storefront API on 2026-09-28).
The break was in the app flow:

1. The only cart UI was a card buried at the **bottom of shop.html**, below the full
   product grid. On a phone, tapping "Add to cart" gave zero visible feedback and
   there was no discoverable path to the checkout button.
2. The cart existed only on shop.html — no cart access, badge, or count anywhere
   else in the app.
3. Cart/checkout logic was inline one-off code in shop.html, not shared.

## What changed
- **New `app/js/cart.js`** — the single owner of cart state and checkout:
  - One persistent cart in localStorage (`pls_cart`, same key as before — existing
    carts migrate seamlessly). Product details always come live from `PLS.Store`.
  - One cart **drawer** UI, opened from a **header cart button with count badge**
    injected on every page. Qty steppers, remove, subtotal, empty state.
  - `PLS.Cart.checkout()` is the ONLY checkout action: builds one Shopify cart via
    `cartCreate` and redirects to the hosted checkout URL. Single-flight guard
    (double-tap safe) + self-unlock if navigation ever fails + inline error display.
  - Toast on add-to-cart with a "View cart" action.
- **`app/shop.html`** — deleted the buried inline cart card and its duplicate
  checkout handler; add-to-cart buttons now call `PLS.Cart.add(id, 1)`.
- **All 10 pages** now include `js/store.js` + `js/cart.js` (header cart button is global).
- **`app/styles.css`** — drawer, badge, toast, stepper styles (mobile-first).

## Verification (2026-09-28)
- `node --check` clean on cart.js, store.js, and all inline page scripts.
- Stub-DOM logic test (`/tmp/cart-test.js`): 19/19 pass — persistence, badge,
  drawer render, steppers, subtotal, single checkout path, double-click guard,
  error recovery, unavailable-item handling.
- Live API test: `cartCreate` with 2 real variants → real hosted checkout URL.
- Checkout-path audit: the only Shopify checkout redirect in the app is in cart.js.

## Live verification after deploy
- Pushed to `main` (36 files) and `gh-pages` (25 files) on 2026-09-28.
- Live site returned HTTP 200; re-ran the end-to-end API flow (add → cartCreate →
  checkout URL) successfully.

## Still out of scope (unchanged)
Shopify admin settings, customer accounts, Shop Pay, Plus subscription/discount
billing — none touched. The "Plus members save 10%" copy remains marketing-only.
