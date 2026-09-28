# Shopify Integration Research — Pluto and Luna Select
**Store:** https://www.plutoandlunaselect.com (Shopify) · **Date:** 2026-09-28
**Goal:** one ecosystem — the store inside the app, the app's content inside the website.

---

## 1. Store audit (fetched live 2026-09-28)

**What's there:**
- Homepage: "Pluto And Luna Select | Premium Dog Grooming, Treats & Accessories." Hero + 12 category tiles: Pet Shampoo & Bath, Dog Beds, Dog Bowls & Feeders, Dog Toys, Pet Health & Dental, Dog Training, Pet Travel, Waste Management, Grooming, Dog Apparel, Leashes/Collars/Harnesses, Treats & Chews.
- Dog Toys collection: **62 items**, priced **$12.99–$124.99** (e.g., lick pad $14.00, puzzle ball $31.99, rope ball $22.99). Filters (availability, price, sort) work — a real catalog, not a demo.
- "From Pet Lovers, For Pet Lovers" brand story section; "Let customers speak for us — **from 0 reviews**."

**What's wrong / missing:**
- **Dropship-style product titles.** The underlying product titles are raw supplier keyword-stuffing, e.g. "Pet Supplies Dog Molar Stick Biting Dog Toothbrush Cooling Frozen Dog Toys" and "Pet Dog Puzzle Toy Bone Paw Print New Wooden Toy Feeding Multifunctional Pet Toy." The theme displays cleaned display titles, but the supplier titles live on in handles/SEO. Cleanup needed before this catalog represents a premium brand.
- **Placeholder homepage copy.** "Our signature product — Made with care and unconditionally loved by our customers, this signature bestseller exceeds all expectations" sits above a "0 reviews" section. With no customers yet, this copy is actively dishonest-looking; replace with the Pluto & Luna founder story.
- **No reviews, no social proof, no email capture visible** on the fetched pages.
- **Nutrition gap (strategic):** the catalog is toys/grooming/beds/accessories — **no dog food, treats-for-nutrition, or supplements.** The dog-nutrition app concept needs nutrition-adjacent products to complete the commerce loop (supplements, feeding tools — the lick pad/slow feeder SKUs are the natural bridge). Recommend adding a small "Nutrition" collection (supplements, slow feeders, portion tools) as Phase 1 store work.

Sources: live fetch of https://plutoandlunaselect.com/ and https://plutoandlunaselect.com/collections/dog-toys (2026-09-28).

---

## 2. Headless commerce path (the store inside the app)

**The current-correct stack (2026):**
- **Storefront API** (GraphQL) is *the* way to put this store inside a custom app. It exposes products, collections, search, cart, and checkout handoff with a **public access token that is safe in client-side code**. As of current versions, Shopify documents **tokenless access** for products/collections/search/cart — plain `fetch()`, no build step, `access-control-allow-origin: *`.
  - Sources: https://shopify.dev/docs/api/storefront · https://github.com/codwats/prism/blob/HEAD/docs/research/shopify-storefront-integration.md
- **Mobile Buy SDKs are deprecated.** The replacement for native checkout presentation is **Checkout Kit** (shopify/checkout-kit, currently alpha for Android/iOS) — but the simpler, production-safe pattern is: build the cart with the Storefront/Cart API, then hand the buyer to `cart.checkoutUrl`. https://github.com/shopify/checkout-kit/blob/HEAD/platforms/android/README.md
- **Checkout is ALWAYS Shopify-hosted.** There is no supported way to render the checkout page itself inside your app. The standard headless pattern: `cartCreate` → add lines → redirect buyer to `cart.checkoutUrl`, which lands on the store's own domain checkout (Shop Pay, Apple Pay, etc. all work). No plan gate is documented for this — it is domain configuration, not a Plus feature. ⚠️ (per third-party research; confirm in Shopify docs before promising the founder zero plan requirements)
- **Cart limits:** max 500 line items; checkout *creation* is throttled per minute (unpublished cap; returns `200 Throttled` in the body — implement exponential backoff). No per-minute rate limit on buyer catalog traffic: "Requests from real buyers aren't subject to a fixed request-per-minute limit." Bots/crawlers get strict limits — our PWA makes buyer-origin requests, which is the intended path. https://shopify.dev/docs/api/usage/limits#rate-limits
- **Storefront Web Components** (`cdn.shopify.com/storefront/web-components.js` + `<shopify-store>`/`<shopify-cart>`) — declarative script-tag product/cart UI with no build step and no token. Useful middle path for embedding buy UI in website pages. https://shopify.dev/docs/api/storefront-web-components/getting-started

**Customer accounts (one account across app + website):**
- **Customer Account API** (OAuth 2.0 / OIDC with PKCE) is the current path for headless auth — profile, addresses, orders. It **requires the store's "new customer accounts"** (passwordless: email one-time code, social login, Shop login). Multipass is legacy-only and does NOT work with new customer accounts. The old Storefront API customer mutations (`customerCreate`, `customerAccessTokenCreate`) are on the deprecation path.
- **Single sign-on to checkout is now native** on new customer accounts **for all plans** — the authenticated state carries from the headless app into Shopify checkout. (Previously a Plus-only Multipass workaround.)
- Sources: https://www.shopify.com/za/partners/blog/introducing-customer-account-api-for-headless-stores · https://codekaarigari.com/blog/shopify-legacy-customer-accounts-deprecated-rebuild-2026/ · https://revize.app/blog/shopify-legacy-customer-accounts-deprecated-upgrade-guide

**App content on the website (theme app extensions):**
- **Theme app extensions** inject functionality into Online Store 2.0 themes *without editing theme code*: **app blocks** (merchant drags into sections — e.g., "Community highlights," "Scanner result of the week," "Knowledge base teaser") and **app embeds** (global — e.g., "Open in app" banner, chat widget). Versioned by the app, removable without residue.
- Requires a Shopify custom app (built with Shopify CLI) deployed to the store; the founder then enables blocks/embeds in the theme editor — a few clicks, no code.
- Sources: https://github.com/biggora/e-commerce-plugin-skills/blob/HEAD/skills/shopify/references/storefront-and-themes.md

---

## 3. Bidirectional spec

**(a) App shows real products + checkout (store → app):**
1. PWA calls Storefront API (tokenless or public token) for collections/products/search — cached in Cloudflare KV, revalidated hourly.
2. Product detail screens render from live Shopify data (price, inventory, images). Scanner results deep-link to relevant SKUs by product handle (e.g., "avoid" kibble → slow-feeder + supplement alternatives from the store).
3. Cart is built via Storefront Cart API in the PWA; buyer taps checkout → `cart.checkoutUrl` → Shopify-hosted checkout on plutoandlunaselect.com (Shop Pay express). We never touch card data.

**(b) Website shows app content (app → website):**
1. **Source of truth = the PWA/Supabase** (knowledge base, community posts, scan verdicts).
2. **Syndication to Shopify:** a small sync worker publishes curated items as Shopify **metaobjects** (or blog posts) via the Admin API; **theme app blocks** render them on the website (homepage "Community picks," product-page "Scan verdict" block, KB article teasers). Merchant-toggled in the theme editor.
3. Alternative (lighter): website links out to PWA screens ("Read the full guide in the app →"). Recommend the metaobject + app-block route for SEO value — the content then lives on the store's domain and ranks.

**(c) One account across both:**
1. Founder enables **new customer accounts** in Shopify admin (Settings → Customer accounts).
2. PWA authenticates via **Customer Account API** (OAuth/OIDC, PKCE); same identity works on the website and carries SSO into checkout. No passwords, no Multipass, no custom user table for commerce identity (app profiles/pets stay in Supabase, keyed by Shopify customer ID).

**(d) Loyalty/rewards:**
- Shopify has **no native loyalty program**. Options are third-party apps (Smile.io, Yotpo — pricing ⚠️ unverified, free tiers exist). **Recommendation: defer.** Phase 1 loyalty = paid-tier store discount implemented with Shopify **discount codes / automatic discounts** (native, free) — e.g., app subscribers get 10% off, applied via a discount code surfaced in the app. Real points program in Phase 2+ only if retention data justifies it.

---

## 4. Costs and limits

| Item | Cost / limit | Notes |
|---|---|---|
| Shopify plan (store already live) | **Basic $39/mo** ($29/mo annual); Grow $105 ($79); Advanced $399 ($299); Plus from $2,300 | Basic is sufficient for everything in this spec. ⚠️ Basic has **no staff accounts** (owner login only) — a VA/bookkeeper needs Grow. |
| Headless / Storefront API | **$0 extra** | No Shopify fee for headless storefronts; no buyer-traffic rate limit |
| Transaction fees | **2.9% + 30¢** (Shopify Payments, Basic) | Using a third-party gateway adds **+2% Shopify fee** on Basic — use Shopify Payments. In-app headless orders bill at the same online rates. |
| PWA hosting (Cloudflare Pages) | $0 | Free tier |
| Supabase (app data) | $0 start | Free tier |
| Shop channel | $0 | Optional discovery (see §5) |

Pricing sources (US, Sept 2026): https://en.valley4techs.com/2026/09/shopify-pricing-plans-tco.html · https://shopthemedetector.com/blog/how-much-is-a-shopify-month-vs-yearly-plan/ — ⚠️ confirm current figures in Shopify admin before committing; Shopify changes pricing.

**Bottom line:** the integration adds **$0/month** to the existing Shopify bill. The only money moving is the standard per-order card processing the store already pays.

---

## 5. Shop app — does listing matter?

- **What it is:** Shopify's consumer shopping app (order tracking, Shop Pay, local-store discovery, "Shop Facts" trust signals). Enabling it requires: US presence (✓), **Shop Pay enabled**, opt-in in admin, and compliance with Shop Merchant Guidelines (pet products are allowed — no prohibited-type issue).
- **Verdict: do it, but expect little.** It's free, takes ~15 minutes, adds Shop Pay express checkout (conversion lift) and a small discovery surface. For a zero-audience store it will not move the needle on traffic — the app's own content/community is the acquisition engine, not Shop. Enable in Phase 1 for the Shop Pay benefit; revisit as a channel only after traction.
- Source: https://www.brihaspatitech.com/blog/shopify-shop-app-your-gateway-to-new-markets/

---

## 6. Concrete integration architecture

```
┌─ PWA "Pluto & Luna" (Cloudflare Pages, mobile-first) ─────────────┐
│ Scanner · Pet profiles · Meal planner · KB · Community · SHOP TAB  │
│   Shop tab → Storefront API (tokenless) → products/cart            │
│   Checkout → cart.checkoutUrl → Shopify-hosted checkout (Shop Pay) │
│   Auth → Customer Account API (OAuth/OIDC, new customer accounts) │
│   App data (pets, scans, posts) → Supabase                         │
└──────────────┬────────────────────────────────────────────────────┘
               │ Admin API (custom app, server-side worker)
               ▼
┌─ Shopify: plutoandlunaselect.com ─────────────────────────────────┐
│ Products/orders/checkout (unchanged)                               │
│ + metaobjects ← synced KB highlights / community picks / verdicts  │
│ + theme app blocks → render them (homepage, product pages)         │
│ + app embed → "Get the app" banner                                 │
└────────────────────────────────────────────────────────────────────┘
```

**Phasing:** Phase 1 — Storefront API shop tab + checkout handoff + new customer accounts + Shop Pay + app blocks for KB/community teasers. Phase 2 — subscriber discount codes, reviews, loyalty app evaluation. Phase 3 — deeper (subscriptions via Shopify Subscriptions app if consumables launch).

## 7. What the founder must do (agents cannot)

1. **Create the Storefront API token:** Shopify admin → Settings → Apps and sales channels → **Develop apps** → create app "Pluto & Luna PWA" → enable Storefront API with `unauthenticated_read_products`, `unauthenticated_read_collections` (+ `unauthenticated_write_checkouts` for cart) → copy the **public access token** to Luna. (Or use tokenless access — token still recommended for reliability.)
2. **Enable new customer accounts:** Settings → Customer accounts → switch to **new customer accounts** (passwordless). Required for the Customer Account API + checkout SSO.
3. **Enable Shop Pay** (Settings → Payments) and **opt into the Shop channel** when ready.
4. **Approve the theme app extension:** after the crew builds it, open the theme editor → App embeds/blocks → toggle on "Pluto & Luna" blocks. A few clicks.
5. **Store hygiene (30 min):** rewrite the "signature product / 0 reviews" homepage placeholder with the Pluto & Luna founder story; start cleaning supplier keyword-stuffed product titles; add a small "Nutrition" collection (supplements, slow feeders, portion tools) to bridge the app's nutrition content to commerce.
6. **Plan check:** confirm current plan (Basic $39/mo is fine; note no staff accounts — upgrade to Grow only if a second login is needed).

Nothing here requires Plus, a developer retainer, or theme code edits.
