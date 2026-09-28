/* Pluto & Luna Select — Knowledge base content.
 *
 * Every guide carries: sources[] and vetReview: "pending" | "reviewed".
 * NOTHING here is veterinary advice — the UI renders the disclaimer on every guide.
 * Content accuracy: toxic-food list cross-checked against ASPCA / Pet Poison Helpline
 * public guidance. Severity: high = potentially fatal, medium = vet visit likely,
 * low = mild/depends on amount.
 */

(function () {
  "use strict";

  var GUIDES = [
    {
      id: "toxic-foods",
      icon: "☠️",
      title: "Toxic Foods — Know the Danger List",
      category: "safety",
      vetReview: "pending",
      sources: ["ASPCA Animal Poison Control", "Pet Poison Helpline"],
      intro: "If your dog eats any HIGH-severity item, call your vet or ASPCA Poison Control (888-426-4435) immediately. Do NOT wait for symptoms.",
      items: [
        { name: "Xylitol (birch sugar)", severity: "high", detail: "In sugar-free gum, peanut butter, candy. Even small amounts can cause fatal liver failure. Check every label." },
        { name: "Chocolate (esp. dark/baking)", severity: "high", detail: "Theobromine toxicity. Darker = more dangerous. A small dog can be poisoned by a few ounces of dark chocolate." },
        { name: "Grapes & raisins", severity: "high", detail: "Can cause acute kidney failure. Toxic dose varies wildly by dog — treat ANY amount as an emergency." },
        { name: "Onions (all forms)", severity: "high", detail: "Raw, cooked, powdered — damages red blood cells. Toxicity builds over repeated small doses." },
        { name: "Macadamia nuts", severity: "high", detail: "Causes weakness, vomiting, tremors, hyperthermia. As few as a handful can poison a small dog." },
        { name: "Alcohol", severity: "high", detail: "Same effects as in humans but far faster — can cause coma and death in small dogs." },
        { name: "Caffeine", severity: "medium", detail: "Coffee, tea, energy drinks. Causes restlessness, rapid heart rate, tremors." },
        { name: "Garlic", severity: "medium", detail: "Same family as onion, less concentrated — but large amounts are dangerous. Skip it in homemade food." },
        { name: "Avocado", severity: "medium", detail: "Persin in leaves/pit/skin; the pit is also a choking and obstruction risk." },
        { name: "Cooked bones", severity: "medium", detail: "Splinter and can perforate the gut. Raw recreational bones only, supervised — or skip bones entirely." },
        { name: "Dairy (large amounts)", severity: "low", detail: "Most dogs are lactose intolerant — expect gas and diarrhea, not an emergency." },
        { name: "Fatty table scraps", severity: "low", detail: "Can trigger pancreatitis in susceptible dogs. A tiny taste is fine; a plate of bacon is not." },
      ],
    },
    {
      id: "emergency-basics",
      icon: "🚨",
      title: "Emergency Basics — First 10 Minutes",
      category: "safety",
      vetReview: "pending",
      sources: ["ASPCA Animal Poison Control", "American Red Cross Pet First Aid"],
      sections: [
        { h: "Save these numbers now", body: "<ul><li><strong>Your vet's emergency line</strong> — program it today</li><li><strong>ASPCA Poison Control: 888-426-4435</strong> (consultation fee may apply)</li><li><strong>Nearest 24-hr emergency vet</strong> — know the drive time before you need it</li></ul>" },
        { h: "If your dog ate something toxic", body: "<ul><li>Stay calm. Note <strong>what</strong>, <strong>how much</strong>, and <strong>when</strong> — and grab the packaging.</li><li>Call poison control or your vet <strong>before</strong> doing anything else.</li><li><strong>Do NOT induce vomiting</strong> unless a professional tells you to — it can cause more damage with caustic substances.</li></ul>" },
        { h: "Choking", body: "<ul><li>Signs: pawing at mouth, distress, blue gums, can't bark.</li><li>If you can see the object, try to sweep it out — carefully.</li><li>Dog Heimlich: small dog — hold against you, fist under ribcage, quick upward thrusts. Large dog — stand behind, same motion. Then vet, immediately.</li></ul>" },
        { h: "Build a $30 first-aid kit", body: "<ul><li>Gauze, non-stick bandages, adhesive tape</li><li>Hydrogen peroxide 3% (<em>only use if a vet instructs</em>)</li><li>Digital thermometer + petroleum jelly</li><li>Saline eye wash, tweezers, muzzle (even gentle dogs bite when in pain)</li></ul>" },
      ],
    },
    {
      id: "puppy-training",
      icon: "🎓",
      title: "Puppy Training Fundamentals",
      category: "training",
      vetReview: "pending",
      sources: ["American Veterinary Society of Animal Behavior (AVSAB) position statements"],
      sections: [
        { h: "The only rule that matters", body: "<p><strong>Reward what you want; manage what you don't.</strong> Modern behavior science is unambiguous: reward-based training works and aversive methods (shock, prong, alpha rolls) increase fear and aggression. (AVSAB position statement.)</p>" },
        { h: "First 30 days priorities", body: "<ul><li><strong>Name + recall:</strong> say the name, treat. 20 reps a day. Recall is a life-saving skill — practice it like one.</li><li><strong>Sit / down / stay:</strong> lure with a treat, mark and reward. Keep sessions to 3–5 minutes.</li><li><strong>Loose leash:</strong> reward position at your side; stop moving when they pull. Boring beats yanking.</li><li><strong>Socialization window (3–14 weeks):</strong> 100 positive exposures — people, dogs, sounds, surfaces. Positive = treats rain from the sky.</li></ul>" },
        { h: "House training that actually works", body: "<ul><li>Out every 2 hours, after meals, after naps, after play. Same spot.</li><li>Throw a party (treats + praise) for outdoor success. Never punish indoor accidents — it teaches them to hide it, not hold it.</li><li>Crate = bedroom, not jail. Big enough to stand and turn, never for punishment.</li></ul>" },
        { h: "Bite inhibition", body: "<p>Puppy teeth are needles — that's normal. Yelp or go still when teeth touch skin, redirect to a toy, reward gentle mouthing. If biting escalates with age, that's a trainer conversation, not a dominance problem.</p>" },
      ],
    },
    {
      id: "senior-care",
      icon: "🤍",
      title: "Senior Dog Care (7+ Years)",
      category: "health",
      vetReview: "pending",
      sources: ["American Animal Hospital Association (AAHA) senior care guidelines"],
      sections: [
        { h: "Vet cadence changes", body: "<p>Move to <strong>twice-yearly checkups</strong>. Senior blood panels catch kidney, liver, and thyroid changes early — when they're cheapest to manage. Dental disease accelerates with age; ask about cleanings.</p>" },
        { h: "Joints", body: "<ul><li>Keep them lean — every extra pound multiplies joint stress.</li><li>Low-impact exercise: swimming and sniff walks beat fetch marathons.</li><li>Ramps for cars and couches; non-slip rugs on hard floors.</li><li>Ask your vet about joint supplements and pain management — don't self-prescribe human NSAIDs (ibuprofen/acetaminophen are toxic).</li></ul>" },
        { h: "Senses fade — adapt", body: "<ul><li><strong>Hearing:</strong> switch to hand signals early; stomp to get attention through floor vibration.</li><li><strong>Vision:</strong> keep furniture layouts stable; use scent markers and nightlights.</li><li><strong>Cognition (doggy dementia):</strong> night restlessness, staring, house-training regression — vet diets, enrichment, and routine help.</li></ul>" },
        { h: "Nutrition", body: "<p>Seniors often need fewer calories but <strong>more</strong> high-quality protein to preserve muscle. 'Senior' labels aren't regulated — judge the food by its analysis, or scan it in this app.</p>" },
      ],
    },
    {
      id: "feeding-fundamentals",
      icon: "🥗",
      title: "Feeding Fundamentals",
      category: "nutrition",
      vetReview: "pending",
      sources: ["AAFCO Dog Food Nutrient Profiles", "National Research Council (NRC) nutrient requirements"],
      sections: [
        { h: "Reading a label in 30 seconds", body: "<ul><li><strong>First ingredient should be a named animal protein</strong> (chicken, salmon — not 'meat meal' or 'animal by-products').</li><li>Look for the <strong>AAFCO statement</strong>: 'formulated to meet the nutritional levels established by AAFCO for [life stage]'. No statement = no verified completeness.</li><li>'Grain-free' is marketing, not nutrition — grains are fine for most dogs; some grain-free diets have been linked to heart concerns (FDA investigation ongoing).</li></ul>" },
        { h: "How much to feed", body: "<p>Start with the bag's guide for your dog's <strong>ideal</strong> weight (not current weight), then adjust by body condition: you should feel ribs easily under a thin fat layer, with a visible waist from above. Treats ≤ 10% of daily calories.</p>" },
        { h: "Transitioning foods", body: "<p>7–10 days: 25/75 → 50/50 → 75/25 → 100% new. Abrupt switches cause the GI upset people blame on the new food.</p>" },
        { h: "Homemade diets need math", body: "<p>95% of published home-prepared dog recipes are deficient in at least one essential nutrient (Stockman et al., JAVMA 2013). If you cook for your dog, every recipe needs balancing against NRC/AAFCO profiles — that's what our nutrition planner is for (Plus tier), reviewed with a vet nutritionist.</p>" },
      ],
    },
  ];

  var CATEGORIES = [
    { id: "safety", icon: "🛡️", label: "Safety" },
    { id: "nutrition", icon: "🥗", label: "Nutrition" },
    { id: "training", icon: "🎓", label: "Training" },
    { id: "health", icon: "❤️", label: "Health" },
  ];

  window.PLS = window.PLS || {};
  window.PLS.Knowledge = { GUIDES: GUIDES, CATEGORIES: CATEGORIES };
})();
