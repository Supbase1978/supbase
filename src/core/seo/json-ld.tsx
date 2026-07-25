/**
 * JSON-LD `<script>` komponens (6. fejezet). A loader tiszta `JsonLdObject`-et
 * ad át (szerializálható loaderData); a szerializálás itt, renderkor történik a
 * `jsonLdScript`-tel, ami XSS-biztos (a `<` karaktert `<`-re escape-eli, így
 * felhasználói adat — pl. vélemény-szöveg — sem zárhat script-taget).
 */
import { jsonLdScript, type JsonLdObject } from "./jsonld";

export interface JsonLdProps {
  data: JsonLdObject;
}

export function JsonLd({ data }: JsonLdProps) {
  // BIZTONSÁGI TRIAGE (Semgrep react-dangerouslysetinnerhtml, F1.10 audit):
  // ez a találat itt FALSE POSITIVE, és a projekt egyetlen innerHTML-pontja.
  // Indoklás: a `<script>` elemen belül a HTML-parser kizárólag a `<`
  // karakterrel léptethető ki (`</script`, `<!--`) — a `jsonLdScript` pedig
  // MINDEN `<`-et `<`-re cserél, ami JSON-ban ekvivalens szöveg, HTML-ben
  // viszont ártalmatlan. Így felhasználói tartalom (vélemény-szöveg,
  // szolgáltató-név) sem tud script-taget zárni. Regressziót a
  // `jsonld.test.ts` „</script><script>alert(1)" esete véd.
  // A DOMPurify itt nem alkalmazható: nem HTML-t, hanem JSON-t szúrunk be.
  return (
    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}
