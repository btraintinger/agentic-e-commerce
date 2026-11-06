import { and, gt, sql } from "drizzle-orm";
import { seed } from "drizzle-seed";

import { categories, offers, products, variants, vendors, vouchers, warehouses } from "./schema";
import { replaceCatalog } from "./seed-catalog";

const sampleCategories = [
  {
    id: "sample-electronics",
    name: "Electronics & Gadgets",
    description: "Laptops and accessories for campus and home.",
    prices: [2_500, 240_000],
    productNames: [
      "ThinkPad X1 Carbon Student Edition", "Framework 13 Laptop", "IdeaPad Slim Laptop",
      "USB-C Travel Hub", "Noise-Cancelling Headphones", "Compact Mechanical Keyboard",
      "Portable Monitor", "Graphing Tablet",
    ],
  },
  {
    id: "sample-stationery",
    name: "Textbooks & Stationery",
    description: "Study materials, notebooks, and writing supplies.",
    prices: [250, 9_500],
    productNames: [
      "Discrete Mathematics Workbook", "Algorithms Study Guide", "Grid Study Notebook",
      "Campus Weekly Planner", "Mechanical Pencil Set", "Whiteboard Marker Set",
      "Scientific Calculator", "Index Cards",
    ],
  },
  {
    id: "sample-clothing",
    name: "Campus Clothing",
    description: "Everyday clothing for lectures, labs, and commutes.",
    prices: [1_200, 19_000],
    productNames: [
      "Campus Hoodie", "Rain Jacket", "Kepler T-Shirt", "Campus Fleece",
      "Canvas Sneakers", "Lab Overshirt", "Winter Beanie", "Commuter Gloves",
    ],
  },
  {
    id: "sample-accessories",
    name: "Campus Accessories",
    description: "Everyday carry for the university.",
    prices: [700, 15_000],
    productNames: [
      "Campus Backpack", "Kepler Tote", "Insulated Water Bottle", "Folding Umbrella",
      "Bike Light Set", "Bento Lunch Box", "Travel Mug", "Laptop Sleeve",
    ],
  },
];

const sampleVendors = [
  { id: "sample-campus-shop", name: "Campus Shop", rating: 4.8, position: 0 },
  { id: "sample-study-supply", name: "Study Supply", rating: 4.5, position: 1 },
  { id: "sample-technik-shop", name: "Technik Shop", rating: 4.3, position: 2 },
];

const sampleWarehouses = [
  { id: "sample-linz", name: "Linz", country: "AT", packageTax: 300, position: 0 },
  { id: "sample-wien", name: "Wien", country: "AT", packageTax: 300, position: 1 },
  { id: "sample-muenchen", name: "München", country: "DE", position: 2 },
];

const seedTables = { products, variants, offers };

export function seedSampleCatalog(db: Parameters<typeof replaceCatalog>[0]) {
  return replaceCatalog(db, async (tx) => {
    await tx.insert(categories).values(sampleCategories.map(({ id, name, description }, position) => ({
      id, name, description, position,
    })));
    await tx.insert(vendors).values(sampleVendors);
    await tx.insert(warehouses).values(sampleWarehouses);

    let productCount = 0;
    for (const [index, category] of sampleCategories.entries()) {
      const count = category.productNames.length;
      const [minPrice, maxPrice] = category.prices;

      await seed(tx, seedTables, { seed: 2026 + index, version: "2" }).refine((f) => ({
        products: {
          count,
          with: { variants: 2 },
          columns: {
            id: f.uuid(),
            categoryId: f.default({ defaultValue: category.id }),
            name: f.valuesFromArray({ values: category.productNames, isUnique: true }),
            description: f.default({ defaultValue: category.description }),
            brand: f.default({ defaultValue: null }),
            tags: f.default({ defaultValue: ["sample", category.id.slice("sample-".length)] }),
            attributes: f.default({ defaultValue: {} }),
            position: f.int({ minValue: productCount, maxValue: productCount + count - 1, isUnique: true }),
          },
        },
        variants: {
          with: { offers: 3 },
          columns: {
            id: f.uuid(),
            sku: f.string({ isUnique: true }),
            name: f.valuesFromArray({ values: ["Standard", "Plus", "Compact"] }),
            attributes: f.default({ defaultValue: {} }),
            position: f.intPrimaryKey(),
          },
        },
        offers: {
          columns: {
            id: f.uuid(),
            vendorId: f.valuesFromArray({ values: sampleVendors.map(({ id }) => id) }),
            warehouseId: f.valuesFromArray({ values: sampleWarehouses.map(({ id }) => id) }),
            price: f.int({ minValue: minPrice, maxValue: maxPrice }),
            shippingCost: f.valuesFromArray({ values: [
              { weight: 0.75, values: [0] },
              { weight: 0.25, values: [399, 599, 899] },
            ] }),
            freeShippingThreshold: f.default({ defaultValue: null }),
            deliveryMin: f.int({ minValue: 1, maxValue: 4 }),
            deliveryMax: f.int({ minValue: 4, maxValue: 9 }),
            stock: f.valuesFromArray({ values: [
              { weight: 0.10, values: ["NO"] },
              { weight: 0.25, values: ["LITTLE"] },
              { weight: 0.65, values: ["ALOT"] },
            ] }),
            position: f.intPrimaryKey(),
          },
        },
      }));
      productCount += count;
    }

    await tx.update(offers).set({ freeShippingThreshold: 5_000 }).where(and(
      gt(offers.shippingCost, 0),
      sql`${offers.position} % 2 = 0`,
    ));
    await tx.insert(vouchers).values([
      { code: "WELCOME10", type: "percent", value: 10, description: "10% off your order" },
      { code: "STUDENT20", type: "percent", value: 20, categoryId: "sample-clothing", description: "20% off campus clothing" },
      { code: "FLAT500", type: "fixed", value: 500, description: "500 cents off your order" },
      { code: "GROSSORDER15", type: "percent", value: 15, minOrderValue: 30_000, description: "15% off orders of €300 or more" },
      { code: "EXPIRED2024", type: "percent", value: 15, validUntil: "2024-12-31", description: "Expired voucher example" },
    ]);

    return { products: productCount, categories: sampleCategories.length };
  });
}
