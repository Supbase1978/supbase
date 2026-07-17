/**
 * Provider-választó — F1-ben mindig `NoopPaymentProvider` (7. fejezet).
 * F3-ban itt kapcsolódik be a Stripe-alapú implementáció, feature-flag
 * vagy env-alapú választással; a hívó oldalak (`getPaymentProvider()`)
 * nem változnak.
 */
import { NoopPaymentProvider } from "./NoopPaymentProvider";
import type { PaymentProvider } from "./PaymentProvider";

export type {
  CheckoutOrder,
  CheckoutResult,
  Entitlement,
  EntitlementStatus,
  InvoiceRequest,
  InvoiceResult,
  OrderKind,
  PaymentProvider,
  WebhookEvent,
  WebhookResult,
} from "./PaymentProvider";
export { NoopPaymentProvider } from "./NoopPaymentProvider";

export function getPaymentProvider(): PaymentProvider {
  return new NoopPaymentProvider();
}
