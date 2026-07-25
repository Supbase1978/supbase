#!/usr/bin/env node
/**
 * VAPID kulcspár-generátor (F1.9 — Web Push).
 *
 * Nem használ npm-függőséget: a Node beépített Web Crypto API-jával generál
 * ECDSA P-256 kulcspárt, és a Web Push által várt base64url-alakban írja ki
 * (publikus = 65 bájtos, tömörítetlen raw pont; privát = a JWK `d` mezője).
 *
 * Használat:  node scripts/generate-vapid.mjs
 *
 * A PRIVÁT kulcs TITOK — a script nem a képernyőre, hanem a gitignore-olt
 * `.vapid.json` fájlba írja. Onnan másold:
 *   - VAPID_PRIVATE_KEY + VAPID_SUBJECT → Supabase Edge Function secrets
 *   - VAPID_PUBLIC_KEY → `.env` VITE_VAPID_PUBLIC_KEY (publikus, bundle-be kerül)
 *     ÉS a Supabase secrets közé is (a küldő oldal is használja).
 */
import { writeFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

function bytesToBase64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const rawPublic = new Uint8Array(await webcrypto.subtle.exportKey("raw", publicKey));
const jwk = await webcrypto.subtle.exportKey("jwk", privateKey);

if (rawPublic.length !== 65 || rawPublic[0] !== 0x04) {
  throw new Error("Váratlan publikus kulcs-alak (nem tömörítetlen P-256 pont).");
}

const out = {
  VAPID_PUBLIC_KEY: bytesToBase64url(rawPublic),
  VAPID_PRIVATE_KEY: jwk.d,
  VAPID_SUBJECT: "mailto:info@sup-platform.hu",
  generatedAt: new Date().toISOString(),
};

writeFileSync(".vapid.json", `${JSON.stringify(out, null, 2)}\n`, { mode: 0o600 });

console.log("VAPID kulcspár kiírva: .vapid.json (gitignore-olt, 0600)\n");
console.log(`VITE_VAPID_PUBLIC_KEY=${out.VAPID_PUBLIC_KEY}\n`);
console.log("A PRIVÁT kulcs a fájlban van (nem íratom ki a terminálra).");
console.log("Következő lépés:");
console.log("  npm run sb -- secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=...");
