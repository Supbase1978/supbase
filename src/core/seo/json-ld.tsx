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
  // A tartalom a jsonLdScript-en át escape-elt — ez a JSON-LD beszúrás bevett,
  // biztonságos mintája (nem HTML, hanem `<`-mentesített JSON).
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}
