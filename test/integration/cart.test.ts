import { describe, expect, it, vi } from "vitest";
import { client } from "../support/trpc-client";

vi.mock("server-only", () => ({}));

describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL cart", () => {
  const api = client();

  it("validates an uppercase offer ID and returns joined shipment details and totals", async () => {
    const listed = await api.products.list.query({ q: "ThinkPad X1" });
    const warehouses = await api.warehouses.list.query();
    const austrianIds = new Set(
      warehouses.filter(({ country }) => country === "AT").map(({ id }) => id),
    );
    const available = listed
      .flatMap((product) =>
        product.variants.flatMap((variant) =>
          variant.offers.map((offer) => ({ product, variant, offer })),
        ),
      )
      .find(
        ({ offer }) =>
          offer.stock === "ALOT" && austrianIds.has(offer.warehouseId),
      );
    if (!available) throw new Error("Expected an in-stock offer from Austria");
    const { product, variant, offer } = available;
    const offerId = offer.id.toUpperCase();
    const discount = Math.round(offer.price * 0.1);
    const shippingCost = offer.shippingCost;
    const result = await api.cart.validate.mutate({
      items: [{ offerId, quantity: 1 }],
      voucherCode: "WELCOME10",
    });
    expect(result).toEqual({
      valid: true,
      issues: [],
      packageCount: 1,
      deliveryDays: offer.deliveryDays,
      shipments: [
        {
          vendorId: offer.vendorId,
          warehouseId: offer.warehouseId,
          items: [
            {
              offerId,
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              variantName: variant.name,
              quantity: 1,
              unitPrice: offer.price,
              lineTotal: offer.price,
            },
          ],
          itemsSubtotal: offer.price,
          shippingCost,
          packageTax: 300,
          deliveryDays: offer.deliveryDays,
        },
      ],
      totals: {
        items: offer.price,
        discount,
        shipping: shippingCost + 300,
        grand: offer.price + shippingCost + 300 - discount,
      },
    });
  });

  it("excludes malformed, missing and out-of-stock offers from shipments", async () => {
    const products = await api.products.list.query();
    const unavailable = products
      .flatMap(({ variants }) => variants.flatMap(({ offers }) => offers))
      .find(({ stock }) => stock === "NO");
    if (!unavailable) throw new Error("Expected an out-of-stock seeded offer");
    const missing = "00000000-0000-4000-8000-000000000000";
    const result = await api.cart.validate.mutate({
      items: [
        { offerId: "unknown-offer", quantity: 1 },
        { offerId: missing, quantity: 1 },
        { offerId: unavailable.id, quantity: 1 },
      ],
    });
    expect(result).toMatchObject({
      valid: false,
      issues: [
        { code: "OFFER_NOT_FOUND", offerId: "unknown-offer" },
        { code: "OFFER_NOT_FOUND", offerId: missing },
        { code: "OUT_OF_STOCK", offerId: unavailable.id },
      ],
      shipments: [],
      totals: { items: 0, shipping: 0, discount: 0, grand: 0 },
      deliveryDays: null,
      packageCount: 0,
    });
  });

  it.each([
    ["MINORDER3000", "VOUCHER_MIN_ORDER_NOT_MET"],
    ["UNKNOWN-TEST-VOUCHER", "VOUCHER_NOT_FOUND"],
  ])("checks voucher %s on an empty cart", async (voucherCode, code) => {
    await expect(
      api.cart.validate.mutate({ items: [], voucherCode }),
    ).resolves.toMatchObject({
      valid: false,
      issues: [{ code }],
      totals: { discount: 0 },
    });
  });
});
