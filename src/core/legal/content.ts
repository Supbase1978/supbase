/**
 * Jogi dokumentumok tartalma (F1.8) — ÁSZF + Adatvédelmi tájékoztató, kétnyelvű
 * (hu forrás, en tükör). Strukturált adat (szakasz = cím + bekezdések), a
 * `LegalPage` rendereli. A cégadatok az `entity.ts`-ből (placeholder, kitöltendő).
 *
 * FONTOS: tájékoztató jellegű, adaptált MINTA (a Hullám-projekt ÁSZF-struktúrája
 * alapján, a SUP-platformra szabva). Élesítés előtt szakjogásszal ellenőrzendő és
 * a `[KITÖLTENDŐ: …]` mezők pótlandók. NEM jogi tanács.
 */
import type { Locale } from "@core/i18n/config";

import { LEGAL_EFFECTIVE_FROM, LEGAL_ENTITY } from "./entity";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  effectiveLabel: string;
  disclaimer: string;
  sections: LegalSection[];
}

const impresszumHu: string[] = [
  `Szolgáltató neve: ${LEGAL_ENTITY.name}`,
  `Székhely: ${LEGAL_ENTITY.seat}`,
  `Adószám: ${LEGAL_ENTITY.taxNumber}`,
  `Cégjegyzék-/nyilvántartási szám: ${LEGAL_ENTITY.registrationNumber}`,
  `Nyilvántartásba vevő hatóság: ${LEGAL_ENTITY.registrationAuthority}`,
  `E-mail: ${LEGAL_ENTITY.email}`,
  `Telefon: ${LEGAL_ENTITY.phone}`,
  `Weboldal: ${LEGAL_ENTITY.website}`,
  `Tárhelyszolgáltató: ${LEGAL_ENTITY.hostingProvider}`,
];

const impresszumEn: string[] = [
  `Service provider: ${LEGAL_ENTITY.name}`,
  `Registered seat: ${LEGAL_ENTITY.seat}`,
  `Tax number: ${LEGAL_ENTITY.taxNumber}`,
  `Company/registration number: ${LEGAL_ENTITY.registrationNumber}`,
  `Registering authority: ${LEGAL_ENTITY.registrationAuthority}`,
  `Email: ${LEGAL_ENTITY.email}`,
  `Phone: ${LEGAL_ENTITY.phone}`,
  `Website: ${LEGAL_ENTITY.website}`,
  `Hosting provider: ${LEGAL_ENTITY.hostingProvider}`,
];

export const termsDocument: Record<Locale, LegalDocument> = {
  hu: {
    title: "Általános Szerződési Feltételek (ÁSZF)",
    effectiveLabel: `Hatályos: ${LEGAL_EFFECTIVE_FROM}-tól`,
    disclaimer:
      "Jelen dokumentum tájékoztató jellegű minta, amelyet a végleges élesítés előtt szakjogásszal ellenőrizni és a hiányzó adatokkal kiegészíteni szükséges.",
    sections: [
      { heading: "1. Szolgáltató adatai (Impresszum)", paragraphs: impresszumHu },
      {
        heading: "2. Az ÁSZF hatálya és elfogadása",
        paragraphs: [
          "Jelen Általános Szerződési Feltételek (a továbbiakban: ÁSZF) a Szolgáltató által üzemeltetett SUP-platformon (a továbbiakban: Platform) elérhető szolgáltatások igénybevételére vonatkoznak.",
          "A Platform használatával, illetve a regisztrációval a felhasználó (a továbbiakban: Felhasználó) elfogadja jelen ÁSZF rendelkezéseit.",
          "A Szolgáltató fenntartja a jogot az ÁSZF egyoldalú módosítására. A módosítás a Platformon történő közzététellel lép hatályba; lényeges változás esetén a bejelentkezett Felhasználók újbóli elfogadásra kerülnek felkérve.",
        ],
      },
      {
        heading: "3. A Platform szolgáltatásai",
        paragraphs: [
          "A Platform elsődlegesen tájékoztató és közösségi jellegű szolgáltatásokat nyújt SUP- (stand-up paddleboard) felhasználók számára, így különösen: deszkaválasztó (ajánló), deszka-katalógus felhasználói véleményekkel, spot-térkép aktuális vízi körülményekkel és SUP-index-szel, valamint szolgáltatói directory.",
          "A Szolgáltató fenntartja a jogot a szolgáltatások körének, tartalmának és elérhetőségének módosítására.",
        ],
      },
      {
        heading: "4. Időjárási adatok, SUP-index és biztonsági figyelmeztetés",
        paragraphs: [
          "A Platformon megjelenő időjárási adatok, vízi körülmények, SUP-index és viharjelzés kizárólag TÁJÉKOZTATÓ jellegűek, harmadik felek (pl. Open-Meteo, hivatalos viharjelző) forrásaiból származnak, és késhetnek vagy pontatlanok lehetnek.",
          "Ezek az adatok NEM minősülnek biztonsági garanciának. A vízre szállás minden esetben a Felhasználó saját felelőssége; a Felhasználó köteles a helyi viszonyokat, a hivatalos viharjelzést és saját képességeit mérlegelni. A Szolgáltató nem vállal felelősséget a Platform adataira alapozott döntésekből eredő károkért, balesetekért.",
          "Másodfokú (piros) viharjelzés esetén a vízi sporttevékenység tilos; a Platform erre figyelmeztet, de a tilalom betartása a Felhasználó felelőssége.",
        ],
      },
      {
        heading: "5. Szolgáltatói directory és érdeklődések",
        paragraphs: [
          "A szolgáltatói directoryban megjelenő szolgáltatók (kölcsönzők, túraszervezők, oktatók, szállások) harmadik felek. A Szolgáltató a köztük és a Felhasználó között létrejövő jogviszonynak NEM részese, és nem vállal felelősséget a harmadik fél szolgáltatásának minőségéért, teljesítéséért.",
          "A Felhasználó által küldött érdeklődést (lead) a Platform továbbítja az érintett szolgáltatónak. A szolgáltatóval kötött megállapodás kizárólag a Felhasználó és a szolgáltató között jön létre.",
        ],
      },
      {
        heading: "6. Felhasználói tartalom (vélemények, jelentések)",
        paragraphs: [
          "A Felhasználó által közzétett tartalomért (vélemény, értékelés, spot-jelentés) a Felhasználó felel. A Felhasználó szavatolja, hogy a tartalom valós, nem sérti harmadik fél jogait, és nem jogsértő, sértő vagy félrevezető.",
          "A Szolgáltató jogosult a jogsértő, valótlan vagy a közösségi normákat sértő tartalmat előzetes értesítés nélkül elrejteni vagy eltávolítani, illetve moderálni.",
          "A Felhasználó a tartalom közzétételével nem kizárólagos, díjmentes felhasználási jogot enged a Szolgáltatónak a tartalom Platformon való megjelenítésére.",
        ],
      },
      {
        heading: "7. Regisztráció és fiók",
        paragraphs: [
          "Egyes funkciók (pl. vélemény írása) regisztrációhoz és megerősített e-mail-címhez kötöttek. A Felhasználó felel a fiókja adatainak titkosságáért.",
          "A regisztráció és a bejelentkezés e-mail-cím és jelszó megadásával, vagy közösségi belépéssel (Google, Apple) történhet. Közösségi belépés esetén az adott szolgáltató azonosítási feltételei is irányadók.",
          "A Felhasználó bármikor kérheti fiókja törlését; a törlésre az Adatvédelmi tájékoztatóban foglaltak szerint kerül sor.",
        ],
      },
      {
        heading: "8. Szellemi tulajdon",
        paragraphs: [
          "A Platform tartalma (a felhasználói tartalom kivételével) — így a szövegek, grafikák, logók, adatszerkezet és forráskód — a Szolgáltató, illetve licencadói szellemi tulajdona. Ezek felhasználása kizárólag a Szolgáltató előzetes írásbeli engedélyével lehetséges.",
        ],
      },
      {
        heading: "9. Felelősség korlátozása",
        paragraphs: [
          "A Szolgáltató a Platformot „ahogy van” alapon nyújtja, és nem szavatolja annak folyamatos, hibamentes elérhetőségét.",
          "A Szolgáltató nem vállal felelősséget a Platform átmeneti elérhetetlenségéből, technikai hibáiból, vagy a harmadik féltől származó adatokból eredő károkért, a jogszabály által megengedett mértékben.",
        ],
      },
      {
        heading: "10. Adatkezelés",
        paragraphs: [
          "A személyes adatok kezeléséről az Adatvédelmi tájékoztató rendelkezik, amely jelen ÁSZF elválaszthatatlan részét képezi.",
        ],
      },
      {
        heading: "11. Az ÁSZF módosítása",
        paragraphs: [
          "A Szolgáltató az ÁSZF-et a mindenkori jogszabályi és üzleti környezethez igazíthatja. A hatályos verzió a Platformon mindig elérhető; a verzió és a hatálybalépés dátuma a dokumentum fejlécén szerepel.",
        ],
      },
      {
        heading: "12. Panaszkezelés és vitarendezés",
        paragraphs: [
          `A Felhasználó panaszát a Szolgáltató elérhetőségein (e-mail: ${LEGAL_ENTITY.email}) juttathatja el, amelyet a Szolgáltató a beérkezéstől számított 30 napon belül kivizsgál.`,
          "Fogyasztói jogvita esetén a Felhasználó a lakóhelye szerinti illetékes békéltető testülethez, illetve a fogyasztóvédelmi hatósághoz fordulhat. Online vitarendezés: https://ec.europa.eu/consumers/odr.",
        ],
      },
      {
        heading: "13. Irányadó jog és záró rendelkezések",
        paragraphs: [
          "Jelen ÁSZF-ben nem szabályozott kérdésekben a magyar jog, különösen a Polgári Törvénykönyv (2013. évi V. tv.), az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. tv., valamint a fogyasztóvédelemről szóló 1997. évi CLV. tv. rendelkezései az irányadók.",
        ],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    effectiveLabel: `Effective from: ${LEGAL_EFFECTIVE_FROM}`,
    disclaimer:
      "This document is an informational template that must be reviewed by a qualified lawyer and completed with the missing details before going live.",
    sections: [
      { heading: "1. Service provider details", paragraphs: impresszumEn },
      {
        heading: "2. Scope and acceptance",
        paragraphs: [
          "These Terms of Service (the “Terms”) apply to the services available on the SUP platform (the “Platform”) operated by the Service Provider.",
          "By using the Platform or by registering, the user (the “User”) accepts these Terms.",
          "The Service Provider may amend the Terms unilaterally. Amendments take effect upon publication on the Platform; for material changes, signed-in Users are asked to accept the updated Terms again.",
        ],
      },
      {
        heading: "3. Platform services",
        paragraphs: [
          "The Platform primarily provides informational and community services for SUP (stand-up paddleboard) users, including: a board advisor, a board catalog with user reviews, a spot map with current water conditions and a SUP index, and a provider directory.",
          "The Service Provider reserves the right to modify the scope, content and availability of the services.",
        ],
      },
      {
        heading: "4. Weather data, SUP index and safety notice",
        paragraphs: [
          "Weather data, water conditions, the SUP index and storm warnings shown on the Platform are for INFORMATION only, originate from third-party sources (e.g. Open-Meteo, official storm warning services), and may be delayed or inaccurate.",
          "This data does NOT constitute a safety guarantee. Going on the water is always the User's own responsibility; the User must assess local conditions, official storm warnings and their own abilities. The Service Provider accepts no liability for decisions based on Platform data.",
          "During a second-degree (red) storm warning, water sports activity is prohibited; the Platform warns of this, but compliance is the User's responsibility.",
        ],
      },
      {
        heading: "5. Provider directory and enquiries",
        paragraphs: [
          "Providers listed in the directory (rentals, tour operators, instructors, accommodation) are third parties. The Service Provider is NOT a party to any relationship between them and the User, and accepts no liability for the quality or performance of the third party's service.",
          "Enquiries (leads) submitted by the User are forwarded to the relevant provider. Any agreement is concluded solely between the User and the provider.",
        ],
      },
      {
        heading: "6. User content (reviews, reports)",
        paragraphs: [
          "The User is responsible for content they publish (reviews, ratings, spot reports). The User warrants that the content is truthful, does not infringe third-party rights, and is not unlawful, offensive or misleading.",
          "The Service Provider may hide, remove or moderate unlawful, false or community-norm-violating content without prior notice.",
          "By publishing content, the User grants the Service Provider a non-exclusive, royalty-free licence to display it on the Platform.",
        ],
      },
      {
        heading: "7. Registration and account",
        paragraphs: [
          "Some features (e.g. writing reviews) require registration and a confirmed email address. The User is responsible for the confidentiality of their account.",
          "Registration and sign-in may take place with an email address and password, or via social sign-in (Google, Apple). For social sign-in, the identification terms of the given provider also apply.",
          "The User may request deletion of their account at any time, as described in the Privacy Policy.",
        ],
      },
      {
        heading: "8. Intellectual property",
        paragraphs: [
          "The Platform's content (except user content) — texts, graphics, logos, data structures and source code — is the intellectual property of the Service Provider or its licensors, and may only be used with prior written consent.",
        ],
      },
      {
        heading: "9. Limitation of liability",
        paragraphs: [
          "The Service Provider provides the Platform “as is” and does not warrant continuous, error-free availability.",
          "To the extent permitted by law, the Service Provider is not liable for damages arising from temporary unavailability, technical faults, or third-party data.",
        ],
      },
      {
        heading: "10. Data processing",
        paragraphs: [
          "The processing of personal data is governed by the Privacy Policy, which forms an inseparable part of these Terms.",
        ],
      },
      {
        heading: "11. Amendments",
        paragraphs: [
          "The Service Provider may adapt the Terms to the prevailing legal and business environment. The current version is always available on the Platform; the version and effective date appear in the document header.",
        ],
      },
      {
        heading: "12. Complaints and dispute resolution",
        paragraphs: [
          `The User may submit complaints via the Service Provider's contact details (email: ${LEGAL_ENTITY.email}); complaints are investigated within 30 days of receipt.`,
          "In case of a consumer dispute, the User may turn to the competent conciliation body or consumer protection authority. Online dispute resolution: https://ec.europa.eu/consumers/odr.",
        ],
      },
      {
        heading: "13. Governing law and final provisions",
        paragraphs: [
          "Matters not regulated in these Terms are governed by Hungarian law, in particular the Civil Code (Act V of 2013), Act CVIII of 2001 on electronic commerce, and Act CLV of 1997 on consumer protection.",
        ],
      },
    ],
  },
};

export const privacyDocument: Record<Locale, LegalDocument> = {
  hu: {
    title: "Adatvédelmi tájékoztató",
    effectiveLabel: `Hatályos: ${LEGAL_EFFECTIVE_FROM}-tól`,
    disclaimer:
      "Jelen tájékoztató tájékoztató jellegű minta, amelyet élesítés előtt szakjogásszal (adatvédelmi szakértővel) ellenőrizni és a hiányzó adatokkal kiegészíteni szükséges.",
    sections: [
      { heading: "1. Az adatkezelő", paragraphs: impresszumHu },
      {
        heading: "2. Milyen adatokat kezelünk",
        paragraphs: [
          "Regisztráció: e-mail-cím és (titkosított) jelszó.",
          "Közösségi bejelentkezés (opcionális): Google- vagy Apple-fiókkal történő belépés esetén az adott szolgáltatótól a bejelentkezéshez szükséges azonosító adatokat (jellemzően e-mail-cím és név) kapjuk meg; jelszót ilyenkor nem kezelünk.",
          "Profil: megjelenített név, valamint opcionálisan testsúly, tapasztalati szint és nyelvi beállítás — a deszkaválasztó személyre szabásához.",
          "Felhasználói tartalom: vélemények, értékelések, spot-jelentések és az azokhoz kapcsolódó adatok.",
          "Szolgáltatói érdeklődés (lead): név, e-mail-cím és üzenet, amelyet a kiválasztott szolgáltatónak továbbítunk.",
          "Beleegyezés-napló: az elfogadott feltételek fajtája, verziója és időpontja.",
          "Technikai adatok: a bejelentkezéshez szükséges munkamenet-süti (session cookie) és a bot-védelemhez szükséges adatok.",
        ],
      },
      {
        heading: "3. Az adatkezelés céljai és jogalapjai",
        paragraphs: [
          "A fiók működtetése és a szolgáltatás nyújtása — jogalap: a szerződés teljesítése (GDPR 6. cikk (1) b)).",
          "A deszkaválasztó személyre szabása — jogalap: a Felhasználó hozzájárulása (GDPR 6. cikk (1) a)).",
          "Jogi kötelezettségek teljesítése és igényérvényesítés — jogalap: jogos érdek, illetve jogi kötelezettség (GDPR 6. cikk (1) c), f)).",
        ],
      },
      {
        heading: "4. Adatfeldolgozók és címzettek",
        paragraphs: [
          `Az adatok kezeléséhez a következő fő adatfeldolgozókat vesszük igénybe: ${LEGAL_ENTITY.dataProcessors}.`,
          "Szolgáltatói érdeklődés esetén a megadott adatokat az érintett (harmadik fél) szolgáltatónak továbbítjuk. Adatait harmadik országba csak a megfelelő garanciák mellett továbbítjuk.",
        ],
      },
      {
        heading: "5. Sütik és helyi tárolás",
        paragraphs: [
          "A Platform a bejelentkezéshez feltétlenül szükséges munkamenet-sütit használ. Analitikai vagy marketing célú sütik csak külön hozzájárulással kerülnek elhelyezésre.",
          "Használati statisztikát süti és eszköz-azonosító NÉLKÜL vezetünk: a szerver összesített darabszámot rögzít bizonyos eseményekről (pl. hányszor nyitották meg a deszkaválasztót). Ehhez sem sütit, sem látogató-azonosítót nem helyezünk el, és IP-címet sem tárolunk — az így keletkező adat nem alkalmas az Ön azonosítására, és egyéni felhasználói út nem követhető belőle. Ha böngészője Do Not Track vagy Global Privacy Control jelzést küld, a mérést teljesen mellőzzük.",
        ],
      },
      {
        heading: "6. Adatmegőrzés",
        paragraphs: [
          "A fiók adatait a fiók fennállásáig, illetve a jogszabályi kötelezettségek teljesítéséhez szükséges ideig kezeljük. Fiók törlése esetén az adatokat töröljük vagy anonimizáljuk; a felhasználói tartalom anonimizált formában megmaradhat.",
        ],
      },
      {
        heading: "7. Az érintett jogai",
        paragraphs: [
          "A Felhasználót megilleti a hozzáférés, helyesbítés, törlés („elfeledtetés”), az adatkezelés korlátozása, az adathordozhatóság és a tiltakozás joga, valamint a hozzájárulás bármikori visszavonásának joga.",
          `E jogok gyakorlását a(z) ${LEGAL_ENTITY.email} címen kezdeményezheti.`,
        ],
      },
      {
        heading: "8. Adatbiztonság és kiskorúak",
        paragraphs: [
          "A Szolgáltató a személyes adatokat megfelelő technikai és szervezési intézkedésekkel védi. A Platform nem kiskorúak számára készült; 16 év alatti személy adatait tudatosan nem kezeljük.",
        ],
      },
      {
        heading: "9. Panasz és jogorvoslat",
        paragraphs: [
          "Az érintett panaszával a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH, https://naih.hu) fordulhat, illetve bírósági jogorvoslattal élhet.",
        ],
      },
      {
        heading: "10. A tájékoztató módosítása",
        paragraphs: [
          "A Szolgáltató a jelen tájékoztatót módosíthatja; a hatályos verzió a Platformon mindig elérhető, a verzió és a hatálybalépés dátuma a fejlécen szerepel.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    effectiveLabel: `Effective from: ${LEGAL_EFFECTIVE_FROM}`,
    disclaimer:
      "This document is an informational template that must be reviewed by a qualified (data protection) lawyer and completed with the missing details before going live.",
    sections: [
      { heading: "1. Data controller", paragraphs: impresszumEn },
      {
        heading: "2. What data we process",
        paragraphs: [
          "Registration: email address and (hashed) password.",
          "Social sign-in (optional): when signing in with a Google or Apple account, we receive the identifying data required for sign-in from that provider (typically email and name); we do not handle a password in that case.",
          "Profile: display name, and optionally body weight, experience level and language preference — to personalize the board advisor.",
          "User content: reviews, ratings, spot reports and related data.",
          "Provider enquiries (leads): name, email address and message, forwarded to the chosen provider.",
          "Consent log: the type, version and time of accepted terms.",
          "Technical data: the session cookie required for sign-in, and data required for bot protection.",
        ],
      },
      {
        heading: "3. Purposes and legal bases",
        paragraphs: [
          "Operating the account and providing the service — legal basis: performance of a contract (GDPR Art. 6(1)(b)).",
          "Personalizing the board advisor — legal basis: the User's consent (GDPR Art. 6(1)(a)).",
          "Meeting legal obligations and asserting claims — legal basis: legitimate interest or legal obligation (GDPR Art. 6(1)(c), (f)).",
        ],
      },
      {
        heading: "4. Processors and recipients",
        paragraphs: [
          `We use the following main processors: ${LEGAL_ENTITY.dataProcessors}.`,
          "For provider enquiries, the data you provide is forwarded to the relevant (third-party) provider. Any transfer to a third country takes place only with appropriate safeguards.",
        ],
      },
      {
        heading: "5. Cookies and local storage",
        paragraphs: [
          "The Platform uses a session cookie strictly necessary for sign-in. Analytics or marketing cookies are only set with separate consent.",
          "Usage statistics are collected WITHOUT cookies or device identifiers: the server records aggregate counts of certain events (for example how many times the board advisor was opened). No cookie, no visitor identifier and no IP address is stored — the resulting data cannot identify you, and no individual user journey can be reconstructed from it. If your browser sends a \"Do Not Track\" or \"Global Privacy Control\" signal, we skip the measurement entirely.",
        ],
      },
      {
        heading: "6. Data retention",
        paragraphs: [
          "Account data is processed while the account exists and as required to meet legal obligations. On account deletion, data is deleted or anonymized; user content may remain in anonymized form.",
        ],
      },
      {
        heading: "7. Your rights",
        paragraphs: [
          "The User has the right of access, rectification, erasure (“right to be forgotten”), restriction of processing, data portability and objection, as well as the right to withdraw consent at any time.",
          `You can exercise these rights at ${LEGAL_ENTITY.email}.`,
        ],
      },
      {
        heading: "8. Security and minors",
        paragraphs: [
          "The Service Provider protects personal data with appropriate technical and organizational measures. The Platform is not intended for minors; we do not knowingly process data of persons under 16.",
        ],
      },
      {
        heading: "9. Complaints and remedies",
        paragraphs: [
          "You may lodge a complaint with the Hungarian data protection authority (NAIH, https://naih.hu) or seek a judicial remedy.",
        ],
      },
      {
        heading: "10. Changes to this policy",
        paragraphs: [
          "The Service Provider may amend this policy; the current version is always available on the Platform, with the version and effective date shown in the header.",
        ],
      },
    ],
  },
};
