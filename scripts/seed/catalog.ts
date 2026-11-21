import { v5 as uuidV5 } from "uuid";
import type * as tables from "@/server/db/schema";
import {
  accessoryProducts,
  clothingProducts,
  electronicsProducts,
  jkuMerchProducts,
  softwareProducts,
  textbookProducts,
} from "./products";

export const seedNumber = 202627;
const namespace = "2a9674f3-c9b7-4a89-b8d4-cf68a092e90f";

function id(key: string) {
  return uuidV5(key, namespace);
}

function integer(key: string, min: number, max: number) {
  const seed = Number.parseInt(id(`${seedNumber}:${key}`).slice(0, 8), 16);
  return min + (seed % (max - min + 1));
}

const groups = [
  {
    key: "electronics",
    name: "Electronics & Gadgets",
    description: "Laptops, headphones and tech essentials for JKU students",
    templates: electronicsProducts,
  },
  {
    key: "textbooks",
    name: "Textbooks & Stationery",
    description: "Academic textbooks, notebooks and study supplies",
    templates: textbookProducts,
  },
  {
    key: "merch",
    name: "JKU Merchandise & Apparel",
    description: "Official JKU Linz apparel and merchandise",
    templates: jkuMerchProducts,
  },
  {
    key: "clothing",
    name: "Campus Clothing",
    description: "Jackets, shoes and everyday clothing for campus life",
    templates: clothingProducts,
  },
  {
    key: "software",
    name: "Software & Subscriptions",
    description: "Software, cloud storage and academic licenses",
    templates: softwareProducts,
  },
  {
    key: "accessories",
    name: "Campus Accessories",
    description:
      "Backpacks, bottles, umbrellas and everyday campus accessories",
    templates: accessoryProducts,
  },
] as const;

type CategoryKey = (typeof groups)[number]["key"];
type ProductTemplate = (typeof electronicsProducts)[number];
type VariantChoice = {
  name: string;
  price: number;
  attributes: tables.CatalogAttributes;
};
type OfferDraft = Omit<
  typeof tables.offers.$inferInsert,
  "deliveryDaysMin" | "deliveryDaysMax" | "stock"
>;

const vendors = [
  { id: id("vendor:jku"), name: "JKU Campus Shop", rating: 4.8 },
  { id: id("vendor:amazon"), name: "Amazon.at", rating: 4.6 },
  { id: id("vendor:mediamarkt"), name: "MediaMarkt", rating: 4.3 },
  { id: id("vendor:thalia"), name: "Thalia.at", rating: 4.1 },
  { id: id("vendor:rs"), name: "RS Components", rating: 4.0 },
] satisfies (typeof tables.vendors.$inferInsert)[];

const warehouses = [
  {
    id: id("warehouse:linz"),
    name: "Linz (JKU Campus)",
    country: "AT",
    packageTax: 300,
  },
  { id: id("warehouse:wien"), name: "Wien", country: "AT", packageTax: 300 },
  {
    id: id("warehouse:munich"),
    name: "München",
    country: "DE",
    packageTax: null,
  },
  {
    id: id("warehouse:amsterdam"),
    name: "Amsterdam",
    country: "NL",
    packageTax: null,
  },
] satisfies (typeof tables.warehouses.$inferInsert)[];

const vouchers = [
  {
    code: "WELCOME10",
    type: "percent",
    value: 10,
    description: "10% off your first order",
  },
  {
    code: "STUDENT20",
    type: "percent",
    value: 20,
    categoryId: id("category:clothing"),
    description: "20% off campus clothing",
  },
  {
    code: "FLAT500",
    type: "fixed",
    value: 500,
    description: "500 cents off any order",
  },
  {
    code: "MINORDER3000",
    type: "fixed",
    value: 1000,
    minOrderValue: 5000,
    description: "1000 cents off orders over 5000 cents",
  },
  {
    code: "EXPIRED2024",
    type: "percent",
    value: 15,
    validUntil: "2024-12-31",
    description: "15% off (expired)",
  },
  {
    code: "JKULINZ10",
    type: "percent",
    value: 10,
    categoryId: id("category:merch"),
    description: "10% off JKU merchandise",
  },
  {
    code: "NEAREXPIRY",
    type: "percent",
    value: 10,
    validUntil: "2030-08-31",
    description: "10% off until August 2030",
  },
  {
    code: "GROSSORDER15",
    type: "percent",
    value: 15,
    minOrderValue: 30000,
    description: "15% off orders over €300",
  },
] satisfies (typeof tables.vouchers.$inferInsert)[];

const starterProducts = new Set([
  "JKU Hoodie Premium",
  "JKU T-Shirt Classic",
  "JKU Tote Bag Canvas",
  "JKU Coffee Mug Ceramic",
  "JKU Water Bottle Stainless",
  "ThinkPad X1 Carbon Student Edition",
  "MacBook Air M3 Student Bundle",
  "Introduction to Algorithms (CLRS)",
  "Calculus: Early Transcendentals",
  "Campus Backpack Waterproof 30L",
  "Rain Jacket Campus Edition",
  "Campus Hoodie Essentials",
]);

const availableTags = [
  "new",
  "bestseller",
  "sale",
  "trending",
  "limited",
  "premium",
  "budget",
  "eco-friendly",
  "wireless",
  "waterproof",
  "lightweight",
  "durable",
  "ergonomic",
  "gaming",
  "professional",
  "student",
  "travel",
  "home",
  "top-rated",
  "exclusive",
];

const vendorProfiles = [
  { warehouses: [0], multiplier: 1, paidPercent: 0, paidCosts: [0] },
  {
    warehouses: [0, 1, 2, 3],
    multiplier: 0.98,
    paidPercent: 5,
    paidCosts: [295, 395],
  },
  {
    warehouses: [1, 2],
    multiplier: 1.02,
    paidPercent: 15,
    paidCosts: [395, 495, 595],
  },
  {
    warehouses: [0, 1, 2],
    multiplier: 0.95,
    paidPercent: 15,
    paidCosts: [395, 495, 595],
  },
  {
    warehouses: [1, 2, 3],
    multiplier: 0.85,
    paidPercent: 40,
    paidCosts: [295, 395, 495, 595, 695],
  },
];

const shoeNames = new Set([
  "Casual Sneakers Court",
  "Trail Running Shoes",
  "Leather Chelsea Boots",
  "Hiking Boots Waterproof",
]);

function variantChoices(
  category: CategoryKey,
  template: ProductTemplate,
  key: string,
): VariantChoice[] {
  const { basePrice, name, attrs } = template;
  switch (category) {
    case "electronics":
      return [
        { ram: 8, storage: "256GB SSD", surcharge: 2000 },
        { ram: 16, storage: "512GB SSD", surcharge: 4000 },
        { ram: 32, storage: "1TB SSD", surcharge: 8000 },
        { ram: 64, storage: "2TB SSD", surcharge: 15000 },
      ]
        .slice(0, integer(key, 2, 4))
        .map(({ ram, storage, surcharge }) => ({
          name: `${ram}GB / ${storage}`,
          price: basePrice + ram * 1500 + surcharge,
          attributes: { ram, storage },
        }));
    case "textbooks":
      return ["Paperback", "Hardcover"]
        .slice(0, integer(key, 1, 2))
        .map((format) => ({
          name: format,
          price: basePrice + (format === "Hardcover" ? 2000 : 0),
          attributes: { format },
        }));
    case "merch":
      return ["S", "M", "L", "XL", "XXL"]
        .slice(0, integer(key, 3, 5))
        .map((size) => ({
          name: size,
          price: basePrice + (size.length > 1 ? 500 : 0),
          attributes: { size },
        }));
    case "clothing": {
      const color = typeof attrs.color === "string" ? attrs.color : "Black";
      const gender = name.startsWith("Men's ")
        ? "male"
        : name.startsWith("Women's ")
          ? "female"
          : "unisex";
      if (shoeNames.has(name)) {
        return [38, 39, 40, 41, 42, 43, 44]
          .slice(0, integer(key, 4, 7))
          .map((size) => ({
            name: `EU ${size}`,
            price: basePrice + (size > 43 ? 500 : 0),
            attributes: { size, color, gender },
          }));
      }
      const sizes =
        gender === "female"
          ? ["XS", "S", "M", "L", "XL"]
          : ["S", "M", "L", "XL", "XXL"];
      return sizes.slice(0, integer(key, 3, 5)).map((size) => ({
        name: `${size} / ${color}`,
        price: basePrice + (size === "XL" || size === "XXL" ? 500 : 0),
        attributes: { size, color, gender },
      }));
    }
    case "software":
      if (basePrice === 0)
        return [
          {
            name: "Free Student License",
            price: 0,
            attributes: { duration: "1 Year", price_type: "Free" },
          },
        ];
      return ["1 Year", "2 Year", "Perpetual"]
        .slice(0, integer(key, 1, 3))
        .map((duration, index) => ({
          name: duration,
          price: Math.round(basePrice * [1, 1.8, 2.5][index]),
          attributes: { duration },
        }));
    case "accessories":
      return ["Black", "White", "Navy", "Grey"]
        .slice(0, integer(key, 2, 4))
        .map((color) => ({
          name: color,
          price: basePrice + (color === "Navy" ? 500 : 0),
          attributes: { color },
        }));
  }
}

function createOffers(variantId: string, basePrice: number): OfferDraft[] {
  const preferredVendors = vendors
    .map((vendor, index) => ({ vendor, profile: vendorProfiles[index] }))
    .sort(
      (a, b) =>
        integer(`${variantId}:${a.vendor.id}`, 0, 9999) -
        integer(`${variantId}:${b.vendor.id}`, 0, 9999),
    );
  const count =
    basePrice === 0 ? integer(variantId, 1, 2) : integer(variantId, 2, 4);
  return preferredVendors.slice(0, count).map(({ vendor, profile }) => {
    const offerId = id(`offer:${variantId}:${vendor.id}`);
    const warehouse =
      warehouses[
        profile.warehouses[
          integer(`${offerId}:warehouse`, 0, profile.warehouses.length - 1)
        ]
      ];
    const price =
      Math.round(
        (basePrice *
          profile.multiplier *
          integer(`${offerId}:price`, 92, 108)) /
          10_000,
      ) * 100;
    const paid = integer(`${offerId}:paid`, 1, 100) <= profile.paidPercent;
    const shippingCost = paid
      ? profile.paidCosts[
          integer(`${offerId}:shipping`, 0, profile.paidCosts.length - 1)
        ]
      : 0;
    return {
      id: offerId,
      variantId,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      price,
      currency: "EUR",
      shippingCost,
      freeShippingThreshold: shippingCost > 0 ? price * 3 : null,
    };
  });
}

export function buildCatalog() {
  const categories: (typeof tables.categories.$inferInsert)[] = [];
  const products: (typeof tables.products.$inferInsert)[] = [];
  const variants: (typeof tables.variants.$inferInsert)[] = [];
  const offers: OfferDraft[] = [];

  for (const { key, name, description, templates } of groups) {
    const categoryId = id(`category:${key}`);
    categories.push({ id: categoryId, name, description });

    for (const template of templates) {
      const productId = id(`product:${key}:${template.name}`);
      const start = integer(
        `${productId}:tag-offset`,
        0,
        availableTags.length - 1,
      );
      const count = integer(`${productId}:tag-count`, 1, 4);
      const tags = new Set(template.tags);
      for (let offset = 0; offset < count; offset++)
        tags.add(availableTags[(start + offset) % availableTags.length]);
      if (starterProducts.has(template.name.replace(/^(Men's |Women's )/, "")))
        tags.add("starter-set");
      products.push({
        id: productId,
        categoryId,
        name: template.name,
        description: template.desc,
        brand: template.brand,
        tags: [...tags],
        attributes: template.attrs,
      });

      for (const choice of variantChoices(key, template, productId)) {
        const variantId = id(`variant:${productId}:${choice.name}`);
        variants.push({
          id: variantId,
          productId,
          name: choice.name,
          sku: `${template.brand.slice(0, 3).toUpperCase()}-${variantId.slice(0, 8).toUpperCase()}`,
          attributes: choice.attributes,
        });
        offers.push(...createOffers(variantId, choice.price));
      }
    }
  }

  return {
    categories,
    products,
    variants,
    offers,
    vendors,
    warehouses,
    vouchers,
  };
}
