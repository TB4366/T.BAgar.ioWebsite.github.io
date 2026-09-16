const CACHE_NAME = "tb-agar-io-v1";

const FILES_TO_CACHE = [

  "/",
  "/index.html",
  "/manifest.json",

  "/IMG_0561.jpeg",
  "/IMG_0321.jpeg",
  "/IMG_0322.jpeg",

  "/74BF9245-C3FD-4FAE-9CE1-D1AA11CFA7FF.jpeg"

];


/* =========================
   INSTALL
========================= */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE_NAME)
        .then(cache => {

          return cache.addAll(
            FILES_TO_CACHE
          );

        })

    );

    self.skipWaiting();

  }
);


/* =========================
   ACTIVATE
========================= */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches.keys()
        .then(cacheNames => {

          return Promise.all(

            cacheNames
              .filter(
                cacheName =>
                  cacheName !== CACHE_NAME
              )
              .map(
                cacheName =>
                  caches.delete(cacheName)
              )
          );

        })

    );

    self.clients.claim();

  }
);


/* =========================
   FETCH
========================= */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    /*
      Do not cache POST requests.
      This keeps /api/chat working normally.
    */

    if(request.method !== "GET"){
      return;
    }


    /*
      Network first.
      If the network fails, use cache.
    */

    event.respondWith(

      fetch(request)
        .then(response => {

          if(
            response &&
            response.status === 200
          ){

            const responseClone =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then(cache => {

                cache.put(
                  request,
                  responseClone
                );

              });

          }

          return response;

        })

        .catch(() => {

          return caches
            .match(request)
            .then(cachedResponse => {

              if(cachedResponse){
                return cachedResponse;
              }


              return new Response(

                `
                <!doctype html>

                <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport"
                    content="width=device-width,
                    initial-scale=1">
                  <title>T.B Agar.io</title>
                </head>

                <body style="
                  margin:0;
                  background:#020617;
                  color:white;
                  font-family:Arial;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  min-height:100vh;
                  text-align:center;
                  padding:20px;
                ">

                  <div>

                    <h1>
                      T.B Agar.io
                    </h1>

                    <p>
                      You are currently offline.
                    </p>

                  </div>

                </body>
                </html>
                `,

                {
                  headers:{
                    "Content-Type":
                      "text/html"
                  }

                }

              );

            });

        })

    );

  }
);
