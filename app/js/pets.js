/* Pluto & Luna Select — Pet profiles: CRUD + personalization.
 *
 * Pet shape (Supabase-ready — see README, table: pets):
 *   { id, name, breed, ageYears, weightLbs, photoEmoji, conditions: [],
 *     dietaryNeeds: [], notes, createdAt }
 *
 * Personalization contract used across the app:
 *   PLS.Pets.matchTags(tags[]) -> tags annotated { tag, match: bool }
 *     A recipe/knowledge tag "matches" the active pet when it aligns with the
 *     pet's conditions or dietaryNeeds (e.g. pet has "sensitive stomach" and
 *     the recipe is tagged "sensitive-stomach").
 *   PLS.Pets.relevantWarnings() -> warnings for the active pet (e.g. allergies)
 */

(function () {
  "use strict";

  var CONDITION_OPTIONS = [
    "Allergies", "Sensitive stomach", "Overweight", "Diabetes",
    "Kidney disease", "Pancreatitis history", "Joint issues", "Senior (7+ yrs)",
  ];
  var DIET_OPTIONS = [
    "Grain-free", "High-protein", "Low-fat", "Puppy formula",
    "Senior formula", "Raw / BARF", "Home-cooked", "Weight management",
  ];

  function uid() {
    return "pet_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function getAll() { return PLS.getPets(); }
  function saveAll(pets) { PLS.savePets(pets); }

  function add(pet) {
    var pets = getAll();
    if (!PLS.isPaid() && pets.length >= PLS.FREE_LIMITS.maxPets) {
      return { ok: false, reason: "limit" };
    }
    pet.id = uid();
    pet.createdAt = new Date().toISOString();
    pet.conditions = pet.conditions || [];
    pet.dietaryNeeds = pet.dietaryNeeds || [];
    pets.push(pet);
    saveAll(pets);
    if (pets.length === 1) PLS.setActivePet(pet.id);
    return { ok: true, pet: pet };
  }

  function update(id, patch) {
    var pets = getAll();
    var i = pets.findIndex(function (p) { return p.id === id; });
    if (i === -1) return false;
    Object.assign(pets[i], patch);
    saveAll(pets);
    return true;
  }

  function remove(id) {
    var pets = getAll().filter(function (p) { return p.id !== id; });
    saveAll(pets);
    var active = PLS.getActivePet();
    if (!active && pets.length) PLS.setActivePet(pets[0].id);
  }

  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  // Annotate content tags with whether they match the active pet.
  function matchTags(tags) {
    var pet = PLS.getActivePet();
    if (!pet) return (tags || []).map(function (t) { return { tag: t, match: false }; });
    var profile = (pet.conditions.concat(pet.dietaryNeeds)).map(norm);
    return (tags || []).map(function (t) {
      var nt = norm(t);
      var match = profile.some(function (c) { return nt.indexOf(c) !== -1 || c.indexOf(nt) !== -1; });
      return { tag: t, match: match };
    });
  }

  function relevantWarnings() {
    var pet = PLS.getActivePet();
    if (!pet || !pet.conditions.length) return [];
    return pet.conditions.map(function (c) {
      return "⚠️ " + pet.name + "'s profile lists “" + c + "” — filter recipes and scanner results accordingly, and confirm choices with your vet.";
    });
  }

  function avatarHTML(pet, size) {
    var initials = pet.name.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
    var emoji = pet.photoEmoji || "🐶";
    return '<div class="pet-avatar"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : "") + ">" +
      '<span style="font-size:' + (size ? Math.round(size * 0.45) : 28) + 'px">' + PLS.esc(emoji) + "</span></div>";
  }

  window.PLS = window.PLS || {};
  window.PLS.Pets = {
    getAll: getAll, add: add, update: update, remove: remove,
    matchTags: matchTags, relevantWarnings: relevantWarnings, avatarHTML: avatarHTML,
    CONDITION_OPTIONS: CONDITION_OPTIONS, DIET_OPTIONS: DIET_OPTIONS,
  };
})();
