"use strict";

oninstall = function (e, r) {
  return e.waitUntil(fetch(r = new Request("offline.html")).then(function (p) {
    return caches.open("c").then(function (cache) {
      return cache.put(r, p);
    });
  }));
};
onfetch = function (e) {
  return e.respondWith(fetch(event.request)["catch"](function () {
    return caches.open("c").then(function (c) {
      return c.match("offline.html");
    });
  }));
};