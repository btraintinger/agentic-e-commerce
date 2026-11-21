import type { z } from "zod";
import type { cartInput } from "./input";
import type {
  offers,
  products,
  variants,
  vouchers,
  warehouses,
} from "@/server/db/schema";

export interface CartOffer {
  offer: typeof offers.$inferSelect;
  productId: typeof products.$inferSelect.id;
  variantId: typeof variants.$inferSelect.id;
  productName: typeof products.$inferSelect.name;
  variantName: typeof variants.$inferSelect.name;
  categoryId: typeof products.$inferSelect.categoryId;
  packageTax: typeof warehouses.$inferSelect.packageTax;
}

type Voucher = typeof vouchers.$inferSelect;
type StockLevel = typeof offers.$inferSelect.stock;
type ValidateRequest = z.infer<typeof cartInput>;

type CartIssueCode =
  | "OFFER_NOT_FOUND"
  | "INVALID_QUANTITY"
  | "OUT_OF_STOCK"
  | "VOUCHER_NOT_FOUND"
  | "VOUCHER_EXPIRED"
  | "VOUCHER_MIN_ORDER_NOT_MET";

interface CartIssue {
  code: CartIssueCode;
  message: string;
  offerId?: string;
}

interface ShipmentItem {
  offerId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface Shipment {
  vendorId: string;
  warehouseId: string;
  items: ShipmentItem[];
  itemsSubtotal: number;
  shippingCost: number;
  /** flat per-shipment tax for this shipment's warehouse (e.g. €3 Paketsteuer) */
  packageTax: number;
  deliveryDays: { min: number; max: number };
}

interface Totals {
  items: number;
  /** sum over shipments of (shippingCost + packageTax) */
  shipping: number;
  discount: number;
  grand: number;
}

interface ValidateResponse {
  valid: boolean;
  issues: CartIssue[];
  shipments: Shipment[];
  totals: Totals;
  deliveryDays: { min: number; max: number } | null;
  packageCount: number;
}

function stockAvailable(level: StockLevel): number {
  if (level === "NO") return 0;
  if (level === "LITTLE") return 10;
  return 9999;
}

export function validateCart(
  request: ValidateRequest,
  offers: CartOffer[],
  voucher: Voucher | undefined,
  now: Date,
): ValidateResponse {
  const issues: CartIssue[] = [];
  const validItems: { entry: CartOffer; item: ShipmentItem }[] = [];
  const offerMap = new Map(offers.map((entry) => [entry.offer.id, entry]));

  for (const item of request.items) {
    const entry = offerMap.get(item.offerId.toLowerCase());

    if (!entry) {
      issues.push({
        code: "OFFER_NOT_FOUND",
        message: `Offer ${item.offerId} not found`,
        offerId: item.offerId,
      });
      continue;
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      issues.push({
        code: "INVALID_QUANTITY",
        message: `Invalid quantity ${item.quantity} for offer ${item.offerId}`,
        offerId: item.offerId,
      });
      continue;
    }

    if (item.quantity > stockAvailable(entry.offer.stock)) {
      issues.push({
        code: "OUT_OF_STOCK",
        message: `Insufficient stock for offer ${item.offerId}: requested ${item.quantity}, available ${entry.offer.stock}`,
        offerId: item.offerId,
      });
      continue;
    }

    validItems.push({
      entry,
      item: {
        offerId: item.offerId,
        productId: entry.productId,
        variantId: entry.variantId,
        productName: entry.productName,
        variantName: entry.variantName,
        quantity: item.quantity,
        unitPrice: entry.offer.price,
        lineTotal: entry.offer.price * item.quantity,
      },
    });
  }

  const shipmentMap = new Map<string, Shipment>();
  for (const { item, entry } of validItems) {
    const key = `${entry.offer.vendorId}-${entry.offer.warehouseId}`;

    let shipment = shipmentMap.get(key);
    if (!shipment) {
      shipment = {
        vendorId: entry.offer.vendorId,
        warehouseId: entry.offer.warehouseId,
        items: [],
        itemsSubtotal: 0,
        shippingCost: 0,
        packageTax: entry.packageTax ?? 0,
        deliveryDays: { min: 0, max: 0 },
      };
      shipmentMap.set(key, shipment);
    }
    shipment.items.push(item);
    shipment.itemsSubtotal += item.lineTotal;
  }

  for (const shipment of shipmentMap.values()) {
    let rawShippingCost = 0;
    let maxMin = 0;
    let maxMax = 0;
    let hasFreeShipping = false;

    for (const item of shipment.items) {
      const { offer } = offerMap.get(item.offerId.toLowerCase())!;
      rawShippingCost += offer.shippingCost * item.quantity;
      maxMin = Math.max(maxMin, offer.deliveryDaysMin);
      maxMax = Math.max(maxMax, offer.deliveryDaysMax);
      if (
        offer.freeShippingThreshold !== null &&
        shipment.itemsSubtotal >= offer.freeShippingThreshold
      ) {
        hasFreeShipping = true;
      }
    }

    shipment.shippingCost = hasFreeShipping ? 0 : rawShippingCost;
    shipment.deliveryDays = { min: maxMin, max: maxMax };
  }

  const shipments = Array.from(shipmentMap.values());

  const deliveryDays =
    shipments.length > 0
      ? {
          min: Math.max(...shipments.map((s) => s.deliveryDays.min)),
          max: Math.max(...shipments.map((s) => s.deliveryDays.max)),
        }
      : null;

  const itemsTotal = validItems.reduce(
    (sum, { item }) => sum + item.lineTotal,
    0,
  );
  let discount = 0;

  if (request.voucherCode) {
    if (!voucher) {
      issues.push({
        code: "VOUCHER_NOT_FOUND",
        message: `Voucher ${request.voucherCode} not found`,
      });
    } else if (voucher.validUntil && new Date(voucher.validUntil) < now) {
      issues.push({
        code: "VOUCHER_EXPIRED",
        message: `Voucher ${request.voucherCode} expired on ${voucher.validUntil}`,
      });
    } else if (
      voucher.minOrderValue !== null &&
      itemsTotal < voucher.minOrderValue
    ) {
      issues.push({
        code: "VOUCHER_MIN_ORDER_NOT_MET",
        message: `Minimum order value of ${voucher.minOrderValue}c not met (subtotal: ${itemsTotal}c)`,
      });
    } else {
      const eligibleSubtotal = voucher.categoryId
        ? validItems.reduce(
            (sum, { item, entry }) =>
              sum +
              (entry.categoryId === voucher.categoryId ? item.lineTotal : 0),
            0,
          )
        : itemsTotal;
      const amount =
        voucher.type === "percent"
          ? Math.round(eligibleSubtotal * (voucher.value / 100))
          : voucher.value;
      discount = Math.min(amount, eligibleSubtotal);
    }
  }

  const shippingTotal = shipments.reduce(
    (sum, s) => sum + s.shippingCost + s.packageTax,
    0,
  );
  const grand = itemsTotal + shippingTotal - discount;

  return {
    valid: issues.length === 0,
    issues,
    shipments,
    totals: { items: itemsTotal, shipping: shippingTotal, discount, grand },
    deliveryDays,
    packageCount: shipments.length,
  };
}
