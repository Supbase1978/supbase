/**
 * Lokális PRODUKCIÓS futtató — a `build/` kimenet kiszolgálása fejlesztői gépen.
 *
 * MIÉRT KELL: az F1.10/3 óta nincs `npm run start` (a Netlify-adapterrel a
 * szerver-build serverless handler, nem önálló Node-szerver). A teljesítmény-
 * mérésnek (`e2e/perf.spec.ts`) viszont a PRODUKCIÓS bundle ellen van értelme:
 * a dev-szerver nem bundle-öl, nem minifikál, és HMR-kódot is szállít — abból
 * mért LCP semmit nem mond a valóságról.
 *
 * Ez a szkript pontosan azt csinálja, amit a Netlify: a `build/client` alatti
 * statikus fájlt közvetlenül adja vissza (`preferStatic: true`), minden mást a
 * generált SSR-handlernek ad át.
 *
 * TÖMÖRÍT (br/gzip) — nem a kényelem miatt: fojtott hálózaton a tömörítés a
 * legnagyobb egyetlen tényező, és a Netlify is tömörítve szállít. Enélkül a
 * mért LCP a valóságnál JELENTŐSEN rosszabb lenne (a `/spotok` mérése 2,8 s-ról
 * 1,3 s-ra esett a tömörítés bekapcsolásával), vagyis a kapu hamis riasztást
 * adna. Ami hiányzik a valósághoz képest: HTTP/2 és CDN-közelség.
 *
 * Futtatás:  node scripts/serve-build.mjs [port]
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { pipeline, Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBrotliCompress, createGzip, constants as zlibConstants } from "node:zlib";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLIENT_DIR = join(ROOT, "build", "client");
const SERVER_ENTRY = join(ROOT, "build", "server", "server.js");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3000);

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

/** Csak a szöveges típusokat éri meg tömöríteni (a PNG/WOFF2 már tömörített). */
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest))/;

/**
 * Tartalom-kódolás egyeztetés. A brotli szintje szándékosan 5 (nem a gyári 11):
 * a CDN-ek is közepes szinten szállítanak, a 11 pedig másodperceket enne el
 * minden kérésnél — a MÉRT bájtszám alig térne el.
 */
function pickEncoding(req, contentType) {
  if (!contentType || !COMPRESSIBLE.test(contentType)) return null;
  const accept = String(req.headers["accept-encoding"] ?? "");
  if (accept.includes("br")) {
    return {
      name: "br",
      stream: () =>
        createBrotliCompress({ params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } }),
    };
  }
  if (accept.includes("gzip")) return { name: "gzip", stream: () => createGzip() };
  return null;
}

/** A build/client-en KÍVÜLRE mutató útvonal (`../`, abszolút) nem szolgálható ki. */
function safeStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = resolve(join(CLIENT_DIR, normalize(decoded)));
  return candidate.startsWith(CLIENT_DIR) ? candidate : null;
}

async function tryStatic(pathname, req, res) {
  if (pathname === "/") return false;
  const filePath = safeStaticPath(pathname);
  if (!filePath) return false;

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;

  const contentType = MIME[extname(filePath)] ?? "application/octet-stream";
  const encoding = pickEncoding(req, contentType);

  res.writeHead(200, {
    "content-type": contentType,
    // A `/assets/` alatti fájlnevek tartalom-hash-esek (Vite) — a Netlify is
    // immutable-ként adja őket; a többi statikus fájl neve stabil, ezért rövid.
    "cache-control": pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
    ...(encoding ? { "content-encoding": encoding.name, vary: "accept-encoding" } : {}),
    ...(encoding ? {} : { "content-length": String(info.size) }),
  });

  const source = createReadStream(filePath);
  if (encoding) {
    pipeline(source, encoding.stream(), res, noteBrokenPipe);
  } else {
    pipeline(source, res, noteBrokenPipe);
  }
  return true;
}

/** A böngésző megszakíthat egy kérést (pl. navigáció közben) — az nem hiba. */
function noteBrokenPipe(error) {
  if (error && error.code !== "ERR_STREAM_PREMATURE_CLOSE" && error.code !== "EPIPE") {
    console.error("[serve-build] stream", error);
  }
}

/** Node IncomingMessage → Fetch Request (a handler ezt várja). */
function toWebRequest(req, origin) {
  const url = new URL(req.url ?? "/", origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

const handler = (await import(pathToFileURL(SERVER_ENTRY).href)).default;

const server = createServer((req, res) => {
  const origin = `http://${req.headers.host ?? `localhost:${PORT}`}`;
  const pathname = new URL(req.url ?? "/", origin).pathname;

  void (async () => {
    try {
      if (await tryStatic(pathname, req, res)) return;

      // A Netlify Functions v2 handler két paramétert kap; a context-et a
      // React Router adapter csak továbbadja a loadereknek, ezért elég egy váz.
      const response = await handler(toWebRequest(req, origin), { requestId: "local" });

      const headers = Object.fromEntries(response.headers);
      const encoding = pickEncoding(req, headers["content-type"]);
      if (encoding) {
        delete headers["content-length"];
        headers["content-encoding"] = encoding.name;
        headers["vary"] = "accept-encoding";
      }

      res.writeHead(response.status, headers);
      if (!response.body) {
        res.end();
      } else if (encoding) {
        pipeline(Readable.fromWeb(response.body), encoding.stream(), res, noteBrokenPipe);
      } else {
        pipeline(Readable.fromWeb(response.body), res, noteBrokenPipe);
      }
    } catch (error) {
      console.error(`[serve-build] ${req.method} ${pathname}`, error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error");
    }
  })();
});

server.listen(PORT, () => {
  console.log(`[serve-build] http://localhost:${PORT} — a build/ produkciós kimenete`);
});
