/* Smoke tests for the red-flag ingredient DB wiring in scanner.js.
 * Run: node research/smoke-red-flags.js
 */
"use strict";
var S = require("../app/js/scanner.js");
var assert = require("assert");

function namesOf(bucket) {
  return bucket.map(function (m) { return m.entry.name; }).sort();
}
function scan(text) {
  var ings = text.toLowerCase().split(/[;,]/).map(function (s) { return s.trim(); }).filter(Boolean);
  return S.scanRedFlags(ings);
}

var pass = 0;
function check(label, text, expect) {
  var r = scan(text);
  if (expect.toxic) assert.deepStrictEqual(namesOf(r.toxic), expect.toxic.slice().sort(), label + ": toxic");
  if (expect.avoidTier) assert.deepStrictEqual(namesOf(r.avoidTier), expect.avoidTier.slice().sort(), label + ": avoidTier");
  if (expect.caution) assert.deepStrictEqual(namesOf(r.caution), expect.caution.slice().sort(), label + ": caution");
  if (expect.none) {
    assert.strictEqual(r.toxic.length, 0, label + ": expected no toxic");
    assert.strictEqual(r.avoidTier.length, 0, label + ": expected no avoid");
    assert.strictEqual(r.caution.length, 0, label + ": expected no caution");
  }
  pass++;
  console.log("ok - " + label);
}

// ---- DB integrity ----
assert.strictEqual(S.RED_FLAG_DB.length, 18, "18 entries");
["TOXIC", "AVOID", "CAUTION"].forEach(function (t) {
  var n = S.RED_FLAG_DB.filter(function (e) { return e.tier === t; }).length;
  assert.strictEqual(n, 6, t + " count = 6");
});
S.RED_FLAG_DB.forEach(function (e, i) {
  assert.ok(e.names && e.names.length, "entry " + i + " names");
  assert.ok(e.sources && e.sources.length, "entry " + i + " sources");
});
console.log("ok - DB integrity (18 entries, 6/6/6, all sourced)");

// ---- TOXIC ----
check("xylitol → Avoid + toxicity alert", "chicken, xylitol, salt", { toxic: ["Xylitol"] });
check("birch sugar alias", "oats, birch sugar", { toxic: ["Xylitol"] });
check("e967 alias", "glycerin, e967", { toxic: ["Xylitol"] });
check("garlic powder", "lamb, garlic powder", { toxic: ["Garlic"] });
check("onion powder", "beef, onion powder", { toxic: ["Onion"] });
check("raisins", "trail mix, raisins", { toxic: ["Grapes / raisins"] });
check("chocolate", "peanut butter, chocolate", { toxic: ["Chocolate / cocoa"] });
check("caffeine", "coffee, caffeine", { toxic: ["Chocolate / cocoa"] });
check("macadamia", "cookies, macadamia nuts", { toxic: ["Macadamia nuts"] });
var xr = scan("chicken, xylitol");
assert.ok(xr.avoid, "xylitol sets avoid=true");
assert.ok(xr.alert && /emergency/i.test(xr.alert), "xylitol sets emergency alert");
assert.strictEqual(xr.flags.filter(function (f) { return f.level === "danger"; }).length, 1, "xylitol danger flag");
console.log("ok - xylitol alert fields");

// ---- AVOID ----
check("BHA → Avoid", "corn, bha, chicken meal", { avoidTier: ["BHA"] });
check("e320 alias", "wheat, e320", { avoidTier: ["BHA"] });
check("BHT → Avoid", "wheat, bht", { avoidTier: ["BHT"] });
check("ethoxyquin → Avoid", "fish meal, ethoxyquin", { avoidTier: ["Ethoxyquin"] });
check("propylene glycol → Avoid (not toxic)", "water, propylene glycol, glycerin", { toxic: [], avoidTier: ["Propylene glycol"] });
check("menadione", "rice, menadione sodium bisulfite complex", { avoidTier: ["Menadione (vitamin K3)"] });
check("carrageenan", "chicken broth, carrageenan", { avoidTier: ["Carrageenan"] });

// ---- CAUTION ----
check("Red 40 → caution", "beef, red 40", { caution: ["Artificial colors"] });
check("yellow 5", "chicken, yellow 5", { caution: ["Artificial colors"] });
check("animal digest", "corn, animal digest", { caution: ["Animal digest"] });
check("poultry by-product meal", "corn, poultry by-product meal", { caution: ["Poultry by-product meal"] });
check("unnamed meat by-products", "meat by-products, corn", { caution: ["Meat by-products (unspecified)"] });
check("meat and bone meal", "meat and bone meal, corn", { caution: ["Meat and bone meal"] });
check("animal fat", "corn, animal fat", { caution: ["Animal fat (unspecified)"] });

// ---- false-positive guards ----
check("cocoa butter NOT flagged", "oats, cocoa butter", { none: true });
check("grape seed extract NOT flagged", "chicken, grape seed extract", { none: true });
check("blackcurrant NOT flagged", "blackcurrant juice", { none: true });
check("chicken meal NOT flagged", "chicken, chicken meal, brown rice", { none: true });
check("named chicken by-products NOT in unnamed", "chicken by-products, rice", { none: true });

// ---- end-to-end through analyzeProduct ----
async function e2e() {
  var x = await S.analyzeProduct({ productName: "Tox Kibble", ingredientsText: "chicken, xylitol, salt" });
  assert.strictEqual(x.verdict, "avoid", "xylitol product verdict");
  assert.strictEqual(x.score, 0, "xylitol product score");
  assert.ok(x.toxicityAlert, "xylitol product alert");
  console.log("ok - e2e xylitol → Avoid + toxicity alert");

  var b = await S.analyzeProduct({ productName: "BHA Kibble", ingredientsText: "corn, wheat, bha, chicken meal" });
  assert.strictEqual(b.verdict, "avoid", "BHA product verdict");
  assert.ok(b.score <= 39, "BHA product score capped ≤39");
  assert.ok(!b.toxicityAlert, "BHA product: no emergency alert");
  console.log("ok - e2e BHA → Avoid, no emergency language");

  var r = await S.analyzeProduct({ productName: "Red Kibble", ingredientsText: "beef, brown rice, red 40" });
  assert.notStrictEqual(r.verdict, "avoid", "red 40 not avoid");
  assert.ok(r.flags.some(function (f) { return /artificial colors/i.test(f.text); }), "red 40 caution note");
  console.log("ok - e2e Red 40 → caution note");

  var u = await S.analyzeProduct({ productName: "Clean Kibble", ingredientsText: "chicken, brown rice, carrots, fish oil" });
  assert.notStrictEqual(u.verdict, "avoid", "unknown ingredients not flagged");
  assert.ok(!u.toxicityAlert, "no toxicity alert for clean label");
  assert.strictEqual(u.flags.filter(function (f) { return /xylitol|bha|red 40/i.test(f.text); }).length, 0, "no red-flag notes");
  console.log("ok - e2e unknown ingredients → no flag");
}

// ---- accuracy-gate fix regressions (2026-09-28) ----
async function gateFixes() {
  // 1. grapefruit no longer trips the grape toxic alert
  var g = scan("chicken, grapefruit, rice");
  assert.strictEqual(g.toxic.length, 0, "grapefruit: no toxic");
  assert.strictEqual(g.avoid, false, "grapefruit: avoid=false");
  assert.ok(!g.alert, "grapefruit: no emergency alert");
  var gr = scan("chicken, raisins, rice");
  assert.deepStrictEqual(namesOf(gr.toxic), ["Grapes / raisins"], "real raisins still toxic");
  console.log("ok - gate fix 1: grapefruit guard");

  // 2. negation-aware factor 7/8 (Jack pâté-style marketing copy)
  var n = await S.analyzeProduct({ productName: "Negation Pâté", ingredientsText: "chicken, rice, sugar free, without artificial colouring, artificial flavour free, without added sugar" });
  assert.ok(!n.factors.some(function (f) { return f.n === 8; }), "negation: no added-sugar penalty");
  assert.ok(!n.factors.some(function (f) { return f.n === 7; }), "negation: no artificial-color penalty");
  var np = await S.analyzeProduct({ productName: "Sugary Kibble", ingredientsText: "chicken, sugar, red 40" });
  assert.ok(np.factors.some(function (f) { return f.n === 8 && f.points < 0; }), "control: real sugar still penalized");
  assert.ok(np.factors.some(function (f) { return f.n === 7 && f.points < 0; }), "control: real red 40 still penalized");
  console.log("ok - gate fix 2: negation-aware matching");

  // 3. French protein aliases + boar
  var fr = await S.analyzeProduct({ productName: "Pâté au poulet", ingredientsText: "poulet, riz, carottes" });
  assert.ok(fr.factors.some(function (f) { return f.n === 2 && f.points === 15; }), "french: poulet earns +15");
  assert.ok(!fr.factors.some(function (f) { return f.n === 3; }), "french: no factor-3 penalty");
  var bo = await S.analyzeProduct({ productName: "Boar Pâté", ingredientsText: "wild boar, sweet potato" });
  assert.ok(bo.factors.some(function (f) { return f.n === 2 && /boar/.test(f.text); }), "boar: named protein +15");
  console.log("ok - gate fix 3: french proteins + boar");

  // 4. treat classifier: sticks / ice cream / biscotti / friandises
  var st = await S.analyzeProduct({ productName: "Duck & Sweet Potato Sticks", ingredientsText: "duck, sweet potato, glycerin" });
  assert.strictEqual(st._productType, "treat", "sticks → treat track");
  var ic = await S.analyzeProduct({ productName: "Frosty Paws Vanilla Ice Cream", ingredientsText: "milk, sugar, vanilla" });
  assert.strictEqual(ic._productType, "treat", "ice cream → treat track");
  var bi = await S.analyzeProduct({ productName: "Biscotti Bites", ingredientsText: "wheat flour, honey" });
  assert.strictEqual(bi._productType, "treat", "biscotti → treat track");
  var fd = await S.analyzeProduct({ productName: "Chicken Kibble", ingredientsText: "chicken, brown rice" });
  assert.strictEqual(fd._productType, "food", "control: kibble stays food");
  console.log("ok - gate fix 4: treat classifier");

  // 5. AAFCO user-confirmation lifts the cap only on explicit Yes
  var capped = await S.analyzeProduct({ productName: "No-Aafco Kibble", ingredientsText: "chicken, brown rice, carrots" });
  assert.strictEqual(capped.aafcoCapped, true, "no statement → capped flag");
  assert.ok(["caution", "avoid"].indexOf(capped.verdict) !== -1, "no statement → capped at caution");
  var lifted = await S.analyzeProduct({ productName: "No-Aafco Kibble", ingredientsText: "chicken, brown rice, carrots", aafcoUserConfirmed: true });
  assert.strictEqual(lifted.aafcoUserConfirmed, true, "confirmation recorded");
  assert.strictEqual(lifted.aafcoCapped, false, "confirmation → not capped");
  assert.strictEqual(lifted.verdict, "good", "confirmation → cap lifted (65 = good)");
  assert.ok(lifted.sources.some(function (s) { return /confirmed by you/i.test(s); }), "confirmation disclosed in sources");
  console.log("ok - gate fix 5: AAFCO user-confirmation");
}

e2e().then(gateFixes).then(function () {
  console.log("\nALL " + (pass + 4 + 5) + " CHECKS PASSED");
}).catch(function (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
});
