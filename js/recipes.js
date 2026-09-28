/* Pluto & Luna Select — Dog-friendly recipe library.
 *
 * Every recipe: constraint tags (matched against pet profiles), per-recipe
 * nutrition notes marked ESTIMATED, vetReview: "pending" until a
 * vet-nutritionist reviews the recipe. Treats are snacks, not meals — the
 * 10% rule (treats ≤ 10% of daily calories) is enforced in the UI copy.
 *
 * IMPORTANT: homemade MEALS (not treats) need full nutrient balancing
 * (see the feeding-fundamentals guide). Recipes below are treats/toppers
 * unless marked "balanced-meal" — none are marked that yet pending review.
 */

(function () {
  "use strict";

  var RECIPES = [
    {
      id: "pb-banana-treats",
      name: "Peanut Butter Banana Bites",
      icon: "🥜", time: "25 min", difficulty: "Easy",
      tags: ["grain-free-option", "training", "freezer-friendly"],
      vetReview: "pending",
      ingredients: ["1 ripe banana, mashed", "1/2 cup xylitol-FREE peanut butter (check the label!)", "1 cup oat flour", "1 egg (optional, for binding)"],
      steps: ["Mash banana, stir in peanut butter until smooth.", "Fold in oat flour (and egg) to a firm dough.", "Roll to 1/4 inch, cut into bite-size shapes.", "Bake at 325°F for 15–18 min until firm. Cool completely."],
      nutritionNote: "Estimated ~28 kcal per bite-size treat (dough makes ~30). High in healthy fats — count toward the 10% treat budget.",
      storage: "Fridge 1 week · freezer 3 months.",
      warnings: ["⚠️ Xylitol check is non-negotiable — some 'natural' peanut butters contain it."],
    },
    {
      id: "pumpkin-bites",
      name: "Pumpkin Tummy-Soothers",
      icon: "🎃", time: "30 min", difficulty: "Easy",
      tags: ["sensitive-stomach", "fiber-rich", "grain-free-option"],
      vetReview: "pending",
      ingredients: ["1 cup plain canned pumpkin (NOT pie filling)", "1/2 cup plain Greek yogurt", "1 cup oat flour"],
      steps: ["Mix pumpkin and yogurt.", "Stir in oat flour to a soft dough.", "Spoon into silicone molds or drop by teaspoon onto a lined tray.", "Bake at 350°F for 20 min. Cool."],
      nutritionNote: "Estimated ~22 kcal per bite. Pumpkin fiber is gentle on upset stomachs — but this is a treat, not a GI treatment.",
      storage: "Fridge 5 days.",
      warnings: [],
    },
    {
      id: "chicken-rice-bland",
      name: "Bland Chicken & Rice (Recovery Bowl)",
      icon: "🍚", time: "35 min", difficulty: "Easy",
      tags: ["sensitive-stomach", "bland-diet", "vet-approved-classic"],
      vetReview: "pending",
      ingredients: ["1 boneless skinless chicken breast", "1 cup white rice", "Water to cover"],
      steps: ["Boil chicken in plain water until cooked through (no seasoning, no oil).", "Cook rice separately in plain water.", "Shred chicken, mix 2 parts rice to 1 part chicken.", "Serve small, lukewarm portions."],
      nutritionNote: "Estimated ~180 kcal per cup. For short-term GI rest (24–48 hrs) only — NOT nutritionally complete. If symptoms persist past 48 hours, see your vet.",
      storage: "Fridge 3 days. Reheat gently.",
      warnings: ["⚠️ Bland diet is a bridge, not a diet. Return to balanced food promptly."],
    },
    {
      id: "salmon-sweet-potato",
      name: "Salmon & Sweet Potato Topper",
      icon: "🐟", time: "40 min", difficulty: "Medium",
      tags: ["omega-3", "skin-and-coat", "high-protein", "grain-free"],
      vetReview: "pending",
      ingredients: ["1 salmon fillet (boneless, skinless)", "1 medium sweet potato, cubed", "1 tbsp coconut oil (optional)"],
      steps: ["Bake salmon at 375°F for 15–20 min until flaky. Check meticulously for bones.", "Roast sweet potato cubes 25 min until soft.", "Flake salmon, mash sweet potato, combine.", "Spoon 2–3 tbsp over regular meals as a topper."],
      nutritionNote: "Estimated ~120 kcal per 1/4 cup. Rich in omega-3s for skin/coat. As a topper only — keep total extras under 10% of daily calories.",
      storage: "Fridge 4 days.",
      warnings: ["⚠️ Bone-check salmon twice. Never feed raw salmon (parasite risk)."],
    },
    {
      id: "blueberry-oat-biscuits",
      name: "Blueberry Oat Training Biscuits",
      icon: "🫐", time: "35 min", difficulty: "Easy",
      tags: ["antioxidant", "training", "crunchy", "low-fat"],
      vetReview: "pending",
      ingredients: ["1 cup oat flour", "1/2 cup fresh or frozen blueberries (mashed)", "1/4 cup unsweetened applesauce", "1 egg"],
      steps: ["Mix everything into a stiff dough.", "Roll thin, cut into pea-size training bits.", "Bake at 325°F for 20–25 min until crisp.", "Cool completely — they harden as they cool."],
      nutritionNote: "Estimated ~8 kcal per pea-size bit. Blueberries are a genuine antioxidant source for dogs — and the size makes them perfect high-rep training treats.",
      storage: "Airtight container 2 weeks.",
      warnings: [],
    },
    {
      id: "bone-broth",
      name: "Slow-Cooker Bone Broth",
      icon: "🍲", time: "12 hrs (hands-off)", difficulty: "Easy",
      tags: ["hydration", "picky-eaters", "senior", "grain-free"],
      vetReview: "pending",
      ingredients: ["2 lbs raw beef marrow/knuckle bones", "Water to cover + 2 inches", "2 tbsp apple cider vinegar", "No onion, no garlic, no salt"],
      steps: ["Cover bones with water + vinegar in a slow cooker.", "Cook on low 12 hours.", "Strain thoroughly — discard ALL bone fragments.", "Cool, skim fat, portion into ice cube trays."],
      nutritionNote: "Estimated ~10 kcal per cube. Excellent hydration and appetite trick for picky or senior dogs. The vinegar draws minerals out — it cooks off.",
      storage: "Fridge 5 days · freezer 6 months.",
      warnings: ["⚠️ NEVER feed cooked bones. Strain like your dog's life depends on it — it does.", "⚠️ No onion/garlic in the pot, ever."],
    },
    {
      id: "carrot-apple-pupcakes",
      name: "Carrot Apple Pupcakes",
      icon: "🧁", time: "30 min", difficulty: "Medium",
      tags: ["birthday", "low-fat", "veggie-packed"],
      vetReview: "pending",
      ingredients: ["1 cup oat flour", "1/2 cup grated carrot", "1/2 cup grated apple (no seeds)", "1/4 cup honey (dogs only, tiny amount)", "1 egg", "1/4 cup plain Greek yogurt (frosting)"],
      steps: ["Mix dry + wet into a thick batter.", "Fill lined mini-muffin tin 3/4 full.", "Bake at 350°F for 18–20 min.", "Cool, then 'frost' with a dab of Greek yogurt."],
      nutritionNote: "Estimated ~45 kcal per mini pupcake. A birthday treat — not a daily snack. Skip the honey entirely for diabetic dogs.",
      storage: "Fridge 4 days.",
      warnings: ["⚠️ Apple seeds contain cyanide compounds — core apples carefully."],
    },
    {
      id: "frozen-yogurt-bark",
      name: "Frozen Yogurt Berry Bark",
      icon: "🍦", time: "10 min + freeze", difficulty: "Easy",
      tags: ["summer", "hydration", "no-bake", "enrichment"],
      vetReview: "pending",
      ingredients: ["2 cups plain Greek yogurt (xylitol-free)", "1/2 cup mashed strawberries or blueberries", "1 tbsp peanut butter (xylitol-free), melted for drizzle"],
      steps: ["Spread yogurt 1/4-inch thick on a parchment-lined tray.", "Dot with mashed berries; drizzle peanut butter.", "Freeze 3+ hours. Break into shards.", "Serve on a lick mat for maximum enrichment time."],
      nutritionNote: "Estimated ~35 kcal per shard. Cooling summer enrichment — the licking itself is calming for anxious dogs.",
      storage: "Freezer 2 months in a sealed bag.",
      warnings: [],
    },
  ];

  window.PLS = window.PLS || {};
  window.PLS.Recipes = { RECIPES: RECIPES };
})();
