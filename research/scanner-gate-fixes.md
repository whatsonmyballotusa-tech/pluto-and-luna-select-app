# Scanner Accuracy-Gate Fixes — 2026-09-28
Implements the 5 must-fix items from `scanner-accuracy-gate.md` §6.1–6.4 (+§5.10 AAFCO UX).

## Changes

**`app/js/scanner.js`**
1. **Grapefruit false-toxic (gate §5.1):** "grapefruit" substring-matched the `grape` alias → false TOXIC emergency. Added to the Grapes/raisins exclude list. (Edit made in `research/sync-red-flags.js` EXCLUDE map — the canonical home of JS-only guards — then regenerated the DB block via `node research/sync-red-flags.js`.)
2. **Negation-aware factor 7/8 (gate §5.2):** new `isNegated(chunk, kw)` helper. Skips matches inside "X free" ("sugar free", "artificial flavour free") and "without / no / sans / free from|of … X" clauses (single ingredient chunk, ≤60 chars, can't leak across `,`/`;`). Applied to artificial-color DB matches + `ARTIFICIAL_FLAVORS` (factor 7) and `SWEETENERS` (factor 8), on both food and treat tracks. Real positives ("chicken, sugar", "beef, red 40") still penalize; "no sugar" in one chunk doesn't excuse "corn syrup" in another.
3. **Protein aliases (gate §5.3, §5.4, §6.4):** `NAMED_PROTEINS` += `boar`, `wild boar`, and French aliases: poulet, dinde, canard, oie, bœuf/boeuf, agneau, mouton, sanglier, cerf, venaison, lapin, porc, saumon, hareng, truite, maquereau, thon, colin, lieu, kangourou, œuf/oeuf.
4. **Treat classifier (gate §5.5):** `detectProductType` regex expanded to `\b(treats?|chews?|sticks?|topper|biscuit|biscotti|jerky|snacks?|ice cream|friandises?)\b` (also fixes the old ungrouped alternation), and now also scans OPFF `categories` (threaded through `opffToInput`). "Duck & Sweet Potato Sticks" and dog ice cream now score on the treat track.
5. **AAFCO-confirmation UX (gate §5.10):** new `aafcoUserConfirmed` input flag. In `buildAnalysis`, an explicit confirmation upgrades a missing AAFCO statement to `type: complete, method: "user-confirmed"` — lifting the Caution hard-cap and adding a "confirmed by you from the package — not in the product database" source line. **Honest-limits preserved:** only explicit Yes lifts the cap; No/Unsure/silence keep it; stage stays unknown so no life-stage claims are made. `scanner.html` shows a "Does the bag say 'formulated to meet AAFCO…'?" Yes/No/Unsure prompt whenever the cap was applied (`a.aafcoCapped`); the Yes re-analysis doesn't consume an extra free scan.

**`app/scanner.html`** — confirmation prompt UI + `doAnalyze(input, freeReRun)` refactor (confirmation re-run is budget-free).

**`research/smoke-red-flags.js`** — added 5 gate-fix regression groups (grapefruit guard, negation ± controls, French/boar proteins, treat classifier ± control, AAFCO confirm lift/no-lift).

## Test results
- `node --check` clean on `scanner.js`, `smoke-red-flags.js` (scanner.html hand-verified).
- `node research/smoke-red-flags.js`: **ALL 37 CHECKS PASSED** (32 original — toxic detection unweakened — + 5 new regression groups).
- Edge probes: "no sugar, corn syrup" → sugar excused, corn syrup still hit; "free range chicken" doesn't leak negation; "Chewy Kibble" stays on the food track.

## Not fixed (out of scope / deferred)
- **White chocolate (§5.8/§6.5):** not in the assigned must-fix list; the smoke suite doesn't pin it either way. Recommend reconciling with the DB's evidence note in the vet-review batch.
- **Trace-extract emergency proportionality (§5.6):** flagged as a vet-review question in the gate — needs a nutritionist's call, not a code change.
- **Factors 9/10 never firing on OPFF lookups (§5.9):** data limitation (no moisture in OPFF nutriments), not a scoring defect.
- **87% Caution pile-up (§5.10 structural):** partially addressed by fix 5 (the cap can now be lifted by the user); "Recommended" via barcode still requires a database AAFCO source long-term.
