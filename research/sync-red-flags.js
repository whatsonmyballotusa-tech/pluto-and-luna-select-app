#!/usr/bin/env node
/* Syncs the RED_FLAG_DB constant in app/js/scanner.js from the canonical
 * research/red-flag-ingredients.json. Display names and JS-only false-positive
 * guards live here (they are not part of the JSON schema).
 *
 * Usage: node research/sync-red-flags.js
 */
"use strict";
var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var JSON_PATH = path.join(ROOT, "research", "red-flag-ingredients.json");
var SCANNER_PATH = path.join(ROOT, "app", "js", "scanner.js");

// Must stay in the same order as the JSON entries array.
var NAMES = [
  "Xylitol",
  "Chocolate / cocoa",
  "Grapes / raisins",
  "Onion",
  "Garlic",
  "Macadamia nuts",
  "BHA",
  "BHT",
  "Ethoxyquin",
  "Propylene glycol",
  "Menadione (vitamin K3)",
  "Carrageenan",
  "Artificial colors",
  "Meat by-products (unspecified)",
  "Animal digest",
  "Poultry by-product meal",
  "Meat and bone meal",
  "Animal fat (unspecified)"
];

// JS-only false-positive guards (substring matches that must NOT flag).
var EXCLUDE = {
  "Chocolate / cocoa": ["cocoa butter", "grapefruit"],
  "Grapes / raisins": ["grape seed", "grapefruit", "black currant", "blackcurrant"]
};

function main() {
  var db = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  if (!db.entries || db.entries.length !== NAMES.length) {
    throw new Error("entry count mismatch: json=" +
      (db.entries && db.entries.length) + " names=" + NAMES.length);
  }
  var entries = db.entries.map(function (e, i) {
    ["names", "tier", "why_plain", "sources"].forEach(function (f) {
      if (!e[f] || !e[f].length) throw new Error("entry " + i + " missing/empty " + f);
    });
    if (["TOXIC", "AVOID", "CAUTION"].indexOf(e.tier) === -1) {
      throw new Error("entry " + i + " bad tier: " + e.tier);
    }
    var out = {
      name: NAMES[i],
      names: e.names,
      tier: e.tier,
      why_plain: e.why_plain,
      sources: e.sources
    };
    if (EXCLUDE[NAMES[i]]) out.exclude = EXCLUDE[NAMES[i]];
    return out;
  });

  var body = entries.map(function (e) { return "    " + JSON.stringify(e); }).join(",\n");
  var block = "/* RED-FLAG-DB:BEGIN — generated from research/red-flag-ingredients.json v" +
    db.version + " by research/sync-red-flags.js. Do not hand-edit. */\n" +
    "  var RED_FLAG_DB = [\n" + body + "\n  ];\n" +
    "  /* RED-FLAG-DB:END */";

  var src = fs.readFileSync(SCANNER_PATH, "utf8");
  var re = /\/\* RED-FLAG-DB:BEGIN[\s\S]*?RED-FLAG-DB:END \*\//;
  if (!re.test(src)) throw new Error("markers not found in scanner.js");
  var next = src.replace(re, block);
  if (next === src) {
    console.log("RED_FLAG_DB already in sync (" + entries.length + " entries).");
  } else {
    fs.writeFileSync(SCANNER_PATH, next);
    console.log("scanner.js RED_FLAG_DB synced (" + entries.length + " entries).");
  }
}

main();
