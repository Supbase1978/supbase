/**
 * web-push tesztek — a titkosítás/aláírás a FOGADÓ oldalról ellenőrizve
 * (roundtrip), mert a Web Push hitelessége nem „nézd meg a bájtokat"-kérdés:
 * ha a levezetés bárhol elcsúszik, a böngésző némán eldobja az üzenetet.
 */
import { describe, expect, it, vi } from "vitest";

import {
  audienceOf,
  base64urlToBytes,
  bytesToBase64url,
  createVapidJwt,
  deriveContentKeys,
  encryptWebPushPayload,
  importVapidPrivateKey,
  sendWebPush,
  type VapidKeys,
} from "./web-push";

const utf8 = new TextEncoder();

/** Teszt-VAPID kulcspár generálása (ugyanaz az alak, mint a generate-vapid.mjs). */
async function generateVapid(): Promise<VapidKeys & { verifyKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    publicKey: bytesToBase64url(raw),
    privateKey: jwk.d ?? "",
    subject: "mailto:info@sup-platform.hu",
    verifyKey: pair.publicKey,
  };
}

/** Böngésző-oldali feliratkozás szimulálása (ECDH-kulcspár + auth-titok). */
async function generateSubscriber() {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    p256dh: bytesToBase64url(raw),
    auth: bytesToBase64url(authSecret),
    privateKey: pair.privateKey,
    publicRaw: raw,
    authSecret,
  };
}

/** A böngésző dolga: aes128gcm törzs → nyílt szöveg (RFC 8188 + 8291). */
async function decryptAsSubscriber(
  body: Uint8Array<ArrayBuffer>,
  subscriber: Awaited<ReturnType<typeof generateSubscriber>>,
): Promise<string> {
  const salt = body.slice(0, 16) as Uint8Array<ArrayBuffer>;
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  expect(view.getUint32(16, false)).toBe(4096); // rs
  expect(body[20]).toBe(65); // idlen
  const senderPublic = body.slice(21, 86) as Uint8Array<ArrayBuffer>;
  const ciphertext = body.slice(86) as Uint8Array<ArrayBuffer>;

  const senderKey = await crypto.subtle.importKey(
    "raw",
    senderPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: senderKey },
      subscriber.privateKey,
      256,
    ),
  );
  const { contentEncryptionKey, nonce } = await deriveContentKeys(
    ecdhSecret,
    subscriber.authSecret,
    subscriber.publicRaw,
    senderPublic,
    salt,
  );
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const padded = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      aesKey,
      ciphertext,
    ),
  );
  expect(padded[padded.length - 1]).toBe(0x02); // utolsó rekord elválasztója
  return new TextDecoder().decode(padded.slice(0, -1));
}

describe("base64url", () => {
  it("oda-vissza konvertál (padding és +/ nélküli ábécé)", () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    const encoded = bytesToBase64url(bytes);
    expect(encoded).not.toMatch(/[=+/]/);
    expect([...base64urlToBytes(encoded)]).toEqual([...bytes]);
  });
});

describe("audienceOf", () => {
  it("a push-szolgáltató origóját adja (path nélkül)", () => {
    expect(audienceOf("https://fcm.googleapis.com/fcm/send/abc")).toBe(
      "https://fcm.googleapis.com",
    );
    expect(audienceOf("https://updates.push.services.mozilla.com/wpush/v2/xyz")).toBe(
      "https://updates.push.services.mozilla.com",
    );
  });
});

describe("createVapidJwt", () => {
  it("ES256 JWT-t ad, amit a publikus kulcs verifikál", async () => {
    const vapid = await generateVapid();
    const now = new Date("2026-07-24T10:00:00Z");
    const jwt = await createVapidJwt(
      "https://fcm.googleapis.com",
      await importVapidPrivateKey(vapid),
      vapid.subject,
      now,
    );

    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(new TextDecoder().decode(base64urlToBytes(header!)))).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    const claims = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload!)));
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:info@sup-platform.hu");
    expect(claims.exp).toBe(Math.floor(now.getTime() / 1000) + 12 * 60 * 60);

    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      vapid.verifyKey,
      base64urlToBytes(signature!),
      utf8.encode(`${header}.${payload}`),
    );
    expect(valid).toBe(true);
  });

  it("elutasítja a rossz alakú publikus kulcsot", async () => {
    await expect(
      importVapidPrivateKey({ publicKey: "AAAA", privateKey: "x", subject: "mailto:a@b" }),
    ).rejects.toThrow(/tömörítetlen P-256/);
  });
});

describe("encryptWebPushPayload", () => {
  it("a feliratkozó vissza tudja fejteni (RFC 8291 roundtrip)", async () => {
    const subscriber = await generateSubscriber();
    const message = JSON.stringify({ title: "II. fokú viharjelzés", body: "Azonnal partra!" });

    const body = await encryptWebPushPayload(
      utf8.encode(message),
      subscriber.p256dh,
      subscriber.auth,
    );

    expect(await decryptAsSubscriber(body, subscriber)).toBe(message);
  });

  it("minden híváshoz új sót és küldő-kulcsot használ", async () => {
    const subscriber = await generateSubscriber();
    const a = await encryptWebPushPayload(utf8.encode("x"), subscriber.p256dh, subscriber.auth);
    const b = await encryptWebPushPayload(utf8.encode("x"), subscriber.p256dh, subscriber.auth);
    expect(bytesToBase64url(a)).not.toBe(bytesToBase64url(b));
  });
});

describe("sendWebPush", () => {
  async function run(status: number) {
    const vapid = await generateVapid();
    const subscriber = await generateSubscriber();
    const fetchMock = vi.fn(
      async () => new Response(status >= 400 ? "hiba" : null, { status }),
    );
    const result = await sendWebPush(
      { endpoint: subscriber.endpoint, p256dh: subscriber.p256dh, auth: subscriber.auth },
      { title: "T", body: "B", url: "/spotok/x", critical: true },
      vapid,
      { fetch: fetchMock as unknown as typeof fetch },
    );
    return { result, fetchMock, vapid };
  }

  it("201-re sikeres, és a VAPID-fejlécet a szabvány szerint küldi", async () => {
    const { result, fetchMock, vapid } = await run(201);
    expect(result).toEqual({ status: 201, stale: false });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("fcm.googleapis.com");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    expect(headers.authorization).toContain(`k=${vapid.publicKey}`);
    expect(headers["content-encoding"]).toBe("aes128gcm");
    expect(headers.urgency).toBe("high"); // critical
    expect(headers.ttl).toBe("86400");
  });

  it("410-re nem dob, hanem stale-t jelez (a feliratkozás törlendő)", async () => {
    const { result } = await run(410);
    expect(result).toEqual({ status: 410, stale: true });
  });

  it("404-re szintén stale", async () => {
    const { result } = await run(404);
    expect(result.stale).toBe(true);
  });

  it("egyéb hibán dob (a hívó hibatűrése dönt)", async () => {
    await expect(run(500)).rejects.toThrow(/Push HTTP 500/);
  });
});
