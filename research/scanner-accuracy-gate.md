# Scanner Accuracy Gate — 200-Label Test
**Date:** 2026-09-28 · **Methodology:** v1-draft · **Status:** ⚠️ DRAFT — pending vet-nutritionist review
**Verdict: CONDITIONAL PASS** (all three numeric bars met on the sample; must-fix defects found — see §6)

## 1. Method
- **Implementation under test:** the real `~/workspace/dog-app/app/js/scanner.js`, `require()`d as-is. No scoring rules were modified.
- **Sample:** 210 real dog food/treat products with full ingredient lists pulled from Open Pet Food Facts (`world.openpetfoodfacts.org` search API, 2026-09-28). Mix: 184 classified food / 26 treat by the scanner's own classifier; 92 English vs 118 non-English (mostly French) ingredient lists; 63 with any GA protein data.
- **Harness:** Node script ran `Scanner.analyzeProduct()` (label path) on all 210 with no pet profile, plus a 14-case synthetic guard panel (guarded ingredients, probes, true-positive controls). Network recall checks were disabled (`fetch` undefined) so the gate measures **scoring only**; `checkRecalls` then resolves instantly as "skipped". 10 s watchdog per product for hang detection.
- Raw per-product results: `accuracy-gate-evidence.json` (same directory).

## 2. Results vs the bar

| Bar | Result |
|---|---|
| Zero crashes | ✅ **0 crashes, 0 hangs** across 210 products (max 3 ms/product) |
| <2% false positives on guarded ingredients (cocoa butter, grape-seed extract, blackcurrant, named chicken by-products) | ✅ **0%** — 0/5 synthetic guard cases fired; 0/4 real products containing "chicken by-product" fired |
| No toxic verdict on a product with no actual toxic ingredient | ✅ **on the sample** — 3 toxic verdicts, all on products containing a genuine toxic-alias ingredient (see §4). ⚠️ But the synthetic probe proved a false-toxic bug exists (grapefruit, §5.1) — it just didn't appear in this sample |

## 3. Verdict distribution (n=210)

| Verdict | n | % |
|---|---|---|
| Recommended | 0 | 0% |
| Good | 12 | 5.7% |
| Caution | 183 | 87.1% |
| Avoid | 15 | 7.1% |
| Unknown / error | 0 | 0% |

Score: min 0, max 70, mean 48.1. Heavy pile-up at 40–49 (134 products).

**Structural finding:** "Recommended" is **unreachable** through the OPFF lookup path. Foods are hard-capped at Caution without an AAFCO statement (OPFF never carries one), and treats max out at 70 (base 60 + 5 kcal + 5 country < 80). Every barcode scan the app can do today returns "Caution" at best — users will learn to ignore the scanner unless the AAFCO-confirmation flow (methodology §3.1) ships with it.

## 4. Red-flag hit rates
- Products with any TOXIC/AVOID-tier flag: **7/210 (3.3%)**; English-only subset: **5/92 (5.4%)**; non-English: 2/118 (both French grape-extract hits, §5.6).
- By entry: Carrageenan 3, Grapes/raisins 2, Chocolate/cocoa 1, BHA 1. All four AVOID-tier hits were genuine (carrageenan ×3 in wet foods/ice cream; BHA in "bacon fat (preserved with bha and citric acid)").
- The 3 toxic verdicts: (1) "Baldo food for dogs" — ingredient list literally contains 39% dark chocolate coating (almost certainly a miscategorized human product in OPFF; the scanner correctly flagged the actual ingredient); (2–3) two Royal Canin FR products — "extraits de thé vert et de raisins" (see §5.6).

## 5. Ten most interesting mis-scores (reviewer judgment)

1. **Grapefruit → TOXIC "Grapes / raisins" + emergency alert (synthetic probe).** "grapefruit" substring-matches alias "grape"; the grapes entry's exclude list lacks it. Any citrus-containing product gets a false poisoning emergency. **Fix: add "grapefruit" to the exclude list.** (Did not occur in the sample — no real product contained grapefruit.)
2. **Negation phrases scored as positives — Jack hypoallergenic pâté (real, Avoid 25).** Its ingredient text ends with marketing copy: "Sugar free… without artificial colouring, artificial flavour free… Without added sugar". Factor 8 matched "sugar" (−10 "added sugars"); factor 7 matched "artificial colouring/flavour" (−10). The product advertises the *absence* of exactly what it was penalized for. **Fix: negation-aware matching** (e.g., ignore matches inside "free from/without/no X" clauses) or strip marketing sentences before scoring.
3. **"Boar" is not a named protein (same Jack pâté).** 72%-boar pâté got factor 3 −10 ("no named meat in top 3"). **Fix: add boar/wild boar to NAMED_PROTEINS.**
4. **48 non-English meat-first products wrongly hit by factor 3 (−10).** The protein list and red-flag aliases are English-only: French "poulet/canard" first ingredients score −10 "no named meat" and never earn +15. ≈23% of the sample lost up to 25 net points to language. **Fix: multilingual protein/alias lists or language-aware matching** (lower priority for US launch, but OPFF data is global).
5. **Treat misclassification → wrong track.** The treat regex misses "sticks", "ice cream", "biscotti", "friandises": Frosty Paws Vanilla (dog ice cream) and Duck & Sweet Potato Sticks were scored as *foods* — factor 3 penalized ice cream for having no meat, landing both at Avoid 35. On the treat track they'd be ~Caution. **Fix: expand treat keywords** (stick, ice cream, biscotti, friandise…).
6. **Royal Canin FR: trace grape polyphenol extract → full toxic emergency.** "Extraits… de raisins" is genuinely grape-derived (French "raisin" = grape), so the flag direction is defensible — but a trace antioxidant extract in a major brand's kibble gets "no safe dose, call poison control immediately". **Vet-review question: should trace extracts carry the same emergency language as whole grapes?**
7. **Baldo "dog food" with 39% chocolate (real).** Almost certainly a miscategorized human product in OPFF — but the scanner did exactly the right thing with garbage input: flagged the actual chocolate. Data-quality note, not a scanner bug.
8. **White chocolate → full toxic emergency (synthetic probe).** The DB's own `why_plain` says white chocolate is an insignificant methylxanthine source, yet it triggers the same emergency as dark chocolate. **Fix: exclude or downgrade "white chocolate"** to match the DB's stated evidence.
9. **Factors 9/10 (protein/fat vs AAFCO minimums) fired 0/210 times.** OPFF nutriments lack moisture, so dry-matter conversion is impossible and both factors sit out every OPFF lookup. The two most "nutritional" factors only work on manual label entry — the primary barcode path never evaluates protein/fat adequacy.
10. **The 87% Caution pile-up (§3).** Even a perfect OPFF product scores ~65–70 max. Combined with #9, the scanner's barcode path is currently a "Caution machine" — accurate per its rules, but with no upside to discover. The AAFCO-confirmation UX is not a nice-to-have; it's what makes the top two verdict bands exist.

Counter-example that the core works: "Small Dog Food Roasted Chicken, Rice & Vegetables" → Avoid 30 on genuine grounds (poultry by-product meal + animal fat + meat & bone meal opacity, Yellow 5/6, Blue 2, Red 40, corn filler-stacking). The rubric bites real low-quality food correctly.

## 6. Required fixes before launch (gate conditions)
1. Add "grapefruit" to the grapes/raisins exclude list (false toxic emergency).
2. Negation-aware ingredient matching ("sugar free", "without artificial…") — currently inverts meaning.
3. Expand treat-type keywords (sticks, ice cream, biscotti, friandises…) — wrong-track scoring.
4. Add missing named proteins (boar/wild boar at minimum).
5. Reconcile white-chocolate handling with the DB's own evidence note.
6. Vet review on §5.6 (trace-extract emergency proportionality) — already on the vet-review list.

## 7. Limitations of this gate
- OPFF is crowdsourced and global; 56% of the sample had non-English labels, and at least one product was likely miscategorized human food. The sample skews European (Pedigree, Royal Canin FR, Cesar) vs the US market.
- No AAFCO statements and almost no GA moisture data in OPFF — factors 1, 9, 10, 12 were largely untestable on this path; they need a separate label-entry test set.
- Recall checking (openFDA) was out of scope — separately known-incomplete per the methodology.
- OCR accuracy (the other half of the "200-label" requirement in the methodology) is not covered here; this gate tested scoring on clean ingredient text only.

---
*Harness: `/tmp/scan-gate/harness.js` (ephemeral). Evidence: `accuracy-gate-evidence.json`. Scoring implementation untouched.*
