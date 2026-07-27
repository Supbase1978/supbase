/**
 * Jelszó-kapu az ELŐ-ÉLES oldalra (Netlify Edge Function, Deno-runtime).
 *
 * MIÉRT KÓDBÓL: a Netlify beépített jelszó-védelme fizetős csomag-funkció; ez
 * a HTTP Basic auth minden csomagon működik, és a repóban verziózva látszik,
 * hogy a védelem létezik-e (nem egy UI-kapcsoló, amit senki nem lát).
 *
 * FAIL-CLOSED: ha a `SITE_PASSWORD` nincs beállítva, az oldal NEM válik
 * publikussá — 503-at ad. Az elfelejtett beállítás így feltűnő hiba lesz, nem
 * csendes szivárgás. Élesítéskor a védelem az env-változó TÖRLÉSÉVEL nem
 * kapcsolható ki (az 503-at adna) — helyette `SITE_PUBLIC=true` kell,
 * ami tudatos, egyértelmű döntés.
 *
 * A funkció a teljes oldalt fedi (`path: "/*"`), tehát az SSR-route-okat és a
 * statikus assetet is — részleges védelem félrevezető lenne.
 *
 * FIGYELEM: Basic auth mellett a service worker / push-feliratkozás nem
 * feltétlen működik (a böngésző nem küld auth-fejlécet minden kontextusban).
 * Ez elő-éles állapotban elfogadható; élesítéskor a kapu megszűnik.
 *
 * Ez a fájl a Deno-runtime alatt fut, ezért a repo `tsc`-je kizárja
 * (tsconfig `exclude`), mint a Supabase Edge Functionök belépőpontjait.
 */

interface NetlifyContext {
  next: () => Promise<Response>;
}

/**
 * CSAK ASCII! A HTTP-fejléc értéke nem tartalmazhat nem-ASCII karaktert — a
 * Deno `Headers` kivételt dob rá, ami az edge functiont 500-ra viszi MINDEN
 * kérésnél. (Az első éles deploy pontosan ezen bukott el: a realm-ben ékezet
 * és gondolatjel volt.) A `charset` paraméter a FELHASZNÁLÓNÉV/JELSZÓ
 * kódolására vonatkozik, nem a realm szövegére.
 */
const REALM = 'Basic realm="Suptime (pre-live)", charset="UTF-8"';

/** Időzítés-független összehasonlítás (a rövidebb bemenet se szivárogtasson). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function unauthorized(): Response {
  return new Response("Hitelesítés szükséges.", {
    status: 401,
    headers: {
      "www-authenticate": REALM,
      "content-type": "text/plain; charset=utf-8",
      // A védett oldalt keresőmotor sem indexelheti.
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

async function handle(request: Request, context: NetlifyContext): Promise<Response> {
  // Tudatos élesítés: ekkor a kapu teljesen kikapcsol.
  if (Deno.env.get("SITE_PUBLIC") === "true") {
    return await context.next();
  }

  const expectedPassword = Deno.env.get("SITE_PASSWORD");
  if (!expectedPassword) {
    // FAIL-CLOSED: hiányzó konfig NEM jelent nyitott oldalt.
    return new Response(
      "A jelszó-védelem nincs beállítva (SITE_PASSWORD). Az oldal ezért nem érhető el.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  const expectedUser = Deno.env.get("SITE_USERNAME") ?? "sup";

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length).trim());
  } catch {
    return unauthorized();
  }

  // A jelszó tartalmazhat kettőspontot — csak az ELSŐ mentén bontunk.
  const separator = decoded.indexOf(":");
  if (separator < 0) return unauthorized();
  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  if (!safeEqual(user, expectedUser) || !safeEqual(password, expectedPassword)) {
    return unauthorized();
  }

  return await context.next();
}

/**
 * Védőháló: bármilyen VÁRATLAN kivétel esetén is ZÁRVA maradunk (401), nem
 * pedig nyitva. Kezeletlen hiba mellett a Netlify 500-at ad — az sem enged be,
 * de a 401 beszédesebb, és a jelszó-ablak is előjön belőle.
 */
export default async function basicAuth(
  request: Request,
  context: NetlifyContext,
): Promise<Response> {
  try {
    return await handle(request, context);
  } catch (error) {
    console.error("basic-auth: váratlan hiba", error);
    return unauthorized();
  }
}

export const config = { path: "/*" };
