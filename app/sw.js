/* Pluto & Luna Select — service worker: cache-first shell, network-first data. */
var CACHE = "pls-v4";
var SHELL = [
  "./", "./index.html", "./pets.html", "./scanner.html", "./knowledge.html",
  "./recipes.html", "./community.html", "./shop.html", "./upgrade.html",
  "./planner.html", "./records.html", "./styles.css",
  "./js/app.js", "./js/pets.js", "./js/scanner.js", "./js/store.js",
  "./js/cart.js", "./js/product.js",
  "./js/knowledge.js", "./js/recipes.js", "./js/community.js",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
