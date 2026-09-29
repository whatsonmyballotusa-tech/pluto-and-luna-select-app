/* Pluto & Luna Select — Food scanner: methodology v1 (DRAFT).
 *
 * Implements ~/workspace/dog-app/research/scanner-methodology.md v1.0:
 *   - 15-factor scoring rubric, 0–100, two tracks (food vs treats)
 *   - Verdict bands: Recommended 80+ · Good 60–79 · Caution 40–59 · Avoid 0–39
 *   - Hard gates: xylitol → Avoid + toxicity alert · active recall → Avoid ·
 *     no AAFCO statement on a "food" → capped at Caution · life-stage mismatch
 *     → personalized "Not for {pet name}"
 *   - Provenance badges: "verified" (Open Pet Food Facts hit) · "label"
 *     (manual/OCR entry) · "insufficient" (never hallucinate a score)
 *   - FDA recall check via openFDA food/enforcement.json — displays
 *     "No recall records found in this database", NEVER "never recalled"
 *   - Pet-profile personalization: allergen cross-check, life-stage gating,
 *     condition notes are informational, never prescriptive
 *
 * ⚠️ DRAFT — the rubric requires vet-nutritionist review before launch.
 * methodology === "v1-draft" until a vet signs off. The UI MUST keep the
 * "methodology pending vet-nutritionist review" banner while in draft.
 *
 * INTERFACE:
 *   Scanner.analyzeProduct({ upc?, productName?, brand?, productType?,
 *                            ingredientsText?, ga?, aafcoStatement?,
 *                            calorieContent?, country? }, petProfile?)
 * Red-flag DB tiers (research/red-flag-ingredients.json, synced by
 * research/sync-red-flags.js): TOXIC → Avoid + emergency alert;
 * AVOID → Avoid-level result, no emergency language; CAUTION → note only. *     -> Promise<Analysis>
 *
 * ga = { protein, fat, fiber, moisture } — as-fed % from Guaranteed Analysis
 *
 * Analysis shape:
 *   { verdict: "recommended"|"good"|"caution"|"avoid"|"unknown",
 *     score: 0-100 | null,               // null when provenance is "insufficient"
 *     summary: string,
 *     pros: string[], cons: string[],
 *     factors: [{ n, points, text, severity, ingredient }],  // the "why" list
 *     flags: [{ level: "info"|"warn"|"danger", text }],
 *     toxicityAlert: string|null,        // urgent, e.g. xylitol
 *     personalized: string,
 *     notForPet: bool,                   // life-stage mismatch for this pet
 *     provenance: "verified"|"label"|"insufficient",
 *     recall: { checked, hits[], note },
 *     methodology: "v1-draft",
 *     sources: string[] }
 */

(function () {
  "use strict";

  /* ---------- constants ---------- */

  // AAFCO nutrient minimums, dry-matter basis (%). Spec §1.3 — values pending
  // vet-nutritionist verification against the AAFCO Official Publication.
  var AAFCO_MIN = {
    growth: { protein: 22.5, fat: 8.5, label: "growth (puppies)" },
    adult:  { protein: 18.0, fat: 5.5, label: "adult maintenance" },
    all:    { protein: 18.0, fat: 5.5, label: "all life stages" },
  };

  var NAMED_PROTEINS = [
    "chicken", "turkey", "duck", "goose", "beef", "lamb", "mutton", "venison",
    "rabbit", "pork", "salmon", "herring", "trout", "sardine", "mackerel",
    "whitefish", "pollock", "tuna", "bison", "kangaroo", "egg",
    "boar", "wild boar",
    // French label aliases (accuracy gate §5.4 — OPFF data is global, ~56% of
    // the gate sample had non-English labels). Substring-matched like the rest.
    "poulet", "dinde", "canard", "oie", "bœuf", "boeuf", "agneau", "mouton",
    "sanglier", "cerf", "venaison", "lapin", "porc", "saumon", "hareng",
    "truite", "maquereau", "thon", "colin", "lieu", "kangourou",
    "œuf", "oeuf",
  ];

  /* RED-FLAG-DB:BEGIN — generated from research/red-flag-ingredients.json v1.0 by research/sync-red-flags.js. Do not hand-edit. */
  var RED_FLAG_DB = [
    {"name":"Xylitol","names":["xylitol","birch sugar","birch bark extract","e967"],"tier":"TOXIC","why_plain":"Xylitol (sold as birch sugar, E967) triggers a rapid, massive insulin release in dogs. Blood sugar can crash within 30-60 minutes, and larger doses can cause fatal liver failure. Even small amounts are an emergency - call your vet or ASPCA Poison Control (888-426-4435) immediately.","sources":["https://www.cuvs.org/blog/lilas_story_xylitol_toxicity","https://www.drugs.com/medical-answers/xylitol-toxic-dogs-3572553/"]},
    {"name":"Chocolate / cocoa","names":["chocolate","cocoa","cocoa powder","cacao","theobromine","caffeine","cocoa bean hull","cocoa bean shells"],"tier":"TOXIC","why_plain":"Chocolate and cocoa contain theobromine and caffeine (methylxanthines), which dogs metabolize far more slowly than humans. Per the Merck Veterinary Manual, mild signs appear around 20 mg/kg, heart effects at 40-50 mg/kg, seizures at 60+ mg/kg - darker chocolate is far more dangerous. White chocolate is an insignificant methylxanthine source, but its high fat content still makes it a poor idea.","sources":["https://www.merckvetmanual.com/toxicology/food-hazards/chocolate-toxicosis-in-animals?autoredirectid=14433?redirectid=98?ruleredirectid=30"],"exclude":["cocoa butter","grapefruit"]},
    {"name":"Grapes / raisins","names":["grape","grapes","raisin","raisins","currant","currants","sultana","sultanas"],"tier":"TOXIC","why_plain":"Grapes, raisins, currants, and sultanas can cause acute kidney injury in dogs. ASPCA toxicologists identified tartaric acid as the likely culprit (JAVMA letter 2021; JVECC 2022) - dogs appear uniquely sensitive to it. Sensitivity is unpredictable and there is no established safe dose, so any ingestion is treated as an emergency.","sources":["https://vpisglobal.com/2021/05/05/cause-of-grape-induced-kidney-injury-in-dogs/","https://onlinelibrary.wiley.com/doi/10.1111/vec.13234","https://www.spotandtango.com/blog/can-dogs-eat-grapes"],"exclude":["grape seed","grapefruit","black currant","blackcurrant"]},
    {"name":"Onion","names":["onion","onions","onion powder","dehydrated onion","dried onion"],"tier":"TOXIC","why_plain":"All onions - raw, cooked, powdered, or dehydrated - damage dogs' red blood cells, causing Heinz-body hemolytic anemia that appears days after eating. The Merck Veterinary Manual reports clinical signs in dogs at 15-30 g/kg of raw onion; concentrated forms (powder, soup mix) are the most common cause. Cooking does not make onion safe.","sources":["https://www.merckvetmanual.com/toxicology/food-hazards/garlic-and-onion-allium-spp-toxicosis-in-animals?autoredirectid=25229&query=garlic%20for%20dogs"]},
    {"name":"Garlic","names":["garlic","garlic powder","dehydrated garlic","dried garlic"],"tier":"TOXIC","why_plain":"Garlic is in the same Allium family as onion and is 3-5 times more toxic per gram, per the Merck Veterinary Manual. It causes the same delayed red-blood-cell damage; risk is dose-dependent and cumulative over days. Small flavoring amounts are a lesser concern than concentrated doses, but there is no established safe threshold - treat any meaningful amount as a vet call.","sources":["https://www.merckvetmanual.com/toxicology/food-hazards/garlic-and-onion-allium-spp-toxicosis-in-animals?autoredirectid=25229&query=garlic%20for%20dogs","https://www.mdpi.com/2076-2615/16/11/1712"]},
    {"name":"Macadamia nuts","names":["macadamia","macadamia nut","macadamia nuts"],"tier":"TOXIC","why_plain":"Macadamia nuts cause a dog-specific syndrome: vomiting, weakness, hind-leg wobbliness, tremors, and fever, usually within 12 hours. The toxic compound is still unknown. Most dogs recover within 12-48 hours with vet care and deaths are rare - but any ingestion warrants a call to your vet or the Pet Poison Helpline.","sources":["https://www.petpoisonhelpline.com/pet-tips/are-macadamia-nuts-toxic-to-dogs/","https://vetmeds.org/pet-poison-control-list/macadamia-nuts/"]},
    {"name":"BHA","names":["bha","butylated hydroxyanisole","e320"],"tier":"AVOID","why_plain":"BHA is a synthetic antioxidant preservative. The US National Toxicology Program lists it as 'reasonably anticipated to be a human carcinogen' and IARC classifies it Group 2B (possibly carcinogenic), based on forestomach tumors in rodents - though regulators debate whether that applies to dogs or humans. It is still permitted in pet food; we flag it because the concern is real and natural alternatives (mixed tocopherols) exist.","sources":["https://www.cspi.org/chemical-cuisine/butylated-hydroxyanisole-bha","https://www.scientificamerican.com/article/bha-and-bht-a-case-for-fresh/"]},
    {"name":"BHT","names":["bht","butylated hydroxytoluene","e321"],"tier":"AVOID","why_plain":"BHT is a synthetic antioxidant preservative. Unlike BHA, EFSA's 2012 re-evaluation concluded BHT is not a genotoxicity or carcinogenicity concern at approved levels (ADI 0.25 mg/kg/day) - the evidence here is weaker. We still flag it as Avoid: it is a non-nutritive synthetic additive, earlier rodent studies showed thyroid/reproduction/blood effects at high doses, and the FDA has announced plans to reassess it. Honest bottom line: precaution, not proven poison.","sources":["https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2012.2588","http://www.ewg.org/research/ewg-evaluation-food-chemicals-bht","https://www.scientificamerican.com/article/bha-and-bht-a-case-for-fresh/"]},
    {"name":"Ethoxyquin","names":["ethoxyquin","e324"],"tier":"AVOID","why_plain":"Ethoxyquin is a synthetic antioxidant used to preserve fats, often arriving undeclared via fish meal. In FDA-reviewed feeding studies, high doses caused liver pigment buildup and elevated liver enzymes in dogs - effects that reversed when it was removed. In 1997 the FDA asked industry to voluntarily cut levels in dog food from 150 to 75 ppm; the EU and Australia did not approve it as a food ingredient. Evidence of harm exists only at high doses, but the regulatory divergence is real.","sources":["https://www.petfoodindustry.com/safety-quality/pet-food-regulations/article/15449902/petfood-industry-petfood-insights-ethoxyquin-redux","https://blog.justfoodfordogs.com/ethoxyquin-in-dog-food.html?srsltid=AfmBOor0Zx0PduWlSx-LqBW8bqv1nKUHoQ_YTayjiGemN0hgjnso7fsD","https://www.dogster.com/dog-nutrition/ethoxyquin-in-dog-food"]},
    {"name":"Propylene glycol","names":["propylene glycol"],"tier":"AVOID","why_plain":"Propylene glycol is a humectant that keeps semi-moist foods soft. Here is the species-specific truth: in 1996 the FDA ruled it is NOT generally recognized as safe for CATS (it causes Heinz-body red-cell damage in cats) - but it remains GRAS for dogs, and a two-year dog study found it well tolerated up to ~8% of diet. We flag it as Avoid for dogs as a precaution: it has zero nutritional value, and dogs eating semi-moist foods get chronic low-level exposure. Not an emergency - a quality choice.","sources":["https://www.govinfo.gov/content/pkg/CFR-2023-title21-vol6/pdf/CFR-2023-title21-vol6-sec589-1001.pdf","https://www.petfoodindustry.com/nutrition/pet-food-ingredients/article/15459644/propylene-glycol-when-where-and-how-should-it-be-used"]},
    {"name":"Menadione (vitamin K3)","names":["menadione","vitamin k3","vitamin k-3","menadione sodium bisulfite","menadione sodium bisulphite","menadione nicotinamide bisulfite","msbc"],"tier":"AVOID","why_plain":"Menadione is a cheap synthetic vitamin K supplement. The debate: high doses are genuinely toxic - a JAVMA review notes vomiting and red-cell damage in dogs at 30-60 mg/kg (hundreds of times the nutritional need), and it is not approved for human food. But EFSA authorized it as a feed additive for all animal species in 2015, finding no adverse effects at regulated feed doses. We flag it as Avoid because the toxicity is real at high doses and natural K1/K2 alternatives exist - not because normal label levels are proven dangerous.","sources":["https://avmajournals.avma.org/view/journals/javma/252/5/javma.252.5.537.xml","https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32015R2307","https://articles.hepper.com/menadione-in-dog-food/"]},
    {"name":"Carrageenan","names":["carrageenan","poligeenan"],"tier":"AVOID","why_plain":"Carrageenan is a seaweed-derived thickener common in wet/loaf foods. The honest debate: food-grade carrageenan is FDA-approved, and the IARC Group 2B carcinogen listing applies specifically to DEGRADED carrageenan (poligeenan) - a lab chemical used to induce inflammation in animal studies, not the food additive. The concern is whether food-grade carrageenan can degrade toward poligeenan during processing or digestion, and some studies link it to GI inflammation at high doses. Several premium brands voluntarily avoid it. We flag it as Avoid - contested, not settled.","sources":["https://dogstandards.ca/blogs/what-the-dog/is-carrageenan-safe-for-dogs","https://b5d7ac.staticwbm.com/20131214163742/http://monographs.iarc.fr/ENG/Classification/ClassificationsGroupOrder.pdf","https://petfoodreviewer.com/carrageenan-in-dog-food/"]},
    {"name":"Artificial colors","names":["red 40","red no. 40","red #40","fd&c red no. 40","allura red","allura red ac","e129","yellow 5","yellow no. 5","yellow #5","tartrazine","e102","fd&c yellow no. 5","yellow 6","yellow no. 6","yellow #6","sunset yellow","e110","fd&c yellow no. 6","blue 2","blue no. 2","blue #2","indigotine","e132","fd&c blue no. 2","artificial color","artificial colors","artificial colour","artificial colours","artificial coloring","artificial food color","fd&c"],"tier":"CAUTION","why_plain":"Artificial colors (Red 40, Yellow 5/6, Blue 2) are petroleum-derived dyes with zero nutritional purpose - they color food for the buyer, not the dog. EFSA's feed panel concluded in 2012 there were insufficient data to demonstrate safe lifetime use of Allura Red in pet food; the EU requires a warning label on foods with these dyes about possible effects on children's activity and attention. There is no solid evidence they poison dogs at approved levels - this is a caution about pointless additives, not a toxin alert.","sources":["https://www.foodingredientsfirst.com/news/efsa-recommends-new-tests-to-reduce-allura-red-uncertainties.html","https://www.bakeryandsnacks.com/Article/2026/07/20/how-the-eu-regulates-food-colours/","https://www.fellow.dog/ingredient/allura-red-ac"]},
    {"name":"Meat by-products (unspecified)","names":["meat by-products","meat by-product","meat byproducts","meat byproduct","meat by-product meal","meat byproduct meal","animal by-products","animal by-product","animal byproducts","animal by-product meal"],"tier":"CAUTION","why_plain":"By-products are not poison: AAFCO states they 'can be safely used to provide nutrition.' The caution is about opacity - 'meat by-products' doesn't name the species or parts, so quality varies by manufacturer and can't be judged from the label. Named by-products (e.g., 'chicken by-products') are more transparent. This is a quality flag, not a toxicity flag.","sources":["https://www.aafco.org/consumers/understanding-pet-food/byproducts/","https://www.petfoodindustry.com/pet-food-market/blog/15467340/not-all-meat-meals-in-pet-food-are-created-equal"]},
    {"name":"Animal digest","names":["animal digest","poultry digest","chicken digest","beef digest","liver digest","meat digest","fish digest"],"tier":"CAUTION","why_plain":"Animal digest is an AAFCO-defined flavoring made by hydrolyzing animal tissue - basically pre-digested protein sprayed on kibble for taste. It is not inherently unsafe, but 'animal' without a species name means you can't know the source or quality. Named digests (e.g., 'chicken digest') are more transparent. Quality flag, not poison.","sources":["https://en.wikipedia.org/wiki/Animal_digest","https://articles.hepper.com/what-is-animal-digest-in-dog-food/"]},
    {"name":"Poultry by-product meal","names":["poultry by-product meal","poultry byproduct meal","poultry by-products","poultry byproduct","poultry by-products meal","chicken by-product meal","turkey by-product meal"],"tier":"CAUTION","why_plain":"Poultry by-product meal is AAFCO-defined (rendered necks, feet, undeveloped eggs, viscera - no feathers) and can be a nutritious, concentrated protein. The caution: it is still a by-product, and rendering quality varies by supplier; some manufacturers use it to cut costs. Named species is better than unnamed - this is a watch-for-quality flag, not a toxin.","sources":["https://www.petfoodindustry.com/pet-food-market/blog/15467340/not-all-meat-meals-in-pet-food-are-created-equal","https://www.aafco.org/consumers/understanding-pet-food/byproducts/"]},
    {"name":"Meat and bone meal","names":["meat and bone meal"],"tier":"CAUTION","why_plain":"An AAFCO-defined rendered product from mammal tissues (excluding hair, hoof, horn, hide, stomach contents). Like other rendered meals it can be nutritious, but the definition is broad, the species unnamed, and quality depends entirely on the renderer. Quality-opacity flag.","sources":["https://www.petfoodindustry.com/pet-food-market/blog/15467340/not-all-meat-meals-in-pet-food-are-created-equal","https://www.aafco.org/consumers/understanding-pet-food/byproducts/"]},
    {"name":"Animal fat (unspecified)","names":["animal fat"],"tier":"CAUTION","why_plain":"Rendered fat of unnamed animal origin, usually preserved with antioxidants. Fat itself is essential for dogs; the caution is that the unnamed source can hide lower-quality inputs and the preservatives used. Named fats (chicken fat, salmon oil) are more transparent.","sources":["https://www.aafco.org/consumers/understanding-pet-food/byproducts/","https://www.petfoodindustry.com/pet-food-market/blog/15467340/not-all-meat-meals-in-pet-food-are-created-equal"]}
  ];
  /* RED-FLAG-DB:END */

  var ARTIFICIAL_FLAVORS = ["artificial flavor", "artificial flavour"];
  var SWEETENERS = ["corn syrup", "sugar", "sorbitol", "sucrose", "dextrose",
    "fructose", "cane sugar", "molasses"];
  var CHEAP_FILLERS = ["corn", "wheat", "soy", "soybean", "sorghum"];
  var LEGUMES = ["pea", "peas", "lentil", "lentils", "chickpea", "chickpeas",
    "legume", "legumes", "bean", "beans"];

  /* ---------- canned demo product (A1) ----------
   * The demo button routes through this synthetic ingredient list so the demo
   * always resolves to a full, successful analysis instead of the
   * name-only path that can only return "insufficient data". Deliberately
   * exercises all three red-flag tiers:
   *   OK tier:      named protein first (chicken), AAFCO statement, GA, country
   *   CAUTION tier: animal fat (unspecified), animal digest, Red 40
   *   AVOID tier:   BHA (evidence-calibrated note, no emergency language)
   * Demo scans are quota-free — the caller skips recordScan() for them.
   * This is a synthetic example, never a real product recommendation. */
  var DEMO_PRODUCT = {
    productName: "Demo Kibble — sample recipe",
    brand: "Demo Dog Food Co.",
    productType: "food",
    ingredientsText: "Chicken, chicken meal, brown rice, oatmeal, animal fat, dried beet pulp, flaxseed, animal digest, Red 40, BHA",
    ga: { protein: 26, fat: 14, fiber: 4, moisture: 10 },
    aafcoStatement: "Formulated to meet the nutritional levels established by the AAFCO Dog Food Nutrient Profiles for adult maintenance.",
    calorieContent: "3,650 kcal/kg (calculated)",
    country: "USA",
  };

  /* ---------- red-flag ingredient database ---------- */
  // Canonical data: research/red-flag-ingredients.json (18 entries, v1.0).
  // RED_FLAG_DB is generated from it by research/sync-red-flags.js — do not hand-edit.
  // Tiers: TOXIC → immediate Avoid + emergency alert · AVOID → Avoid-level
  // result, no emergency language · CAUTION → cautionary note, never "poison".

  var TOXIC_ALERTS = {
    "Xylitol": "🚨 XYLITOL EMERGENCY: this product contains xylitol (birch sugar), which is extremely toxic to dogs — even small amounts can be fatal. If your dog ate this, contact your veterinarian or ASPCA Poison Control (888-426-4435) immediately.",
    "Chocolate / cocoa": "🚨 CHOCOLATE/COCOA: contains theobromine + caffeine, toxic to dogs (darker = more dangerous). If your dog ate a meaningful amount, contact your vet or ASPCA Poison Control (888-426-4435).",
    "Grapes / raisins": "🚨 GRAPE/RAISIN EMERGENCY: grapes, raisins, currants, and sultanas can cause sudden kidney failure in dogs — there is no safe dose. If your dog ate any, contact your vet or ASPCA Poison Control (888-426-4435) immediately.",
    "Onion": "🧅 ONION: damages dogs' red blood cells — all forms count (raw, cooked, powdered), and signs appear days later. Contact your vet if your dog ate a meaningful amount.",
    "Garlic": "🧄 GARLIC: 3–5× more toxic per gram than onion; damages red blood cells with delayed signs. Contact your vet if your dog ate a concentrated amount.",
    "Macadamia nuts": "⚠️ MACADAMIA NUTS: toxic to dogs — weakness, tremors, and fever usually within 12 hours. Contact your vet or the Pet Poison Helpline for guidance."
  };

  // Case-insensitive substring match of each ingredient against every alias.
  // `exclude` guards known false positives (cocoa butter, grape seed, blackcurrant).
  function matchRedFlags(ings) {
    var out = [];
    var seen = {};
    ings.forEach(function (ing) {
      RED_FLAG_DB.forEach(function (entry) {
        var excluded = (entry.exclude || []).some(function (x) { return ing.indexOf(x) !== -1; });
        if (excluded) return;
        var hit = null;
        entry.names.forEach(function (n) { if (!hit && ing.indexOf(n) !== -1) hit = n; });
        if (hit) {
          var key = entry.name + "|" + ing;
          if (!seen[key]) {
            seen[key] = true;
            out.push({ entry: entry, alias: hit, ingredient: ing.trim() });
          }
        }
      });
    });
    return out;
  }

  function scanRedFlags(ings) {
    var matches = matchRedFlags(ings);
    var out = { toxic: [], avoidTier: [], caution: [], flags: [], alert: null, avoid: false };
    matches.forEach(function (m) {
      var bucket = m.entry.tier === "TOXIC" ? out.toxic
        : m.entry.tier === "AVOID" ? out.avoidTier : out.caution;
      var dup = bucket.some(function (b) { return b.entry.name === m.entry.name; });
      if (!dup) bucket.push(m);
    });
    out.toxic.forEach(function (m) {
      var alert = TOXIC_ALERTS[m.entry.name] ||
        ("Contains " + m.entry.name + " — toxic to dogs. Contact your vet.");
      out.flags.push({ level: "danger", text: alert });
      if (!out.alert) out.alert = alert;
    });
    // `avoid` is true only for TOXIC hits (immediate Avoid). AVOID-tier hits
    // cap the score at 39 in buildAnalysis instead — no emergency language.
    out.avoid = out.toxic.length > 0;
    return out;
  }

  // Pet-condition → ingredient keyword map for allergen cross-checks.
  var ALLERGEN_MAP = {
    chicken: ["chicken"],
    beef: ["beef"],
    dairy: ["milk", "whey", "cheese", "dairy", "yogurt", "lactose"],
    wheat: ["wheat"],
    soy: ["soy", "soybean"],
    corn: ["corn"],
    egg: ["egg"],
  };
  var COMMON_ALLERGENS = ["chicken", "beef", "dairy", "wheat", "soy", "corn", "egg"];

  var CONDITION_NOTES = {
    "diabetes": "Lower-sugar, complex-carb foods are often discussed with vets for diabetic dogs — ask yours what's right.",
    "pancreatitis history": "Lower-fat foods are often discussed with vets for pancreatitis-prone dogs — ask yours.",
    "kidney disease": "Phosphorus and protein levels matter for kidney disease, and neither appears on a standard label — ask your vet.",
    "overweight": "Calorie content is the number to watch for weight management — compare kcal across options with your vet.",
    "sensitive stomach": "Transition any new food gradually over 7–10 days; sudden switches upset sensitive stomachs.",
  };

  /* ---------- small helpers ---------- */

  function norm(s) { return String(s || "").toLowerCase(); }

  function splitIngredients(text) {
    return norm(text).split(/[;,]/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function ingHas(ings, kw) {
    return ings.some(function (i) { return i.indexOf(kw) !== -1; });
  }

  function escReg(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Negation-aware matching. Marketing copy pasted into ingredient text
  // ("sugar free", "without artificial colouring", "no added sugar", "sans
  // colorants") describes the ABSENCE of an ingredient — scoring it as a
  // positive inverts its meaning (accuracy gate §5.2). Returns true when the
  // keyword occurs inside a negation clause within one ingredient chunk.
  // Chunks are already split on , ; so the negator can't leak across items.
  function isNegated(chunk, kw) {
    var t = norm(chunk);
    var k = escReg(norm(kw).trim());
    if (!k) return false;
    // "X free" — sugar free, artificial flavour free
    if (new RegExp("\\b" + k + "\\s+free\\b").test(t)) return true;
    // negator … X within one clause — without / no / sans / free from|of + X
    if (new RegExp("\\b(free\\s+from|free\\s+of|without|no|sans)\\b[^,;:.]{0,60}\\b" + k).test(t)) return true;
    return false;
  }

  function firstIsNamedProtein(ings) {
    if (!ings.length) return null;
    var first = ings[0];
    var named = NAMED_PROTEINS.find(function (p) { return first.indexOf(p) !== -1; });
    if (named) return named;
    return null;
  }

  function petLifeStage(pet) {
    if (!pet) return null;
    if (pet.ageYears != null && pet.ageYears < 1) return "growth";
    var conds = ((pet.conditions || []).join(" ") + " " + (pet.dietaryNeeds || []).join(" ")).toLowerCase();
    if (conds.indexOf("puppy") !== -1) return "growth";
    if (conds.indexOf("senior") !== -1) return "senior";
    return "adult";
  }

  // Parse the AAFCO adequacy statement. Returns
  // { type: "complete"|"supplemental"|"none", method: "formulation"|"trial"|null,
  //   stage: "growth"|"adult"|"all"|"repro"|null, text }
  function parseAafco(text) {
    var t = norm(text);
    if (!t) return { type: "none", method: null, stage: null, text: "" };
    var out = { type: "none", method: null, stage: null, text: String(text).trim() };
    if (t.indexOf("intermittent or supplemental feeding only") !== -1) {
      out.type = "supplemental";
      return out;
    }
    if (t.indexOf("aafco") !== -1 &&
        (t.indexOf("formulated to meet") !== -1 || t.indexOf("complete and balanced") !== -1)) {
      out.type = "complete";
      if (t.indexOf("feeding tests using aafco procedures") !== -1) out.method = "trial";
      else out.method = "formulation";
      if (t.indexOf("all life stages") !== -1) out.stage = "all";
      else if (t.indexOf("growth") !== -1) out.stage = "growth";
      else if (t.indexOf("adult maintenance") !== -1) out.stage = "adult";
      else if (t.indexOf("gestation") !== -1 || t.indexOf("lactation") !== -1 || t.indexOf("reproduction") !== -1) out.stage = "repro";
    }
    return out;
  }

  function stageMatches(productStage, petStage) {
    if (!productStage || !petStage) return null; // unknown
    if (productStage === "all") return true;
    if (petStage === "senior") return productStage === "adult" || productStage === "all";
    return productStage === petStage || (petStage === "adult" && productStage === "repro");
  }

  function detectProductType(input, aafco) {
    if (input.productType === "food" || input.productType === "treat") return input.productType;
    // Product-name / category hints: treats are often named by format
    // ("sticks", "ice cream", "biscotti") rather than carrying an AAFCO
    // supplemental statement (accuracy gate §5.5).
    var t = norm((input.productName || "") + " " + (input.aafcoStatement || "") + " " + (input.categories || ""));
    if (/\b(treats?|chews?|sticks?|topper|biscuit|biscotti|jerky|snacks?|ice cream|friandises?)\b/.test(t)) return "treat";
    if (aafco.type === "supplemental") return "treat";
    return "food";
  }

  /* ---------- scoring ---------- */

  function factor(n, points, text, severity, ingredient) {
    return { n: n, points: points, text: text, severity: severity || (points > 0 ? "good" : points < 0 ? "warn" : "info"), ingredient: ingredient || null };
  }

  function scoreFood(p, pet, ings, aafco, rf) {
    var factors = [];
    var petStage = petLifeStage(pet);
    var stage = aafco.stage || "adult"; // default comparison stage
    var min = AAFCO_MIN[stage] || AAFCO_MIN.adult;

    // 1 — AAFCO adequacy statement
    if (aafco.type === "complete") {
      var match = stageMatches(aafco.stage, petStage);
      var methodNote = aafco.method === "trial" ? "by AAFCO feeding trial (stronger evidence)"
        : aafco.method === "user-confirmed" ? "— you confirmed this from the bag; it isn't in our product database"
        : "by formulation";
      if (pet && petStage && match === false) {
        factors.push(factor(1, 0, "Carries an AAFCO complete-and-balanced statement (" + methodNote + "), but it is formulated for a different life stage than this pet. See the personal note below.", "warn", p.aafcoStatement));
      } else {
        factors.push(factor(1, 10, "Meets AAFCO standards for " + (aafco.stage === "all" ? "all life stages" : min.label) + " — " + methodNote + ".", "good", p.aafcoStatement));
      }
    } else {
      factors.push(factor(1, 0, "No AAFCO complete-and-balanced statement found — this product cannot be verified as a complete diet.", "warn", null));
    }

    // 2/3 — named protein first / none in top 3
    var first = firstIsNamedProtein(ings);
    if (first) {
      factors.push(factor(2, 15, "Real " + first + " is the #1 ingredient — ingredients are listed by weight.", "good", ings[0]));
    } else if (ings.length >= 3) {
      var top3 = ings.slice(0, 3).join(" | ");
      var anyProtein = ings.slice(0, 3).some(function (i) {
        return NAMED_PROTEINS.some(function (pr) { return i.indexOf(pr) !== -1; });
      });
      if (!anyProtein) {
        factors.push(factor(3, -10, "No named meat in the top 3 ingredients — most of the protein may come from plants.", "warn", top3));
      }
    }

    // 4/5 — quality-opacity ingredients (red-flag DB, CAUTION tier; colors → factor 7)
    var opacityHits = rf.caution.filter(function (m) { return m.entry.name !== "Artificial colors"; });
    if (opacityHits.length) {
      var onames = opacityHits.map(function (m) { return m.entry.name; }).join("; ");
      factors.push(factor(4, -10, "Quality-opacity ingredient(s): " + onames + " — source/quality can't be judged from the label. A quality flag, never a poison claim.", "warn", opacityHits[0].ingredient));
    } else {
      var namedBp = ings.find(function (i) { return /[a-z]+\s+by-?products?\s+meal/.test(i); });
      if (namedBp) {
        factors.push(factor(5, 0, "Contains " + namedBp.trim() + ". AAFCO defines these as nutritious organ/meat parts, but quality varies by manufacturer — flagged for transparency, not penalized.", "info", namedBp.trim()));
      }
    }

    // 6 — AVOID-tier red-flag ingredients (evidence-calibrated; see flags for the why)
    if (rf.avoidTier.length) {
      var anames = rf.avoidTier.map(function (m) { return m.entry.name; });
      factors.push(factor(6, -20, anames.join(", ") + " — flagged Avoid. The evidence for each is explained in the notes below; debates and limits are stated honestly.", "danger", rf.avoidTier[0].ingredient));
    }

    // 7 — artificial colors (CAUTION tier) / flavors — negation-aware: a label
    // that says "without artificial colouring" must not be penalized for it.
    var colorHits = rf.caution.filter(function (m) {
      return m.entry.name === "Artificial colors" && !isNegated(m.ingredient, m.alias);
    });
    var col = colorHits.map(function (m) { return m.ingredient; });
    ARTIFICIAL_FLAVORS.forEach(function (k) {
      var hit = ings.find(function (i) { return i.indexOf(k) !== -1 && !isNegated(i, k); });
      if (hit && col.indexOf(k) === -1) col.push(k);
    });
    if (col.length) {
      factors.push(factor(7, -10, "Artificial colors/flavors (" + col.join(", ") + ") are cosmetic — for you, not your dog.", "warn", col[0]));
    }

    // 8 — added sweeteners — negation-aware ("sugar free" is not added sugar)
    var sw = [];
    SWEETENERS.forEach(function (k) {
      var hit = ings.find(function (i) { return i.indexOf(k) !== -1 && !isNegated(i, k); });
      if (hit && sw.indexOf(k) === -1) sw.push(k);
    });
    if (sw.length) {
      factors.push(factor(8, -10, "Added sugars (" + sw.join(", ") + ") add calories without nutrition and harm dental health.", "warn", sw[0]));
    }

    // 9/10 — protein & fat vs AAFCO minimums (dry-matter adjusted)
    var ga = p.ga || {};
    if (ga.protein != null && ga.moisture != null) {
      var dmProtein = ga.protein / (100 - ga.moisture) * 100;
      if (dmProtein >= min.protein) {
        factors.push(factor(9, 10, "Protein ~" + dmProtein.toFixed(1) + "% (dry-matter) meets the AAFCO minimum of " + min.protein + "% for " + min.label + ".", "good", "crude protein (min) " + ga.protein + "%"));
      } else {
        factors.push(factor(9, -15, "Protein ~" + dmProtein.toFixed(1) + "% (dry-matter) falls short of the AAFCO minimum of " + min.protein + "% for " + min.label + ".", "danger", "crude protein (min) " + ga.protein + "%"));
      }
    } else if (ga.protein != null) {
      factors.push(factor(9, 0, "Protein is listed (" + ga.protein + "% as-fed) but moisture isn't, so dry-matter comparison is unreliable — not scored.", "info", "crude protein (min) " + ga.protein + "%"));
    }
    if (ga.fat != null && ga.moisture != null) {
      var dmFat = ga.fat / (100 - ga.moisture) * 100;
      if (dmFat >= min.fat) {
        factors.push(factor(10, 5, "Fat ~" + dmFat.toFixed(1) + "% (dry-matter) meets the AAFCO minimum of " + min.fat + "% for " + min.label + ".", "good", "crude fat (min) " + ga.fat + "%"));
      } else {
        factors.push(factor(10, 0, "Fat ~" + dmFat.toFixed(1) + "% (dry-matter) is below the AAFCO minimum of " + min.fat + "% for " + min.label + " — discuss with your vet.", "warn", "crude fat (min) " + ga.fat + "%"));
      }
    }

    // 11 — cheap filler stacking in top 5
    var top5 = ings.slice(0, 5);
    var fillerHits = [];
    top5.forEach(function (i) {
      CHEAP_FILLERS.forEach(function (f) { if (i.indexOf(f) !== -1) fillerHits.push(f + " (“" + i.trim() + "”)"); });
    });
    if (fillerHits.length >= 2) {
      factors.push(factor(11, -5, "Cheap fillers appear " + fillerHits.length + "× in the top 5 (" + fillerHits.slice(0, 3).join(", ") + ") — often used to bulk up protein numbers cheaply. Grains themselves aren't bad; stacking is the issue.", "warn", fillerHits[0]));
    }

    // 12 — calorie content stated
    if (p.calorieContent) {
      factors.push(factor(12, 5, "Calorie content is listed (" + p.calorieContent + "), so portions can be measured — many bags omit it.", "good", p.calorieContent));
    }

    // 13 — grain-free + legumes (FDA/DCM note)
    var nameAndIng = norm(p.productName || "") + " " + ings.join(" ");
    var grainFree = /grain[-\s]?free/.test(nameAndIng);
    var legumeHits = [];
    ings.slice(0, 10).forEach(function (i) {
      LEGUMES.forEach(function (l) { if (i.indexOf(l) !== -1 && legumeHits.indexOf(l) === -1) legumeHits.push(l); });
    });
    if (grainFree && legumeHits.length >= 2) {
      factors.push(factor(13, -5, "Grain-free and heavy on " + legumeHits.slice(0, 3).join("/") + ". The FDA investigated a link between such diets and heart disease (DCM) in dogs — the science is unsettled; ask your vet.", "warn", legumeHits[0]));
    }

    // 14 — country disclosed
    if (p.country) {
      factors.push(factor(14, 5, "Made in " + p.country + " — traceability matters when recalls happen.", "good", p.country));
    }

    return { factors: factors, base: 50 };
  }

  function scoreTreats(p, pet, ings, aafco, rf) {
    var factors = [];
    if (aafco.type === "supplemental") {
      factors.push(factor(1, 5, "Labeled for intermittent/supplemental feeding — the correct designation for treats.", "good", p.aafcoStatement));
    } else if (aafco.type === "complete") {
      factors.push(factor(1, 0, "Marketed as a treat but carries a complete-diet claim — treats should be ≤10% of daily calories regardless. Ask your vet.", "warn", p.aafcoStatement));
    }
    if (rf.avoidTier.length) {
      var anames = rf.avoidTier.map(function (m) { return m.entry.name; });
      factors.push(factor(6, -20, anames.join(", ") + " — flagged Avoid. See the notes below for the evidence.", "danger", rf.avoidTier[0].ingredient));
    }
    var colorHitsT = rf.caution.filter(function (m) {
      return m.entry.name === "Artificial colors" && !isNegated(m.ingredient, m.alias);
    });
    var colT = colorHitsT.map(function (m) { return m.ingredient; });
    ARTIFICIAL_FLAVORS.forEach(function (k) {
      var hitT = ings.some(function (i) { return i.indexOf(k) !== -1 && !isNegated(i, k); });
      if (hitT && colT.indexOf(k) === -1) colT.push(k);
    });
    if (colT.length) factors.push(factor(7, -10, "Artificial colors/flavors (" + colT.join(", ") + ") are cosmetic — for you, not your dog.", "warn", colT[0]));
    var sw = [];
    SWEETENERS.forEach(function (k) {
      if (sw.indexOf(k) === -1 && ings.some(function (i) { return i.indexOf(k) !== -1 && !isNegated(i, k); })) sw.push(k);
    });
    if (sw.length) factors.push(factor(8, -10, "Added sugars (" + sw.join(", ") + ") add calories without nutrition and harm dental health.", "warn", sw[0]));
    if (p.calorieContent) factors.push(factor(12, 5, "Calories per treat listed (" + p.calorieContent + ") — easy to budget the 10% treat rule.", "good", p.calorieContent));
    if (p.country) factors.push(factor(14, 5, "Made in " + p.country + " — traceability matters when recalls happen.", "good", p.country));
    return { factors: factors, base: 60 };
  }

  /* ---------- personalization ---------- */

  function personalize(pet, ings, aafco, productType) {
    var notes = [];
    var notForPet = false;
    if (!pet) {
      return { text: "Add a pet profile for personalized analysis based on their age, allergies, and health conditions.", notForPet: false };
    }
    var name = pet.name || "your dog";
    var profileText = ((pet.conditions || []).join(" ") + " " + (pet.dietaryNeeds || []).join(" ") + " " + (pet.notes || "")).toLowerCase();

    // Allergen cross-check
    var matchedAllergens = [];
    Object.keys(ALLERGEN_MAP).forEach(function (a) {
      var mentioned = profileText.indexOf(a) !== -1;
      if (!mentioned) return;
      var present = ALLERGEN_MAP[a].filter(function (k) { return ingHas(ings, k); });
      if (present.length) matchedAllergens.push({ allergen: a, ingredient: present[0] });
    });
    // Generic "Allergies" condition → check common allergens
    if (profileText.indexOf("allerg") !== -1 && !matchedAllergens.length) {
      COMMON_ALLERGENS.forEach(function (a) {
        var present = ALLERGEN_MAP[a].filter(function (k) { return ingHas(ings, k); });
        if (present.length) matchedAllergens.push({ allergen: a + " (common allergen)", ingredient: present[0] });
      });
    }
    matchedAllergens.forEach(function (m) {
      notes.push("⚠️ Contains " + m.ingredient + " — flagged for " + name + " (" + m.allergen + " noted in profile).");
    });

    // Life-stage gating
    var petStage = petLifeStage(pet);
    if (productType === "food" && aafco.type === "complete" && petStage) {
      var match = stageMatches(aafco.stage, petStage);
      if (match === false) {
        notForPet = true;
        var stageLabel = { growth: "puppies", adult: "adult dogs", senior: "senior dogs" }[petStage] || petStage;
        notes.push("🛑 Not for " + name + ": this food is formulated for " +
          (aafco.stage === "all" ? "all life stages" : (AAFCO_MIN[aafco.stage] || {}).label || aafco.stage) +
          ", but " + name + " is " + (petStage === "growth" ? "a puppy" : petStage === "senior" ? "a senior" : "an adult") +
          ". Feed a " + stageLabel + " formula instead.");
      }
    }

    // Condition notes — informational, never prescriptive
    (pet.conditions || []).forEach(function (c) {
      var key = norm(c);
      Object.keys(CONDITION_NOTES).forEach(function (k) {
        if (key.indexOf(k) !== -1) notes.push("ℹ️ " + CONDITION_NOTES[k]);
      });
    });

    if (!notes.length) {
      notes.push("For " + name + ": no conflicts with the listed conditions (" +
        ((pet.conditions && pet.conditions.length ? pet.conditions.join(", ") : "none recorded")) + ").");
    }
    return { text: notes.join(" "), notForPet: notForPet };
  }

  /* ---------- recall check (openFDA, best-effort) ---------- */

  function checkRecalls(brand, productName) {
    var result = { checked: false, hits: [], note: "" };
    if (typeof fetch !== "function" || !brand) {
      result.note = "Recall check skipped (no brand provided or network unavailable).";
      return Promise.resolve(result);
    }
    var q = 'firm_name:"' + brand.replace(/"/g, "") + '"';
    var url = "https://api.fda.gov/food/enforcement.json?search=" + encodeURIComponent(q) + "&limit=5";
    var timer = null;
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () { reject(new Error("timeout")); }, 8000);
    });
    return Promise.race([fetch(url), timeout]).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (json) {
      result.checked = true;
      (json.results || []).forEach(function (h) {
        result.hits.push({
          date: h.recall_initiation_date || h.report_date || "date unknown",
          reason: h.reason_for_recall || "reason not listed",
          classification: h.classification || "unclassified",
          product: h.product_description || "",
        });
      });
      result.note = result.hits.length
        ? "openFDA returned " + result.hits.length + " enforcement record(s) for this brand. Review details — the feed is incomplete for pet food."
        : "No recall records found in this database — this does not mean the product was never recalled.";
      return result;
    }).catch(function () {
      clearTimeout(timer);
      result.note = "Recall database unreachable right now — check the FDA's recall pages directly.";
      return result;
    });
  }

  /* ---------- Open Pet Food Facts barcode lookup ---------- */

  function opffToInput(product) {
    var nutr = product.nutriments || {};
    var ga = {};
    if (nutr.proteins != null) ga.protein = nutr.proteins;
    if (nutr.fat != null) ga.fat = nutr.fat;
    if (nutr.fiber != null) ga.fiber = nutr.fiber;
    // OPFF nutriments are per-100g as-fed — close enough to GA minimums for a floor check.
    return {
      productName: product.product_name || "Unknown product",
      brand: (product.brands || "").split(",")[0].trim(),
      ingredientsText: product.ingredients_text || "",
      ga: ga.protein != null ? ga : null,
      aafcoStatement: null, // OPFF does not reliably carry AAFCO statements — user confirms
      country: (product.countries || "").split(",")[0].trim() || null,
      categories: product.categories || "", // feeds the food-vs-treat classifier
      provenance: "verified",
      opffCode: product.code,
    };
  }

  function lookupBarcode(barcode) {
    var clean = String(barcode || "").replace(/[^0-9]/g, "");
    if (!clean) return Promise.resolve({ miss: true, reason: "empty" });
    if (typeof fetch !== "function") return Promise.resolve({ miss: true, reason: "offline" });
    var url = "https://world.openpetfoodfacts.org/api/v2/product/" + clean + ".json";
    return fetch(url).then(function (r) { return r.json(); }).then(function (json) {
      if (json && json.status === 1 && json.product) {
        return { input: opffToInput(json.product) };
      }
      return { miss: true, reason: "not-found" };
    }).catch(function () { return { miss: true, reason: "network" }; });
  }

  /* ---------- verdict assembly ---------- */

  var BANDS = [
    { min: 80, verdict: "recommended" },
    { min: 60, verdict: "good" },
    { min: 40, verdict: "caution" },
    { min: 0, verdict: "avoid" },
  ];

  function bandFor(score) {
    for (var i = 0; i < BANDS.length; i++) if (score >= BANDS[i].min) return BANDS[i].verdict;
    return "avoid";
  }

  function insufficientOutcome(reason, pet) {
    var guidance = reason === "not-found"
      ? "This barcode isn't in the Open Pet Food Facts database yet. You can photograph the ingredient panel or type the ingredients to get a label-derived analysis."
      : "We couldn't identify this product. Photograph the ingredient panel or type the ingredients for a label-derived analysis.";
    return {
      verdict: "unknown", score: null, provenance: "insufficient",
      summary: "We don't have enough data on this product to score it — and we won't guess.",
      pros: [], cons: [],
      factors: [],
      flags: [{ level: "info", text: guidance }],
      toxicityAlert: null,
      personalized: pet ? "For " + (pet.name || "your dog") + ": no analysis possible without product data." : "Add a pet profile once product data is available.",
      notForPet: false,
      recall: { checked: false, hits: [], note: "Recall check not run — no product identified." },
      methodology: "v1-draft",
      sources: ["Methodology v1 (DRAFT) — pending vet-nutritionist review."],
      guidance: guidance,
    };
  }

  function buildAnalysis(p, pet, provenance) {
    var ings = splitIngredients(p.ingredientsText);
    if (!ings.length) return insufficientOutcome("no-ingredients", pet);

    var aafcoParsed = parseAafco(p.aafcoStatement);
    // AAFCO user-confirmation (accuracy gate §5.10): the barcode path never
    // carries an adequacy statement, which hard-caps every lookup at Caution.
    // An explicit "Yes, it's on the bag" lifts the cap — "No"/"Unsure"/silence
    // never do. We never assume.
    var aafcoConfirmedByUser = aafcoParsed.type === "none" && !!p.aafcoUserConfirmed;
    var aafco = aafcoConfirmedByUser
      ? { type: "complete", method: "user-confirmed", stage: null, text: "Confirmed by user from the package" }
      : aafcoParsed;
    var productType = detectProductType(p, aafco);
    // True when the missing-AAFCO hard cap was applied (drives the UI's
    // "does the bag say…?" confirmation prompt).
    var aafcoCapped = productType === "food" && aafcoParsed.type !== "complete" && !aafcoConfirmedByUser;
    var rf = scanRedFlags(ings);
    var scored = productType === "treat" ? scoreTreats(p, pet, ings, aafco, rf) : scoreFood(p, pet, ings, aafco, rf);

    var score = scored.base;
    scored.factors.forEach(function (f) { score += f.points; });
    score = Math.max(0, Math.min(100, score));

    // Recall factor (applied after openFDA check resolves — see analyzeProduct)
    var verdict;
    var hardNotes = [];

    if (rf.avoid) {
      // TOXIC tier: immediate Avoid, score 0, emergency alert
      verdict = "avoid"; score = 0;
      hardNotes.push("Toxic ingredient detected — do not feed.");
    } else {
      if (rf.avoidTier.length) {
        // AVOID tier: Avoid-level result, no emergency language
        score = Math.min(score, 39);
        hardNotes.push("Contains Avoid-flagged ingredient(s): " +
          rf.avoidTier.map(function (m) { return m.entry.name; }).join(", ") + ".");
      }
      verdict = bandFor(score);
    }
    // No AAFCO statement on a complete-diet "food" → cap at Caution
    if (productType === "food" && aafco.type !== "complete") {
      if (verdict === "recommended" || verdict === "good") verdict = "caution";
      hardNotes.push("Avoid as sole diet — no AAFCO complete-and-balanced statement.");
    }

    var flags = rf.flags.slice();
    // Evidence-calibrated explanations for AVOID/CAUTION hits
    rf.avoidTier.forEach(function (m) {
      flags.push({ level: "danger", text: m.entry.name + " — flagged Avoid. " + m.entry.why_plain });
    });
    rf.caution.forEach(function (m) {
      flags.push({ level: "warn", text: m.entry.name + " — caution. " + m.entry.why_plain });
    });
    var personal = personalize(pet, ings, aafco, productType);
    if (personal.notForPet) flags.push({ level: "danger", text: "Life-stage mismatch for this pet — see personal note." });

    var pros = scored.factors.filter(function (f) { return f.points > 0; }).map(function (f) { return f.text; });
    var cons = scored.factors.filter(function (f) { return f.points < 0; }).map(function (f) { return f.text; });

    var label = p.productName || "this product";
    var summaries = {
      recommended: "“" + label + "” scores " + score + "/100 — complete and balanced with no critical flags. Still: AAFCO minimums are minimums, not optimums.",
      good: "“" + label + "” scores " + score + "/100 — a solid choice with minor caveats listed below.",
      caution: "“" + label + "” scores " + score + "/100 — significant concerns. Read the why-list before buying." + (hardNotes.length ? " " + hardNotes.join(" ") : ""),
      avoid: "“" + label + "” — do not feed" + (productType === "food" ? " as a sole diet" : "") + "." + (hardNotes.length ? " " + hardNotes.join(" ") : ""),
    };

    var sources = ["Methodology v1 (DRAFT) — pending vet-nutritionist review. Scoring rubric: 15 factors, AAFCO-based, every point explained."];
    if (aafcoConfirmedByUser) {
      sources.push("AAFCO adequacy: confirmed by you from the package — not present in the product database.");
    }
    if (provenance === "verified") {
      sources.push("Product data: © Open Pet Food Facts contributors, ODbL (share-alike — see legal review).");
    } else {
      sources.push("Product data: label-derived (manual entry / OCR) — not yet verified against our product database.");
    }
    sources.push("AAFCO minimums describe minimums, not what's optimal. This is an educational ingredient analysis, not veterinary advice.");

    return {
      verdict: verdict, score: score, provenance: provenance,
      summary: summaries[verdict],
      pros: pros, cons: cons,
      factors: scored.factors,
      flags: flags,
      toxicityAlert: rf.alert,
      personalized: personal.text,
      notForPet: personal.notForPet,
      recall: { checked: false, hits: [], note: "Recall check pending." },
      methodology: "v1-draft",
      sources: sources,
      aafcoUserConfirmed: aafcoConfirmedByUser,
      aafcoCapped: aafcoCapped,
      _scored: scored, _aafco: aafco, _productType: productType,
    };
  }

  /* ---------- public API ---------- */

  function analyzeProduct(input, pet) {
    input = input || {};
    var provenance = input.ingredientsText ? "label" : "insufficient";

    function finish(p, prov) {
      var analysis = buildAnalysis(p, pet, prov);
      if (analysis.verdict === "unknown") return Promise.resolve(analysis);
      if (input.isDemo) analysis.demo = true; // canned demo — labeled in the UI
      var brand = p.brand || "";
      return checkRecalls(brand).then(function (rec) {
        analysis.recall = rec;
        if (rec.hits.length) {
          var recent = rec.hits.filter(function (h) {
            var y = parseInt(String(h.date || "").slice(0, 4), 10);
            return !isNaN(y) && y >= new Date().getFullYear() - 5;
          });
          if (recent.length) {
            var r = recent[0];
            analysis._scored.factors.push(factor(15, -25,
              "Recalled in " + String(r.date).slice(0, 4) + " (" + r.classification + "): " + r.reason + ". " + analysis.recall.note,
              "danger", null));
            var ns = Math.max(0, analysis.score - 25);
            analysis.score = ns;
            analysis.verdict = bandFor(ns);
            analysis.flags.push({ level: "danger", text: "Recall record found in openFDA for this brand — details above." });
            if (/class i/i.test(r.classification || "")) {
              analysis.verdict = "avoid";
              analysis.summary = "“" + (p.productName || "this product") + "” — active Class I recall record found. Do not feed.";
            }
          }
          analysis.pros = analysis._scored.factors.filter(function (f) { return f.points > 0; }).map(function (f) { return f.text; });
          analysis.cons = analysis._scored.factors.filter(function (f) { return f.points < 0; }).map(function (f) { return f.text; });
          analysis.factors = analysis._scored.factors;
        }
        return analysis;
      });
    }

    // Barcode path: OPFF lookup first.
    if (input.upc && !input.ingredientsText) {
      return lookupBarcode(input.upc).then(function (res) {
        if (res.miss) return insufficientOutcome(res.reason, pet);
        res.input.aafcoUserConfirmed = !!input.aafcoUserConfirmed;
        return finish(res.input, "verified");
      });
    }
    // Manual / label-derived path (optionally enrich with OPFF if a UPC was also given).
    return finish({
      productName: input.productName, brand: input.brand,
      ingredientsText: input.ingredientsText, ga: input.ga,
      aafcoStatement: input.aafcoStatement, calorieContent: input.calorieContent,
      country: input.country, productType: input.productType,
      aafcoUserConfirmed: !!input.aafcoUserConfirmed,
    }, provenance);
  }

  var API = {
    analyzeProduct: analyzeProduct,
    lookupBarcode: lookupBarcode,
    checkRecalls: checkRecalls,
    isStub: function () { return false; },
    methodologyVersion: function () { return "v1-draft"; },
    parseAafco: parseAafco, // exposed for testing
    matchRedFlags: matchRedFlags, // exposed for testing
    scanRedFlags: scanRedFlags,   // exposed for testing
    DEMO_PRODUCT: DEMO_PRODUCT,   // canned demo product (A1) — quota-free scans
    RED_FLAG_DB: RED_FLAG_DB,
  };
  if (typeof window !== "undefined") {
    window.PLS = window.PLS || {};
    window.PLS.Scanner = API;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  }
})();
