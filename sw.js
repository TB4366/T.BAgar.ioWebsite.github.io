const CACHE_NAME = "tb-agar-io-v1";

const APP_FILES = [
"/",
"/index.html",
"/manifest.json",
"/IMG_0561.jpeg",
"/IMG_0321.jpeg",
"/IMG_0322.jpeg",
"/74BF9245-C3FD-4FAE-9CE1-D1AA11CFA7FF.jpeg"
];

/* Install */
self.addEventListener("install", event => {

event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => cache.addAll(APP_FILES))
.then(() => self.skipWaiting())
);

});

/* Activate */
self.addEventListener("activate", event => {

event.waitUntil(

```
caches.keys().then(keys => {

  return Promise.all(

    keys
      .filter(key => key !== CACHE_NAME)
      .map(key => caches.delete(key))

  );

}).then(() => self.clients.claim())
```

);

});

/* Fetch */
self.addEventListener("fetch", event => {

const request = event.request;

/*

* Alleen GET requests cachen.
* POST /api/chat blijft rechtstreeks naar
* jouw server gaan.
  */
  if(request.method !== "GET"){
  return;
  }

event.respondWith(

```
fetch(request)
  .then(response => {

    /*
     * Geldige response bewaren voor
     * volgende keer.
     */
    if(
      response &&
      response.status === 200 &&
      response.type !== "opaque"
    ){

      const copy =
        response.clone();

      caches.open(CACHE_NAME)
        .then(cache => {
          cache.put(request, copy);
        });

    }

    return response;

  })
  .catch(() => {

    /*
     * Als internet tijdelijk wegvalt,
     * probeer eerst de cache.
     */
    return caches.match(request)
      .then(cached => {

        if(cached){
          return cached;
        }

        /*
         * Voor navigatie terug naar Home.
         */
        if(
          request.mode === "navigate"
        ){

          return caches.match(
            "/index.html"
          );

        }

        return new Response(
          "T.B Agar.io is tijdelijk offline.",
          {
            status:503,
            headers:{
              "Content-Type":
                "text/plain; charset=utf-8"
            }
          }
        );

      });

  })
```

);

});
