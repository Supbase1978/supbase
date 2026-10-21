/**
 * A `v8_passThroughRequests` flag mellett a `request.url` a NYERS HTTP-URL:
 * data-kéréseknél `.data` / `/_.data` utótaggal és belső `?_routes` / `?index`
 * paraméterekkel. Ez a függvény a korábban a framework által normalizált
 * URL-t adja vissza (locale-felismeréshez, analitikához, belépő-redirecthez).
 */
export function normalizedUrl(request: Request): URL {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/_.data")) {
    url.pathname = url.pathname.slice(0, -"_.data".length);
  } else if (url.pathname.endsWith(".data")) {
    url.pathname = url.pathname.slice(0, -".data".length);
  }
  for (const internal of ["_routes", "index"]) {
    if (url.searchParams.has(internal)) {
      url.searchParams.delete(internal);
    }
  }
  return url;
}
