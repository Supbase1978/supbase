/**
 * schema.org JSON-LD builderek (FEJLESZTESI_DOKUMENTACIO 6. fejezet, 3. pont).
 * Minden builder tiszta függvény, sima objektumot ad vissza; a szerializálást
 * a `jsonLdScript` végzi (XSS-biztos: `<` karakter escape-elve).
 */

export type JsonLdObject = Record<string, unknown>;

export interface JsonLdOffer {
  price: number;
  priceCurrency: string;
  url?: string;
  availability?:
    | "https://schema.org/InStock"
    | "https://schema.org/OutOfStock"
    | "https://schema.org/PreOrder"
    | "https://schema.org/LimitedAvailability";
}

export interface JsonLdAggregateRating {
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

export interface JsonLdReview {
  author: string;
  reviewBody?: string;
  datePublished?: string;
  reviewRating: {
    ratingValue: number;
    bestRating?: number;
    worstRating?: number;
  };
}

export interface ProductJsonLdInput {
  name: string;
  description?: string;
  image?: string | string[];
  brand?: string;
  sku?: string;
  url?: string;
  aggregateRating?: JsonLdAggregateRating;
  reviews?: JsonLdReview[];
  offers?: JsonLdOffer | JsonLdOffer[];
}

/** `Product` + `AggregateRating` + `Review` (Népítélet) + `Offer` (board_prices) — deszka-adatlap. */
export function productJsonLd(input: ProductJsonLdInput): JsonLdObject {
  const jsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
  };

  if (input.description) jsonLd.description = input.description;
  if (input.image) jsonLd.image = input.image;
  if (input.brand) jsonLd.brand = { "@type": "Brand", name: input.brand };
  if (input.sku) jsonLd.sku = input.sku;
  if (input.url) jsonLd.url = input.url;

  if (input.aggregateRating) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.aggregateRating.ratingValue,
      reviewCount: input.aggregateRating.reviewCount,
      bestRating: input.aggregateRating.bestRating ?? 5,
      worstRating: input.aggregateRating.worstRating ?? 1,
    };
  }

  if (input.reviews && input.reviews.length > 0) {
    jsonLd.review = input.reviews.map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.author },
      reviewBody: review.reviewBody,
      datePublished: review.datePublished,
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.reviewRating.ratingValue,
        bestRating: review.reviewRating.bestRating ?? 5,
        worstRating: review.reviewRating.worstRating ?? 1,
      },
    }));
  }

  if (input.offers) {
    const offers = Array.isArray(input.offers) ? input.offers : [input.offers];
    jsonLd.offers = offers.map((offer) => ({
      "@type": "Offer",
      price: offer.price,
      priceCurrency: offer.priceCurrency,
      url: offer.url,
      availability: offer.availability,
    }));
  }

  return jsonLd;
}

export interface PlaceJsonLdInput {
  name: string;
  description?: string;
  url?: string;
  image?: string;
  latitude: number;
  longitude: number;
}

/** `Place` + `geo` — spot-adatlap. */
export function placeJsonLd(input: PlaceJsonLdInput): JsonLdObject {
  const jsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: input.name,
    geo: {
      "@type": "GeoCoordinates",
      latitude: input.latitude,
      longitude: input.longitude,
    },
  };

  if (input.description) jsonLd.description = input.description;
  if (input.url) jsonLd.url = input.url;
  if (input.image) jsonLd.image = input.image;

  return jsonLd;
}

export interface LocalBusinessAddress {
  streetAddress?: string;
  addressLocality?: string;
  postalCode?: string;
  addressCountry?: string;
}

export interface LocalBusinessJsonLdInput {
  name: string;
  description?: string;
  url?: string;
  image?: string;
  telephone?: string;
  email?: string;
  address?: LocalBusinessAddress;
  latitude?: number;
  longitude?: number;
}

/** `LocalBusiness` — szolgáltatói (B2B directory) profil. */
export function localBusinessJsonLd(input: LocalBusinessJsonLdInput): JsonLdObject {
  const jsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.name,
  };

  if (input.description) jsonLd.description = input.description;
  if (input.url) jsonLd.url = input.url;
  if (input.image) jsonLd.image = input.image;
  if (input.telephone) jsonLd.telephone = input.telephone;
  if (input.email) jsonLd.email = input.email;
  if (input.address) {
    jsonLd.address = { "@type": "PostalAddress", ...input.address };
  }
  if (input.latitude !== undefined && input.longitude !== undefined) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }

  return jsonLd;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** `FAQPage` — GYIK-blokkok. */
export function faqPageJsonLd(items: FaqItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * JSON-LD objektum szerializálása `<script type="application/ld+json">`
 * tartalomhoz. XSS-biztos: a `<` karaktert `<`-re escape-eli, hogy a
 * kimenet ne zárhasson/nyithasson script-tag-et akkor sem, ha a bemenet
 * felhasználói adatot tartalmaz (pl. review szöveg).
 */
export function jsonLdScript(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
