import { describe, expect, it } from "vitest";
import { validateCart, type CartOffer } from "@/server/cart/validate";
import type { vouchers } from "@/server/db/schema";

const now = new Date("2026-11-20T12:00:00Z");

const laptop: CartOffer = {
  offer: {
    id: "laptop",
    variantId: "laptop-16gb",
    vendorId: "campus",
    warehouseId: "linz",
    price: 2500,
    currency: "EUR",
    shippingCost: 495,
    freeShippingThreshold: 5000,
    deliveryDaysMin: 1,
    deliveryDaysMax: 3,
    stock: "ALOT",
  },
  productId: "student-laptop",
  productName: "Student Laptop",
  variantId: "laptop-16gb",
  variantName: "16GB",
  categoryId: "electronics",
  packageTax: 300,
};

const mug: CartOffer = {
  ...laptop,
  offer: {
    ...laptop.offer,
    id: "mug",
    price: 500,
    shippingCost: 0,
    freeShippingThreshold: null,
    stock: "LITTLE",
  },
  productId: "campus-mug",
  productName: "Campus Mug",
  categoryId: "merch",
};

const textbook: CartOffer = {
  ...laptop,
  offer: {
    ...laptop.offer,
    id: "book",
    warehouseId: "munich",
    price: 1500,
    shippingCost: 395,
    freeShippingThreshold: null,
    deliveryDaysMin: 2,
    deliveryDaysMax: 5,
  },
  productId: "algorithms",
  productName: "Algorithms",
  variantName: "Paperback",
  categoryId: "textbooks",
  packageTax: null,
};

const baseVoucher: typeof vouchers.$inferSelect = {
  code: "SAVE10",
  type: "percent",
  value: 10,
  categoryId: null,
  minOrderValue: null,
  validUntil: null,
  description: "10% off",
};

const oneLaptop = { offerId: "laptop", quantity: 1 };
const oneMug = { offerId: "mug", quantity: 1 };
const oneBook = { offerId: "book", quantity: 1 };

function validate(
  items: { offerId: string; quantity: number }[],
  voucher?: typeof vouchers.$inferSelect,
) {
  const unavailable = {
    ...mug,
    offer: { ...mug.offer, id: "unavailable", stock: "NO" as const },
  };
  return validateCart(
    { items, voucherCode: voucher?.code },
    [laptop, mug, textbook, unavailable],
    voucher,
    now,
  );
}

const emptyTotals = { items: 0, shipping: 0, discount: 0, grand: 0 };

describe("validateCart", () => {
  it("returns an empty result for an empty cart", () => {
    expect(validate([])).toEqual({
      valid: true,
      issues: [],
      shipments: [],
      totals: emptyTotals,
      deliveryDays: null,
      packageCount: 0,
    });
  });

  it("excludes unknown offers, invalid quantities and unavailable stock from the totals", () => {
    const result = validate([
      { offerId: "unknown", quantity: 1 },
      { offerId: "laptop", quantity: 1.5 },
      { offerId: "mug", quantity: 0 },
      { offerId: "mug", quantity: 11 },
      { offerId: "unavailable", quantity: 1 },
      oneLaptop,
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "OFFER_NOT_FOUND",
      "INVALID_QUANTITY",
      "INVALID_QUANTITY",
      "OUT_OF_STOCK",
      "OUT_OF_STOCK",
    ]);
    expect(result.totals).toEqual({
      items: 2500,
      shipping: 795,
      discount: 0,
      grand: 3295,
    });
    expect(result.shipments[0].items.map((item) => item.offerId)).toEqual([
      "laptop",
    ]);
  });

  it("returns no shipments if every item is invalid", () => {
    const result = validate([
      { offerId: "missing", quantity: 1 },
      { offerId: "unavailable", quantity: 1 },
    ]);
    expect(result).toMatchObject({
      valid: false,
      shipments: [],
      totals: emptyTotals,
      deliveryDays: null,
      packageCount: 0,
    });
    expect(result.issues).toHaveLength(2);
  });

  it("groups by both vendor and warehouse and charges package tax once per Austrian shipment", () => {
    const mugFromAnotherVendor = {
      ...mug,
      offer: { ...mug.offer, vendorId: "marketplace", id: "market-mug" },
    };
    const result = validateCart(
      {
        items: [
          oneLaptop,
          oneMug,
          oneBook,
          { offerId: "market-mug", quantity: 1 },
        ],
      },
      [laptop, mug, textbook, mugFromAnotherVendor],
      undefined,
      now,
    );
    expect(result.valid).toBe(true);
    expect(
      result.shipments.map(
        ({ vendorId, warehouseId, packageTax, shippingCost, items }) => [
          vendorId,
          warehouseId,
          packageTax,
          shippingCost,
          items.length,
        ],
      ),
    ).toEqual([
      ["campus", "linz", 300, 495, 2],
      ["campus", "munich", 0, 395, 1],
      ["marketplace", "linz", 300, 0, 1],
    ]);
    expect(result.packageCount).toBe(3);
    expect(result.totals.shipping).toBe(1490);
    expect(result.deliveryDays).toEqual({ min: 2, max: 5 });
  });

  it("uses the slowest item for delivery and waives all shipping at the inclusive threshold", () => {
    const slowMug = {
      ...mug,
      offer: {
        ...mug.offer,
        price: 2500,
        shippingCost: 295,
        deliveryDaysMin: 2,
        deliveryDaysMax: 7,
      },
    };
    const result = validateCart(
      { items: [oneLaptop, oneMug] },
      [laptop, slowMug],
      undefined,
      now,
    );
    expect(result.shipments[0]).toMatchObject({
      itemsSubtotal: 5000,
      shippingCost: 0,
      packageTax: 300,
      deliveryDays: { min: 2, max: 7 },
    });
    expect(result.totals).toEqual({
      items: 5000,
      shipping: 300,
      discount: 0,
      grand: 5300,
    });
  });

  it("multiplies shipping by quantity below the threshold", () => {
    const highThreshold = {
      ...laptop,
      offer: { ...laptop.offer, freeShippingThreshold: 8000 },
    };
    const result = validateCart(
      { items: [{ ...oneLaptop, quantity: 2 }] },
      [highThreshold],
      undefined,
      now,
    );
    expect(result.totals).toEqual({
      items: 5000,
      shipping: 1290,
      discount: 0,
      grand: 6290,
    });
  });

  it("applies percentage vouchers to item subtotals and fixed vouchers only to eligible items", () => {
    expect(validate([oneLaptop, oneMug], baseVoucher).totals.discount).toBe(
      300,
    );
    expect(
      validate([oneLaptop, oneMug], { ...baseVoucher, categoryId: "merch" })
        .totals.discount,
    ).toBe(50);
    expect(
      validate([oneLaptop, oneMug], {
        ...baseVoucher,
        type: "fixed",
        value: 1500,
        categoryId: "merch",
      }).totals.discount,
    ).toBe(500);
    expect(
      validate([oneMug], { ...baseVoucher, type: "fixed", value: 1500 }).totals
        .discount,
    ).toBe(500);
  });

  it("rejects expired, missing and minimum-order vouchers while keeping item and shipping totals", () => {
    const expired = validate([oneLaptop], {
      ...baseVoucher,
      validUntil: "2024-12-31",
    });
    const belowMinimum = validate([oneLaptop], {
      ...baseVoucher,
      minOrderValue: 5000,
    });
    const missing = validateCart(
      { items: [oneLaptop], voucherCode: "MISSING" },
      [laptop],
      undefined,
      now,
    );
    expect(expired.issues[0]?.code).toBe("VOUCHER_EXPIRED");
    expect(belowMinimum.issues[0]?.code).toBe("VOUCHER_MIN_ORDER_NOT_MET");
    expect(missing.issues[0]?.code).toBe("VOUCHER_NOT_FOUND");
    for (const result of [expired, belowMinimum, missing]) {
      expect(result.valid).toBe(false);
      expect(result.totals).toEqual({
        items: 2500,
        shipping: 795,
        discount: 0,
        grand: 3295,
      });
    }
  });

  it("accepts a live voucher on an empty cart and validates its minimum against the full subtotal", () => {
    expect(
      validate([], { ...baseVoucher, validUntil: "2030-08-31" }),
    ).toMatchObject({ valid: true, totals: emptyTotals });
    expect(
      validate([], { ...baseVoucher, minOrderValue: 100 }).issues[0]?.code,
    ).toBe("VOUCHER_MIN_ORDER_NOT_MET");
    const result = validate([oneLaptop, oneMug], {
      ...baseVoucher,
      minOrderValue: 3000,
      categoryId: "merch",
    });
    expect(result).toMatchObject({ valid: true, totals: { discount: 50 } });
  });
});
