/**
 * F1-es alapértelmezett `PaymentProvider`: minden hívást strukturáltan
 * elutasít és `console.warn`-nal logol — a fizetés F1-ben nincs bekapcsolva
 * (7. fejezet), de a hívási felület (route, webhook-váz) már F1-ben áll.
 */
import type {
  CheckoutOrder,
  CheckoutResult,
  Entitlement,
  PaymentProvider,
  WebhookEvent,
  WebhookResult,
} from "./PaymentProvider";

const DISABLED_MESSAGE = "A fizetési funkció F1-ben nincs bekapcsolva (NoopPaymentProvider).";

export class NoopPaymentProvider implements PaymentProvider {
  createCheckout(order: CheckoutOrder): Promise<CheckoutResult> {
    console.warn(
      `NoopPaymentProvider.createCheckout elutasítva — order: ${order.id} (${order.kind}).`,
    );
    return Promise.resolve({ ok: false, error: DISABLED_MESSAGE });
  }

  handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    console.warn(
      `NoopPaymentProvider.handleWebhook elutasítva — event: ${event.id} (${event.type}).`,
    );
    return Promise.resolve({ ok: false, error: DISABLED_MESSAGE });
  }

  getEntitlements(userId: string): Promise<Entitlement[]> {
    console.warn(
      `NoopPaymentProvider.getEntitlements: nincs jogosultság (userId: ${userId}) — fizetés nincs bekapcsolva.`,
    );
    return Promise.resolve([]);
  }
}
