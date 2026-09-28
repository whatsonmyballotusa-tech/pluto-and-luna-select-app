# Dog-Food Scanner Methodology — Spec Sheet (v1.0, DRAFT — requires vet-nutritionist review)

**Feature:** Scan a dog food/treat bag (barcode → database; label photo → OCR fallback) → verdict **Recommended / Good / Caution / Avoid**, personalized to the pet's profile, every claim explainable in plain language citing the exact ingredient or label line.

**Status:** Research spec. NOT veterinary advice. No score ships without vet-nutritionist sign-off on the rubric (§2) and the disclaimer (§4).

---

## 1. Data sources

### 1.1 Open Pet Food Facts (OPFF) — primary product database
- **What:** Crowdsourced open database of pet food products (sister project of Open Food Facts).
- **Coverage:** "Over 10,000 pet products" per the project's own app listing — small relative to the US market (thousands of SKUs). **Coverage gap is the #1 product risk: most scans of niche/regional brands will miss.** Plan for the miss (§3).
- **API:** `GET https://world.openpetfoodfacts.org/api/v2/product/{barcode}.json` — no auth, ~100 req/min per IP (per community documentation). Universal lookup with `?product_type=all` redirects across the OFF family if a barcode lives on the wrong instance.
- **Useful fields:** `product_name`, `brands`, `ingredients_text`, `nutriments` (per-100g), `allergens`, `labels`, `image_*_url`, `categories`.
- **Note:** OPFF lists a "PetScore" (nutritional score) on product pages, but its methodology is undocumented — ⚠️ do NOT rely on it; we compute our own score (§2).
- **License:** Open Database License (ODbL). **Legal consequences:** (a) attribution required in-app ("Product data: © Open Pet Food Facts contributors, ODbL"); (b) share-alike — if we publish a derived product database built on OPFF data, it must be shared back under ODbL. Our *scoring layer* (rubric + verdicts) is our own IP; the *underlying product facts* inherited from OPFF stay share-alike. **Flag for legal review before launch.**
- **Offline option:** Full CSV export (~0.9 GB compressed) at `https://static.openpetfoodfacts.org/data/en.openpetfoodfacts.org.products.csv.gz` — enables a local product cache so scans work offline and reduce API dependence.
- Sources: https://ph.openpetfoodfacts.org/data · https://github.com/openfoodfacts/openfoodfacts-server/blob/HEAD/docs/api/tutorials/scanning-cosmetics-pet-food-and-other-products.md · https://f-droid.org/en/packages/org.openpetfoodfacts.scanner/

### 1.2 FDA recall data — best-effort signal, NEVER a clean bill of health
- **openFDA** (`https://api.fda.gov`) is free and keyless: `food/enforcement.json` and `drug/enforcement.json` are the endpoints that carry pet-food recalls. **There is no dedicated animal/pet-food recall endpoint.**
- ⚠️ **Critical limitation (third-party verified):** A systematic check found openFDA's enforcement data *genuinely incomplete* for pet food — FDA-confirmed recalls including Blue Buffalo (2010/2017/2022) and the 2021 Sportmix aflatoxin recall (~70 dog deaths, formal Class I) return **zero** records under any search. FDA's own recall-history page is not the same backing data as the openFDA API.
- **Design rule:** A zero-result recall check displays "**No recall records found in this database** — this does not mean the product was never recalled." Never display "never recalled."
- **Compensating controls:** (a) maintain our own recall table seeded from FDA announcements (precedent: Safe Pet Treats claims every recalled product since 2014 in-app — it is feasible to curate manually); (b) weekly agent task monitoring FDA's animal/veterinary recalls page (`fda.gov/animal-veterinary/safety-health/recalls-withdrawals` — ⚠️ URL from secondary source, verify); (c) user-facing "report a recall" with moderator review.
- Sources: https://github.com/pipeworx-io/mcp-veterinary-fda · https://github.com/noble-ronin/fda-recalls-api

### 1.3 AAFCO — the regulatory backbone of the rubric
- **Nutritional adequacy statement (the gate):** US pet food labels must carry one of four verbatim statements. For "complete and balanced" claims, one of:
  1. *"[Product] is formulated to meet the nutritional levels established by the AAFCO Dog Food Nutrient Profiles for [life stage]."* (formulation — ~80% of products, per veterinary reporting)
  2. *"Animal feeding tests using AAFCO procedures substantiate that [Product] provides complete and balanced nutrition for [life stage]."* (feeding trial — stronger evidence)
  3. Family/comparison variant of the above.
  4. *"This product is intended for intermittent or supplemental feeding only."* (treats, toppers, supplements — NOT a complete diet)
- **If a product marketed as food has no adequacy statement → it cannot be "complete and balanced" → hard cap on verdict.**
- **Life stages:** Growth, Adult Maintenance, Gestation/Lactation, All Life Stages, Intermittent/Supplemental. Growth/All-Life-Stages must add the large-breed puppy clarifier ("including/except for growth of large dogs ≥70 lb adult weight") — calcium ceiling matters for skeletal development.
- **Nutrient minimums (dry-matter basis; widely published summaries — ⚠️ AAFCO Official Publication is paid; vet-nutritionist must verify before launch):**

  | Nutrient | Growth & Reproduction | Adult Maintenance |
  |---|---|---|
  | Crude protein | 22.5% | 18.0% |
  | Crude fat | 8.5% | 5.5% |

  (Older publications cite 22.0/18.0 protein and 8.0/5.0 fat — use the newer profile values pending verification.)
- **New labeling rules:** AAFCO approved updated labeling requirements (July 2023, rollout from 2024) including a standardized nutrition facts panel moving toward front-of-pack — label parsing must tolerate both old and new formats.
- Sources: https://www.chewy.com/education/dog/food-and-nutrition/what-is-aafco · https://www.freshpet.com/blog/understanding-wsava-dog-food-guidelines-and-aafco-standards · https://legalclarity.org/complete-and-balanced-dog-food-aafco-nutritional-adequacy/ · https://journeydogtraining.com/aafco-dog-food-nutrient-profiles-what-they-are-why-they-matter/

### 1.4 Guaranteed Analysis (GA) parsing
- The label panel gives **minimums** (crude protein, crude fat) and **maximums** (crude fiber, moisture) on an **as-fed basis** — NOT dry-matter. Comparing as-fed numbers across wet/dry foods is meaningless without conversion.
- **Dry-matter conversion:** `DM% = as-fed% ÷ (100 − moisture%) × 100`. Moisture is usually listed as a *maximum*, so the conversion is an estimate — display as "~" and never as precise.
- **What GA cannot tell you:** actual (not minimum) nutrient levels, bioavailability/digestibility, ingredient quality. The rubric treats GA as a floor check, not a quality proof.

---

## 2. Scoring methodology (DRAFT — vet-nutritionist review required)

### 2.1 Architecture
- **Two-track scoring:** *Food* (complete-diet track) vs *Treats/toppers* (supplemental track — judged on ingredient safety only, never on AAFCO completeness).
- **Score:** 0–100, additive bonuses + penalties. Every point movement must map to a visible, plain-language explanation citing the exact ingredient or label line.
- **Verdict bands (food track):**

  | Band | Score | Meaning |
  |---|---|---|
  | ✅ Recommended | 80–100 | Complete & balanced for this pet's life stage, no critical flags |
  | 👍 Good | 60–79 | Solid choice; minor caveats listed |
  | ⚠️ Caution | 40–59 | Significant concerns — read the why-list before buying |
  | 🛑 Avoid | 0–39 | Critical problems (see §2.3) — do not feed as sole diet |

- **Hard gates (override the numeric score):**
  - Product marketed as a complete food but **no AAFCO adequacy statement** → max verdict "Caution," with "Avoid as sole diet" guidance.
  - **Xylitol (birch sugar)** anywhere in ingredients → 🛑 Avoid + urgent "toxic to dogs — contact your vet immediately if ingested" alert. (Rare in dog products; lethal when present.)
  - **Active FDA/manufacturer recall on the exact product** → 🛑 Avoid with recall details + lot info if available.
  - **Life-stage mismatch** (e.g., "adult maintenance" food scanned for a puppy profile) → personalized "Not for {Name}" regardless of base score.

### 2.2 Factor table (food track)

| # | Factor | Points | Plain-language explanation shown to user |
|---|---|---|---|
| 1 | AAFCO adequacy statement present, matches pet's life stage | +10 / gate | "Meets AAFCO standards for {adult dogs/puppies} — {by formulation / by feeding trial}." Feeding-trial variant noted as stronger evidence. |
| 2 | Named animal protein is first ingredient (chicken, salmon, beef…) | +15 | "Real {chicken} is the #1 ingredient — ingredients are listed by weight." |
| 3 | No animal protein in first 3 ingredients | −10 | "No named meat in the top 3 ingredients — most of the protein may come from plants." |
| 4 | **Unnamed** meat/poultry by-products or "animal digest" | −10 | "Contains 'meat by-products' — the source animal isn't named, so quality can't be judged." |
| 5 | Named by-product meal (e.g., "chicken by-product meal") | 0 + note | "Contains chicken by-product meal. AAFCO defines these as nutritious organ/meat parts, but quality varies by manufacturer — flagged for transparency, not penalized." (⚠️ Vet to confirm stance.) |
| 6 | Artificial preservatives: BHA, BHT, ethoxyquin | −20 | "BHA: US National Toxicology Program lists it as 'reasonably anticipated to be a human carcinogen' (IARC 2B), based on rodent forestomach tumors — regulators debate relevance to dogs. BHT: EFSA 2012 found no genotoxicity/carcinogenicity concern at approved levels; flagged on precaution (non-nutritive synthetic, earlier high-dose rodent effects). Ethoxyquin: high doses caused reversible liver effects in FDA-reviewed dog feeding studies; FDA asked industry to cap at 75 ppm (1997); EU/Australia never approved it as a food ingredient. Natural alternatives (mixed tocopherols) exist." Propylene glycol (semi-moist foods) flagged separately. |
| 7 | Artificial colors (Red 40, Yellow 5/6, Blue 2) or artificial flavors | −10 | "Artificial colors are cosmetic — for you, not your dog." |
| 8 | Added sweeteners (corn syrup, sugar, sorbitol) | −10 | "Added sugars add calories without nutrition and harm dental health." |
| 9 | Crude protein meets AAFCO minimum for life stage (DM-adjusted) | +10 / −15 if below | "Protein {meets / falls short of} the AAFCO minimum for {adult dogs}." |
| 10 | Crude fat meets AAFCO minimum (DM-adjusted) | +5 | Same pattern as protein. |
| 11 | Multiple cheap fillers in top 5 (corn, wheat, soy listed 2+ times) | −5 | "Corn appears 3 times in the top 5 — often used to bulk up protein numbers cheaply." (⚠️ Vet to confirm weight; grains are not inherently bad — see §2.4.) |
| 12 | Calorie content (kcal/kg or kcal/cup) stated | +5 | "Calorie content is listed, so portions can be measured — many bags omit it." |
| 13 | Grain-free with peas/lentils/legumes prominent | −5 + note | "Heavy on peas/lentils. The FDA investigated a link between such diets and heart disease (DCM) in dogs — the science is unsettled; ask your vet." |
| 14 | Named manufacturing country/facility disclosed | +5 | "Made in {country} in the company's own facility — traceability matters when recalls happen." |
| 15 | Brand/product recalled in last 5 years | −25 | "Recalled in {year} for {reason} — details here." (Informational beyond 5 years.) |

**Treats track:** factors 6, 7, 8, 14, 15 apply; adequacy statement replaced by "intended for supplemental feeding" check; calorie-per-treat presence scored (+5). No protein/fat minimum scoring.

### 2.3 What "Avoid" must always include
Every 🛑 Avoid or ⚠️ Caution verdict renders an itemized **"Why" list**: each flagged factor as a separate row with (a) the exact ingredient/label text, (b) one plain-language sentence, (c) severity. No black-box scores — if we can't explain it, we don't show it.

### 2.4 Deliberate honesties (do NOT oversimplify)
- **Grains are not poison.** Many veterinary nutritionists consider corn/wheat/soy acceptable; the rubric penalizes only *filler-stacking*, lightly, and says so.
- **"Grain-free" is not healthier by default** — see factor 13 (FDA/DCM investigation).
- **By-products are not automatically bad** — factor 5 is neutral-with-note, pending vet confirmation.
- **AAFCO minimums are minimums, not optimums** — a food can pass AAFCO and still be mediocre; the rubric says this on the score screen.
- **Price is not scored.** Expensive ≠ better; cheap ≠ worse. (Keeps us independent — and keeps Pluto and Luna Select's own products honest if they ever get scanned.)

### 2.5 Personalization layer (pet profile)
Profile fields: species (dog), age → life stage, weight, breed/size (large-breed puppy calcium rule), conditions & sensitivities (multi-select: chicken allergy, grain sensitivity, kidney disease, pancreatitis → low-fat preference, diabetes → low-sugar/complex-carb preference, weight management).
- **Allergen cross-check:** profile lists "chicken" → any chicken-derived ingredient triggers personalized "⚠️ Contains chicken — flagged for {Name}."
- **Condition notes are informational, never prescriptive:** "Lower-fat foods are often discussed with vets for pancreatitis-prone dogs — ask yours." Never "feed this for pancreatitis."

---

## 3. OCR / label pipeline

### 3.1 Flow
1. **Barcode scan → Open Pet Food Facts lookup** (primary path; §1.1).
2. **On miss:** prompt user to photograph the **ingredient panel + guaranteed analysis panel** (guided capture: "fit the ingredient list in the frame").
3. **OCR + structuring:** extract raw text → LLM structuring into `{ingredients[], guaranteed_analysis{}, aafco_statement, calorie_content, manufacturer}` → run rubric (§2) → verdict marked **"label-derived — not yet verified against our product database."**
4. **Feedback loop:** user confirms/corrects parsed ingredients → correction queued for moderator review → enriches our product DB (same crowdsourcing model as OPFF itself).

### 3.2 OCR options assessment
- **Taggun / Veryfi (grocery receipt stack):** ⚠️ **Not recommended for labels.** Both are receipt-specialized — their ML models extract merchant/total/tax/date/line-items from receipts. An ingredient panel is a different document type (dense small print, no totals); using receipt models on it would be off-label and accuracy is unvalidated. Do not reuse without testing.
- **Recommended path:** (a) on-device **Google ML Kit Text Recognition** (free, no per-scan cost, works offline) for raw text extraction; (b) **multimodal LLM (Gemini Flash or equivalent, ~$1/1k scans class)** to read the label photo directly and return structured JSON — current models handle dense small print well, and one call replaces OCR+parsing. ⚠️ Accuracy on wrinkled/reflective packaging must be validated with a 200-label test set before launch.
- **Cost control:** barcode-DB hits cost $0; label scans are the only metered path. Free tier: 5 label-scans/week; paid: unlimited (matches the tier plan in memory).

### 3.3 Provenance badges (never hide uncertainty)
Every verdict shows one badge: **"Verified product data"** (OPFF hit + our QA), **"Label-derived"** (OCR path), or **"Insufficient data"** — see §4.

---

## 4. Honest limits & disclaimers

### 4.1 What the scanner CANNOT know
- Manufacturing quality, ingredient sourcing, or whether the bag matches the label (labels can lie; GA lists minimums, not actuals).
- Nutrient **bioavailability/digestibility** — not on any label.
- How an individual dog will respond (allergies, intolerances, palatability).
- Long-term effects — AAFCO feeding trials run months, not years.

### 4.2 "We don't have enough data" — never guess
If barcode misses AND the label photo is unreadable/declined: show **"We don't have enough data on this product to score it"** + options (retake photo, search manually, request review). **Never hallucinate a score.** A wrong "Recommended" destroys trust permanently; an honest "I don't know" builds it.

### 4.3 Disclaimer (draft — legal + vet review required)
> "This scan is an educational ingredient analysis, not veterinary advice. It is based on label data and published nutritional standards (AAFCO), which describe minimums — not what's optimal for your individual dog. Every dog is different. Talk to your veterinarian before changing your dog's diet, especially for puppies, seniors, or dogs with health conditions. If your dog ate something potentially toxic (e.g., xylitol/birch sugar), contact your veterinarian or poison control immediately."

---

## 5. Competitors — is there a "Yuka for dog food"?

**Yuka itself: no.** Yuka (60M+ users) scans human food and cosmetics only — every product description found covers "food & personal care products" for human health impact. No pet-food scanning found in any source. **The lane is open.** (⚠️ No explicit "we don't scan pet food" statement located; conclusion from absence across all descriptions.)

| Competitor | What it does | Weaknesses / our opening |
|---|---|---|
| **Safe Pet Treats** (safepettreats.com; iOS/Android) | Barcode scan → flags 30+ harmful ingredients (BHA, BHT, ethoxyquin, propylene glycol, by-products), FDA/manufacturer recall check, "true country of origin," 36,000-product DB, manual search fallback, zero ads | AppFollow: **3.0★ (108 reviews)** — quality/reliability complaints. No pet profiles or personalization; binary safe/unsafe with no explainable scoring; no AI label reading; recall DB is manually curated (good) but methodology opaque. **This is the direct incumbent — beatable on personalization, explainability, and UX.** |
| **Open Pet Food Facts app** | Barcode scan → ingredients/nutrition from the open DB; crowdsourced additions | **2.9★, ~10K+ downloads**; top reviews: "things I scan come up with nothing" (the coverage problem), crashes. No scoring at all — it's a database viewer, not an advisor. |
| **PetFoodWizard** (website) | Manual ingredient entry → safety feedback | No barcode scanning; web-only; thin product. |
| **Dog Food Advisor** | Editorial star-rating reviews of dog foods | Review-site, not scan-based (⚠️ verify current app features); ratings are one-size-fits-all, not personalized; ad-supported. |

**Net:** No competitor combines barcode scan + explainable scoring + pet-profile personalization + AI label fallback. Safe Pet Treats is the closest and is weak (3.0★). **CONDITIONAL GO on the feature — conditions in §2 (vet review) and §4 (disclaimers).**

---

## 6. Open items for vet-nutritionist review (blockers before launch)
1. Approve/modify every factor weight in §2.2 (esp. #5 by-products, #11 fillers, #13 grain-free/DCM).
2. Verify AAFCO minimum values used (§1.3) against the current Official Publication.
3. Review allergen/condition note wordings (§2.5) — informational vs. prescriptive line.
4. Review disclaimer (§4.3).
5. Sign off on the treats-track rubric.

## 7. Open items for engineering
1. 200-label OCR accuracy test (ML Kit vs. Gemini Flash direct-read) before choosing the pipeline.
2. OPFF attribution + share-alike legal review (§1.1).
3. Build the curated recall table + weekly FDA monitoring agent task (§1.2).
4. Dry-matter conversion display rules (always "~", never precise).

---
*Spec version 1.0 — 2026-09-28. Sources cited inline. ⚠️ = unverified, do not treat as fact.*
