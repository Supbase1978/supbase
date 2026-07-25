/**
 * Web Push küldés natív Web Crypto API-val (F1.9, 9. fejezet).
 *
 * NINCS npm-függőség: az `npm:web-push` csomag Deno edge-környezetben
 * megbízhatatlan, ezért a VAPID JWT (ES256) és az RFC 8291 payload-titkosítás
 * (aes128gcm) itt, kézzel, `crypto.subtle`-lel készül. A modul így Deno- ÉS
 * Node/Vitest-semleges marad (`_shared` szerződés): a hálózat injektált
 * `fetch`-en át jön, más I/O nincs.
 *
 * Szabványok: RFC 8292 (VAPID) · RFC 8291 (Message Encryption) · RFC 8188
 * (aes128gcm content coding).
 */

/**
 * Bájttömb ArrayBuffer-háttérrel. A csupasz `Uint8Array` a TS 5.7+ libjében
 * `Uint8Array<ArrayBufferLike>`, ami NEM `BufferSource` (SharedArrayBuffer is
 * lehetne) — a `crypto.subtle` hívások emiatt nem fogadnák el.
 */
type Bytes = Uint8Array<ArrayBuffer>;

/** Egy böngésző-feliratkozás (a PushSubscription.toJSON() lényege). */
export interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** A szerver-oldali VAPID azonosság. A privát kulcs TITOK (Supabase secret). */
export interface VapidKeys {
  /** base64url, 65 bájtos tömörítetlen P-256 pont (0x04 || X || Y). */
  publicKey: string;
  /** base64url, a JWK `d` mezője (32 bájt). */
  privateKey: string;
  /** `mailto:` vagy `https:` kontakt (RFC 8292 `sub`). */
  subject: string;
}

/** A push-üzenet hasznos tartalma (a service worker ezt kapja JSON-ként). */
export interface WebPushPayload {
  title: string;
  body: string;
  /** Kattintásra megnyitandó relatív útvonal. */
  url?: string;
  /** Notification tag — azonos tag felülírja a korábbi értesítést. */
  tag?: string;
  /** Kritikus riasztás (II. fok): a SW `requireInteraction`-nel jeleníti meg. */
  critical?: boolean;
}

export interface SendWebPushDeps {
  fetch: typeof fetch;
  /** Injektálható „most" (JWT `exp`-hez) — tesztelhetőség. */
  now?: () => Date;
  /** Time-to-live másodpercben (default 86400). */
  ttlSeconds?: number;
}

export interface SendWebPushResult {
  status: number;
  /** true, ha a feliratkozás végleg érvénytelen (404/410) → törlendő. */
  stale: boolean;
}

// ── base64url segédek ───────────────────────────────────────────────────────

export function base64urlToBytes(value: string): Bytes {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesToBase64url(bytes: Bytes): string {
  // Darabolva: a `String.fromCharCode(...bytes)` spread nagy tömbnél
  // stack-overflow-t okozhat.
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function concatBytes(...parts: Bytes[]): Bytes {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const utf8 = new TextEncoder();

// ── VAPID (RFC 8292) ────────────────────────────────────────────────────────

/**
 * A VAPID privát kulcs importja aláíráshoz. A publikus kulcsból vesszük az
 * X/Y koordinátát (a JWK-hoz kell), a privátból a `d`-t.
 */
export async function importVapidPrivateKey(keys: VapidKeys): Promise<CryptoKey> {
  const publicBytes = base64urlToBytes(keys.publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) {
    throw new Error("VAPID publikus kulcs: 65 bájtos tömörítetlen P-256 pont kell.");
  }
  return await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64url(publicBytes.slice(1, 33)),
      y: bytesToBase64url(publicBytes.slice(33, 65)),
      d: keys.privateKey,
      key_ops: ["sign"],
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** A push-szolgáltató origója (a JWT `aud`-ja) az endpoint URL-ből. */
export function audienceOf(endpoint: string): string {
  const url = new URL(endpoint);
  return `${url.protocol}//${url.host}`;
}

/** VAPID JWT (ES256). Lejárat: 12 óra (a szabvány max. 24-et enged). */
export async function createVapidJwt(
  audience: string,
  privateKey: CryptoKey,
  subject: string,
  now: Date = new Date(),
): Promise<string> {
  const encode = (value: object) => bytesToBase64url(utf8.encode(JSON.stringify(value)));
  const header = encode({ typ: "JWT", alg: "ES256" });
  const payload = encode({
    aud: audience,
    exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
    sub: subject,
  });
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    utf8.encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${bytesToBase64url(new Uint8Array(signature))}`;
}

// ── Payload-titkosítás (RFC 8291 + RFC 8188) ────────────────────────────────

/** Rekord-méret; a payloadjaink jóval kisebbek, ezért egyetlen rekord. */
const RECORD_SIZE = 4096;

async function hkdf(
  salt: Bytes,
  ikm: Bytes,
  info: Bytes,
  lengthBits: number,
): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    lengthBits,
  );
  return new Uint8Array(bits);
}

/**
 * A közös titok → tartalomkulcs (CEK) + nonce levezetése. Kiemelve, mert a
 * teszt a fogadó oldalról UGYANEZT futtatja (roundtrip-visszafejtés).
 */
export async function deriveContentKeys(
  ecdhSecret: Bytes,
  authSecret: Bytes,
  receiverPublic: Bytes,
  senderPublic: Bytes,
  salt: Bytes,
): Promise<{ contentEncryptionKey: Bytes; nonce: Bytes }> {
  const ikm = await hkdf(
    authSecret,
    ecdhSecret,
    concatBytes(utf8.encode("WebPush: info\0"), receiverPublic, senderPublic),
    256,
  );
  const contentEncryptionKey = await hkdf(
    salt,
    ikm,
    utf8.encode("Content-Encoding: aes128gcm\0"),
    128,
  );
  const nonce = await hkdf(salt, ikm, utf8.encode("Content-Encoding: nonce\0"), 96);
  return { contentEncryptionKey, nonce };
}

/**
 * RFC 8291 titkosítás. A kimenet a teljes aes128gcm törzs:
 * `salt(16) | rs(4, big-endian) | idlen(1=65) | küldő-pubkulcs(65) | ciphertext`.
 */
export async function encryptWebPushPayload(
  plaintext: Bytes,
  p256dh: string,
  auth: string,
): Promise<Bytes> {
  const receiverPublic = base64urlToBytes(p256dh);
  const authSecret = base64urlToBytes(auth);

  const receiverKey = await crypto.subtle.importKey(
    "raw",
    receiverPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const senderPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const senderPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", senderPair.publicKey),
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: receiverKey },
      senderPair.privateKey,
      256,
    ),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { contentEncryptionKey, nonce } = await deriveContentKeys(
    ecdhSecret,
    authSecret,
    receiverPublic,
    senderPublic,
    salt,
  );

  // Egyetlen (egyben utolsó) rekord → 0x02 elválasztó a padding helyén.
  const padded = concatBytes(plaintext, new Uint8Array([0x02]));
  if (padded.length + 16 > RECORD_SIZE) {
    throw new Error("A push-payload nem fér egyetlen aes128gcm rekordba.");
  }

  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      aesKey,
      padded,
    ),
  );

  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = 65;
  header.set(senderPublic, 21);

  return concatBytes(header, ciphertext);
}

// ── Küldés ──────────────────────────────────────────────────────────────────

/**
 * Egy push kiküldése. A 404/410 választ NEM hibaként, hanem `stale: true`-ként
 * adja vissza (a feliratkozás törlendő); minden más nem-2xx dob.
 */
export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: WebPushPayload,
  vapid: VapidKeys,
  deps: SendWebPushDeps,
): Promise<SendWebPushResult> {
  const privateKey = await importVapidPrivateKey(vapid);
  const jwt = await createVapidJwt(
    audienceOf(subscription.endpoint),
    privateKey,
    vapid.subject,
    (deps.now ?? (() => new Date()))(),
  );
  const body = await encryptWebPushPayload(
    utf8.encode(JSON.stringify(payload)),
    subscription.p256dh,
    subscription.auth,
  );

  const response = await deps.fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      "content-type": "application/octet-stream",
      "content-encoding": "aes128gcm",
      ttl: String(deps.ttlSeconds ?? 86400),
      urgency: payload.critical ? "high" : "normal",
    },
    body: body as BodyInit,
  });

  if (response.status === 404 || response.status === 410) {
    return { status: response.status, stale: true };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Push HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return { status: response.status, stale: false };
}
