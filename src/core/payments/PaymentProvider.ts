/**
 * Fizetés-készenlét interfész (FEJLESZTESI_DOKUMENTACIO 7. fejezet).
 * F1-ben egyetlen implementáció létezik: `NoopPaymentProvider` (mindent
 * elutasít, logol). A séma-részletek (orders tábla, provider.tier) F1.2-ben
 * készülnek — a típusok itt szándékosan szűkek, csak a kapcsolódási pontot
 * rögzítik F3 (Stripe Checkout + Connect) előkészítéseként.
 */

export type OrderKind = "booking" | "subscription" | "listing_upgrade";

export interface CheckoutOrder {
  id: string;
  userId: string;
  kind: OrderKind;
  amountHuf: number;
  currency: "HUF";
  payload?: Record<string, unknown>;
}

export interface CheckoutResult {
  ok: boolean;
  /** Fizetési oldal URL-je sikeres esetben (Stripe Checkout session, F3). */
  redirectUrl?: string;
  error?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  receivedAt: string;
  payload: Record<string, unknown>;
}

export interface WebhookResult {
  ok: boolean;
  error?: string;
}

export type EntitlementStatus = "active" | "expired" | "none";

export interface Entitlement {
  kind: OrderKind;
  status: EntitlementStatus;
  expiresAt?: string;
}

export interface InvoiceRequest {
  orderId: string;
  buyerName: string;
  buyerEmail: string;
}

export interface InvoiceResult {
  ok: boolean;
  invoiceUrl?: string;
  error?: string;
}

export interface PaymentProvider {
  createCheckout(order: CheckoutOrder): Promise<CheckoutResult>;
  handleWebhook(event: WebhookEvent): Promise<WebhookResult>;
  getEntitlements(userId: string): Promise<Entitlement[]>;
  /** F3: szamlazz.hu/Billingo API — opcionális hook, F1-ben nincs implementáció. */
  createInvoice?(request: InvoiceRequest): Promise<InvoiceResult>;
}
