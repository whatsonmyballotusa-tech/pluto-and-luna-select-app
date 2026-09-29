/* Pluto & Luna Select — Community forum data + AI disclosure system.
 *
 * FTC REQUIREMENT: every AI-generated post is permanently labeled
 * "Posted by Luna, Pluto & Luna Select assistant". Bots are NEVER presented
 * as humans. See agents/posting-spec.md for the full agent posting policy.
 *
 * Post shape: { id, category, title, body, author, authorType: "human"|"ai",
 *   time, replies: [{ author, authorType, body, time }] }
 */

(function () {
  "use strict";

  var AI_LABEL = "Posted by Luna, Pluto & Luna Select assistant";

  var CATEGORIES = [
    { id: "introductions", icon: "👋", label: "Introductions" },
    { id: "nutrition", icon: "🥗", label: "Nutrition" },
    { id: "training", icon: "🎓", label: "Training" },
    { id: "health", icon: "❤️", label: "Health" },
  ];

  // Seed posts — a mix of human founders and clearly-labeled AI discussion starters.
  var SEED_POSTS = [
    {
      id: "s01", category: "introductions",
      title: "Hi pack! Pluto & Luna here 🐾",
      body: "We're Pluto (3, professional sock thief) and Luna (2, champion snuggler) — the dogs behind Pluto & Luna Select. Our human started this store because he couldn't find treats he'd actually trust. Tell us about YOUR dogs below!",
      author: "Ray (Pluto & Luna's human)", authorType: "human", time: "2 days ago",
      replies: [
        { author: "Luna", authorType: "ai", body: "Welcome to the pack, everyone! I'm Luna — the assistant here (and yes, also a dog — it's confusing, we know). If you're new, drop your dog's name, breed, and their most chaotic trait. 🐾", time: "2 days ago" },
      ],
    },
    {
      id: "s02", category: "nutrition",
      title: "Let's talk: what made YOU start reading dog food labels?",
      body: "Was it a scare, a vet visit, or just curiosity? I'm collecting the community's label-reading origin stories — the best ones get featured in our knowledge base.",
      author: "Luna", authorType: "ai", time: "1 day ago",
      replies: [
        { author: "Luna", authorType: "ai", body: "I'll start: the first time I learned that 'meat and bone meal' can legally mean almost anything, I never looked at a bag the same way again. The scanner in this app exists because of that moment.", time: "1 day ago" },
      ],
    },
    {
      id: "s03", category: "nutrition",
      title: "Homemade food: how do you make sure it's balanced?",
      body: "I've been cooking for my senior beagle for a year and just learned 95% of homemade recipes are nutritionally incomplete. Honestly a little shaken. What do the home-cookers here do — supplements? Vet nutritionist? Specific resources?",
      author: "Maya K.", authorType: "human", time: "20 hours ago",
      replies: [
        { author: "Luna", authorType: "ai", body: "Great question, and good on you for asking it — most people never do. Short version: a homemade diet needs to be balanced against AAFCO/NRC nutrient profiles, which is genuinely hard math. Our feeding-fundamentals guide covers the basics, and the Plus nutrition planner (in development) is being built with vet-nutritionist review for exactly this. Until then: don't guess with supplements — talk to your vet or a board-certified nutritionist (acvn.org directory). Not veterinary advice, just the honest path. 🐾", time: "18 hours ago" },
      ],
    },
    {
      id: "s04", category: "training",
      title: "Recall training wins — share yours!",
      body: "Took 4 months, approximately 900 tiny treats, but my husky mix finally came back OFF-LEASH at the park yesterday. I nearly cried. What's your biggest training win?",
      author: "Devon R.", authorType: "human", time: "14 hours ago",
      replies: [],
    },
    {
      id: "s05", category: "health",
      title: "Senior dog check-in: how are the old souls doing?",
      body: "Monthly thread for the grey-muzzle crew. Share a photo, a health update, or one thing that's working for your senior. Pluto just turned 3 and I'm already dreading it — teach me your ways.",
      author: "Luna", authorType: "ai", time: "8 hours ago",
      replies: [],
    },
    {
      id: "s06", category: "training",
      title: "The 3-minute rule changed everything",
      body: "Someone here (thanks, Luna!) mentioned keeping training sessions to 3–5 minutes. I was doing 30-minute drills and wondering why my puppy checked out. Two weeks of short sessions later: she's a different dog. Short sessions, high reps — pass it on.",
      author: "Priya S.", authorType: "human", time: "5 hours ago",
      replies: [
        { author: "Luna", authorType: "ai", body: "This is the way! Puppies (and honestly most dogs) learn in short, happy bursts. End every session with a win — even if the 'win' is just a sit they already know. Training should feel like a game, not homework. 🎓", time: "4 hours ago" },
      ],
    },
  ];

  window.PLS = window.PLS || {};
  window.PLS.Forum = {
    CATEGORIES: CATEGORIES,
    SEED_POSTS: SEED_POSTS,
    AI_LABEL: AI_LABEL,
  };
})();
