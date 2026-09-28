# Pluto & Luna Select — Ecosystem PWA

**Live target:** `https://www.plutoandlunaselect.com/app` (deploy this folder to Cloudflare Pages, or serve under `/app` on the Shopify domain).

One ecosystem: the **store**, the **app**, and the **content** — pet profiles, a dog-food
scanner, vet-reviewed knowledge base, homemade recipes, community forum, health records.

## Architecture

```
app/
├── index.html          Home — hero, active pet spotlight, feature tiles, Plus upsell
├── pets.html           Pet profiles (add/edit/remove, conditions drive personalization)
├── scanner.html        Food scanner UI (5 free scans/week; unlimited on Plus)
├── knowledge.html      Care guides: toxic foods, emergency, puppy training, senior care, feeding
├── recipes.html        Dog-friendly recipes w/ constraint tags + estimated nutrition
├── community.html      Forum (4 categories, seeded posts, AI-labeling, user posting)
├── shop.html           Store-in-app (live Shopify Storefront API)
├── upgrade.html        Plus paywall ($6.99/mo placeholder — founder to confirm)
├── planner.html        Advanced nutrition planner (Plus-gated, in development)
├── records.html        Health records + med reminders (Plus-gated, local for now)
├── styles.css          Warm pet-brand design system
├── manifest.webmanifest / sw.js / icons/   PWA plumbing
├── js/
│   ├── app.js          Tier state, bottom nav, localStorage helpers, disclaimers
│   ├── pets.js         Pet CRUD + tag-matching personalization contract
│   ├── scanner.js      analyzeProduct() stub + documented interface (methodology crew)
│   ├── store.js        Storefront API interface + mock catalog (Shopify research crew)
│   ├── knowledge.js    Guide content (sources + vet-review status on every guide)
│   ├── recipes.js      Recipe library (nutrition = estimated, pending review)
│   └── community.js    Forum data + AI_LABEL constant
├── agents/
│   └── posting-spec.md AI forum posting policy (FTC disclosure — bots never pose as humans)
└── data/               (reserved for ai-post-log.json per the posting spec)
```

## What's real vs stubbed

| Area | Status |
|---|---|
| Pet profiles (localStorage) | ✅ Real — CRUD, active-pet personalization, 3-pet free limit |
| Knowledge base (5 guides) | ✅ Real content — sources cited, all marked "vet review pending" |
| Recipes (8) | ✅ Real content — nutrition **estimated**, pending vet-nutritionist review |
| Community forum | ✅ Real UI — seeded posts, user posting (local), AI posts permanently labeled |
| Scanner | ⚠️ **DRAFT** — real 15-factor rubric implemented in `js/scanner.js` (`methodology: "v1-draft"`); 0–100 score, food/treats tracks, hard gates (xylitol/recall/AAFCO/life-stage), provenance badges, pet-profile personalization; ships as DRAFT pending vet-nutritionist review. Barcode lookup live via Open Pet Food Facts (graceful miss → manual entry). FDA recall check best-effort via openFDA (never claims "never recalled"). OCR/label-photo capture still pending. |
| Store | ✅ Live — real catalog via Storefront API public token; categories from real collections; Shopify-hosted checkout (no card data in app) |
| Nutrition planner | ⚠️ **In development** — Plus-gated preview; engine pending vet-nutritionist |
| Health records | ✅ Real (local) — med reminders + vet log in localStorage; push + cloud sync later |
| Tiers/paywall | ✅ Real gating — free/paid state, scan budget, pet limit, upgrade nudges; billing is demo until Stripe |

## Data model (localStorage → Supabase)

| localStorage key | Supabase table | Shape |
|---|---|---|
| `pls_tier` | `app_users.tier` | `"free" \| "paid"` |
| `pls_pets` | `pets` | `{ id, user_id, name, breed, photo_emoji, age_years, weight_lbs, conditions[], dietary_needs[], notes, created_at }` |
| `pls_active_pet` | `app_users.active_pet_id` | pet id |
| `pls_scans` | `scans` | `{ user_id, week_start, count }` |
| `pls_scan_history` | `scans` | `{ user_id, input, verdict, score, methodology, created_at }` |
| `pls_cart` | — (session only) | `{ product_id, qty }[]` — checkout always on Shopify |
| `pls_forum_user` | `forum_posts` | `{ id, user_id, category, title, body, author_type: "human", created_at }` |
| `pls_meds` / `pls_vetlog` | `health_records` | `{ id, pet_id, kind: "med"\|"vet", ... }` |
| `pls_planner_notify` | `waitlist` | `{ user_id, interest: "planner" }` |

## Go-live steps (exact order)

1. **Legal/vet review** — vet-nutritionist reviews scanner rubric + recipes; lawyer reviews disclaimers, guarantee-free (no savings claims here), and the AI posting spec.
2. **Shopify wiring** — ✅ done 2026-09-28: public Storefront token from the Headless channel wired into `js/store.js` (live catalog, collection categories, cartCreate → hosted checkout redirect). Verify checkout redirect on a real phone after deploy.
3. **Scanner methodology** — rubric implemented as DRAFT (`v1-draft`); vet-nutritionist must review §2 factor weights, AAFCO minimums, allergen/condition wordings, and the disclaimer before the banner comes down. Then: OCR/label-photo capture (ML Kit vs Gemini Flash 200-label test), curated recall table + weekly FDA monitoring agent, OPFF share-alike legal review (attribution is already shown in-app on verified results).
4. **Supabase** — create project, run table DDL per the shapes above, swap localStorage helpers in `js/app.js` for Supabase client calls (interface unchanged for the UI).
5. **Stripe** — replace the demo upgrade button with Checkout; confirm `$6.99/mo` price with founder first.
6. **Brevo** — waitlist + planner-notify capture; med-reminder push via PWA push later.
7. **Deploy** — `npx wrangler pages deploy .` from this folder, or point `plutoandlunaselect.com/app` at it. Verify `sw.js` registers and the manifest installs.
8. **Seed the forum** — agents begin posting per `agents/posting-spec.md` (max 2 AI threads/week, always labeled).

## Content honesty rules (do not regress)

- Nothing is ever "vet-reviewed" unless a vet actually reviewed it — status lives on every guide/recipe.
- Nutrition numbers are estimates until the vet-nutritionist signs off.
- AI forum posts are permanently labeled. No exceptions.
- Checkout never touches card data — always Shopify hosted checkout.
