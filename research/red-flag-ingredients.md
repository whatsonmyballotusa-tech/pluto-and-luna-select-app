# Red-Flag Ingredient Database — Source Reference

**Version:** 1.0 · **Updated:** 2026-09-28 · **Methodology:** v1-draft
**Status:** ⚠️ DRAFT — pending vet-nutritionist review. Do not publish claims from this file as veterinary advice.

Canonical structured data: `red-flag-ingredients.json` (same directory).
Consumer: `~/workspace/dog-app/app/js/scanner.js` (`RED_FLAG_DB`, synced via `sync-red-flags.js`).

## Tier definitions (evidence-calibrated)

| Tier | Meaning | Scanner behavior |
|---|---|---|
| **TOXIC** | Acutely toxic to dogs — veterinary-emergency ingredients | Immediate **Avoid** verdict + emergency alert naming vet/poison-control |
| **AVOID** | Evidence of harm or serious regulatory/scientific concern. Debates and species-specific limits are stated honestly in `why_plain` | **Avoid**-level result (score capped at 39), **no emergency language** unless genuinely acute |
| **CAUTION** | Quality-opacity ingredients or cosmetic additives | Cautionary note only — **never described as poison** |

Rule: an ingredient enters this database only with ≥ 1 source URL. Every entry's
`why_plain` states what is known, what is debated, and what is *not* proven.

## Entries (18)

### TOXIC (6)

1. **Xylitol** — `xylitol, birch sugar, birch bark extract, e967`
   - Rapid insulin release → hypoglycemia within 30–60 min; larger doses → fatal liver failure.
   - Sources: Cornell CUVS case page; Drugs.com vet-emergency summary.
2. **Chocolate / cocoa (theobromine + caffeine)** — `chocolate, cocoa, cocoa powder, cacao, theobromine, caffeine, cocoa bean hull, cocoa bean shells`
   - Methylxanthines; dogs metabolize ~17.5 h half-life. Merck: mild signs ~20 mg/kg, cardiotoxic 40–50 mg/kg, seizures ≥ 60 mg/kg. Darker = more dangerous.
   - Sources: Merck Veterinary Manual (chocolate toxicosis).
3. **Grapes / raisins** — `grape(s), raisin(s), currant(s), sultana(s)`
   - Acute kidney injury; ASPCA toxicologists identified **tartaric acid** as the likely agent (JAVMA letter 2021; JVECC 2022). No safe dose — sensitivity is idiosyncratic.
   - Sources: Veterinary Poisons Information Service (UK); JVECC paper (Wismer et al., 2022); Spot & Tango explainer.
4. **Onion** — `onion(s), onion powder, dehydrated/dried onion`
   - Heinz-body hemolytic anemia, delayed days. Merck: clinical signs at 15–30 g/kg raw onion; concentrated forms (powder, soup mix) most common cause. Cooking does not help.
   - Sources: Merck Veterinary Manual (Allium toxicosis).
5. **Garlic** — `garlic, garlic powder, dehydrated/dried garlic`
   - Same Allium mechanism; **3–5× more toxic per gram than onion** (Merck). Dose-dependent and cumulative. No established safe threshold; trace flavor amounts are a lesser concern than concentrated doses.
   - Sources: Merck Veterinary Manual (Allium toxicosis); MDPI fatal garlic-toxicosis case report.
6. **Macadamia nuts** — `macadamia (nut/s)`
   - Dog-specific syndrome (weakness, ataxia, tremors, hyperthermia); mechanism unknown; usually self-limiting 12–48 h. Vet call advised.
   - Sources: Pet Poison Helpline; American College of Veterinary Pharmacists.

### AVOID (6) — with honest caveats

7. **BHA** — `bha, butylated hydroxyanisole, e320`
   - NTP: "reasonably anticipated to be a human carcinogen"; IARC Group 2B (rodent forestomach tumors — relevance to dogs debated). Still permitted in pet food; natural alternatives exist.
   - Sources: CSPI chemical profile; Scientific American.
8. **BHT** — `bht, butylated hydroxytoluene, e321`
   - **Weaker evidence than BHA:** EFSA 2012 re-evaluation found no genotoxicity/carcinogenicity concern at approved levels (ADI 0.25 mg/kg/day). Flagged on precaution (non-nutritive synthetic; high-dose rodent effects; FDA plans reassessment) — not as proven poison.
   - Sources: EFSA Journal 2012; EWG evaluation; Scientific American.
9. **Ethoxyquin** — `ethoxyquin, e324`
   - FDA-reviewed studies: liver pigment + elevated liver enzymes at high doses (reversible). FDA asked industry to voluntarily cut 150→75 ppm in dog food (1997); EU/Australia never approved it as a food ingredient. Harm evidence only at high doses.
   - Sources: Petfood Industry (Dzanis); JustFoodForDogs; Dogster.
10. **Propylene glycol** — `propylene glycol`
    - **Species-specific:** FDA ruled it NOT GRAS for **cats** (1996, Heinz-body anemia) — it remains GRAS for **dogs** (2-year study tolerated to ~8%). Flagged as Avoid for dogs on precaution (zero nutrition, chronic low-level exposure in semi-moist foods), not as proven dog toxin.
    - Sources: 21 CFR 589.1001 (govinfo); Petfood Industry.
11. **Menadione (vitamin K3)** — `menadione, vitamin k3/k-3, menadione sodium bisulfite/bisulphite, menadione nicotinamide bisulfite, msbc`
    - High-dose toxicity real (JAVMA review: GI/renal/RBC effects at 30–60 mg/kg in dogs — hundreds of × nutritional need; not approved for human food). But EFSA authorized it for all animal species at feed doses (2015). Flagged because toxicity is real at high doses and K1/K2 alternatives exist.
    - Sources: JAVMA 252(5) vitamin K review; EU Reg. 2015/2307; Hepper.
12. **Carrageenan** — `carrageenan, poligeenan`
    - Food-grade carrageenan is FDA-approved. The IARC Group 2B listing applies to **degraded** carrageenan (poligeenan) — a lab inflammation-inducer, not the food additive. Concern is degradation during processing/digestion + GI-inflammation signals at high doses. Contested, not settled.
    - Sources: Dog Standards (balanced review); IARC classifications; Pet Food Reviewer.

### CAUTION (6) — quality opacity, never "poison"

13. **Artificial colors** — `red 40 / allura red (e129), yellow 5 / tartrazine (e102), yellow 6 / sunset yellow (e110), blue 2 / indigotine (e132), fd&c …, artificial color(s)/colour(s)`
    - Petroleum-derived dyes, zero nutritional purpose. EFSA feed panel (2012): insufficient data to demonstrate safe *lifetime* use of Allura Red in pet food. EU requires warning labels on these dyes re: children's activity/attention. No solid evidence of dog toxicity at approved levels.
    - Sources: Food Ingredients First (EFSA FEEDAP); Bakery & Snacks (EU color rules); fellow.dog (EFSA ADI summary).
14. **Meat by-products (unspecified species)** — `meat/animal by-products, meat/animal by-product meal`
    - AAFCO: by-products "can be safely used to provide nutrition." The flag is **opacity** — unnamed species/parts, quality varies by manufacturer. Named by-products are more transparent.
    - Sources: AAFCO byproducts page; Petfood Industry.
15. **Animal digest** — `animal/poultry/chicken/beef/liver/meat/fish digest`
    - AAFCO-defined flavoring from hydrolyzed animal tissue. Not inherently unsafe; "animal" without species = unknown source/quality. Named digests are more transparent.
    - Sources: Wikipedia (AAFCO definition); Hepper.
16. **Poultry by-product meal** — `poultry/chicken/turkey by-product meal`
    - AAFCO-defined (rendered necks, feet, undeveloped eggs, viscera; no feathers); can be nutritious concentrated protein. Watch-for-quality flag — rendering quality varies by supplier.
    - Sources: Petfood Industry; AAFCO.
17. **Meat and bone meal** — broad AAFCO definition, unnamed species; quality depends on the renderer.
    - Sources: Petfood Industry; AAFCO.
18. **Animal fat (unspecified)** — fat is essential; unnamed source can hide low-quality inputs and the preservatives used. Named fats (chicken fat, salmon oil) are more transparent.
    - Sources: AAFCO; Petfood Industry.

## Scanner matching notes

- Matching is case-insensitive substring on each comma/semicolon-separated ingredient.
- False-positive guards (in `scanner.js`, not in JSON): `cocoa butter` ≠ cocoa/chocolate;
  `grape seed (extract)` and `black currant/blackcurrant` ≠ grape/raisin entry
  (blackcurrant is *Ribes nigrum*, a different fruit; grape seed extract contains no tartaric acid).
- Garlic is tiered TOXIC (escalated from a warning in scanner v1) per Merck's 3–5× potency note.
- Propylene glycol is tiered AVOID (precautionary) — no emergency language; the species-specific FDA cat-food ruling is stated in the explanation.
- BHT is tiered AVOID on precaution; its `why_plain` explicitly says the cancer evidence is weaker than BHA's.

## Deliberately omitted (commonly feared, evidence-weak)

These are **not** red flags in this database, with reasons:

- **Corn / wheat / soy as "toxins"** — grains are not toxic to dogs; the real issue is cheap filler *stacking*, which the scanner already scores separately (factor 11).
- **Named by-products** (e.g., "chicken by-products") — AAFCO-defined, nutritious; transparency is the only question.
- **"Meal" in general** (e.g., "chicken meal", "salmon meal") — named rendered meals are concentrated protein, not a quality red flag.
- **Peas / lentils / legumes as toxins** — the FDA/DCM investigation is unsettled correlation; the scanner already carries an informational note (factor 13), not a toxin flag.
- **Caramel color** — commonly feared; no meaningful dog-toxicity evidence at food levels.
- **Mixed tocopherols / vitamin E** — the natural antioxidant alternative; flagging it would be backwards.
- **Rosemary extract** — commonly feared natural preservative; no dog-toxicity evidence at food levels.
- **"Natural flavors"** — vague and non-transparent, but no evidence of harm; opacity alone doesn't make the AVOID tier.
- **Beet pulp / cellulose / fiber sources** — not toxins.
- **Erythritol** — must not be confused with xylitol; not tiered here (no dog-toxicity signal like xylitol's).
- **Carob** — chocolate-flavored but theobromine-free; safe alternative, explicitly *not* in the chocolate entry.

## Open questions for vet-nutritionist review

1. Confirm tier placement of garlic (TOXIC) vs. trace flavoring amounts.
2. Confirm propylene glycol (AVOID-precautionary) and menadione (AVOID) tiering.
3. Confirm carrageenan (AVOID-contested) wording.
4. Confirm BHT (AVOID-precautionary) vs. downgrading to CAUTION.
5. Any missing acute toxins that belong in TOXIC (e.g., macadamia is in; consider alcohol, raw bread dough — currently outside this DB's scope).
