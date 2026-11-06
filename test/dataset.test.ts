import { describe, it, expect } from "vitest";
import { generateDataset } from "../scripts/generate-data.mjs";
import { parseDataset, readDataset } from "../src/dataset.js";

describe("dataset", () => {
  const dataset = readDataset();

  it("loads the default dataset without errors", () => {
    expect(dataset.categories.length).toBeGreaterThan(0);
    expect(dataset.products.length).toBeGreaterThan(0);
    expect(dataset.vendors.length).toBeGreaterThan(0);
    expect(dataset.warehouses.length).toBeGreaterThan(0);
  });

  it("has valid referential integrity", () => {
    const categoryIds = new Set(dataset.categories.map((c) => c.id));
    const vendorIds = new Set(dataset.vendors.map((v) => v.id));
    const warehouseIds = new Set(dataset.warehouses.map((w) => w.id));

    for (const product of dataset.products) {
      expect(categoryIds.has(product.categoryId)).toBe(true);
      for (const variant of product.variants) {
        for (const offer of variant.offers) {
          expect(vendorIds.has(offer.vendorId)).toBe(true);
          expect(warehouseIds.has(offer.warehouseId)).toBe(true);
        }
      }
    }

    for (const voucher of dataset.vouchers) {
      if (voucher.categoryId) {
        expect(categoryIds.has(voucher.categoryId)).toBe(true);
      }
    }
  });

  it("each product has at least one variant with at least one offer", () => {
    for (const product of dataset.products) {
      expect(product.variants.length).toBeGreaterThan(0);
      for (const variant of product.variants) {
        expect(variant.offers.length).toBeGreaterThan(0);
      }
    }
  });

  it("warehouse packageTax is set for Austrian warehouses only", () => {
    for (const w of dataset.warehouses) {
      if (w.country === "AT") {
        expect(w.packageTax).toBe(300);
      } else {
        expect(
          w.packageTax === undefined || w.packageTax === 0,
        ).toBe(true);
      }
    }
  });
});

describe("generated JKU catalog", () => {
  it("restarts the fixed random stream and ID counter on each call", () => {
    const first = generateDataset();
    const snapshot = structuredClone(first);
    expect(generateDataset(1)).not.toEqual(snapshot);
    expect(generateDataset()).toStrictEqual(snapshot);

    first.products[0].attributes.mutated = true;
    first.products[0].variants[0].attributes.mutated = true;
    expect(generateDataset()).toStrictEqual(snapshot);
  });

  it("preserves the curated catalog and zero-cent student licenses", () => {
    const generated = parseDataset(generateDataset());
    const historical = readDataset("data/dataset.json");

    expect(generated.categories).toEqual(historical.categories);
    expect(generated.vendors).toEqual(historical.vendors);
    expect(generated.warehouses).toEqual(historical.warehouses);
    expect(generated.vouchers).toEqual(historical.vouchers);
    expect(generated.products).toHaveLength(historical.products.length);
    expect(generated.products.find(({ name }) => name === "ThinkPad X1 Carbon Student Edition")?.tags)
      .toContain("starter-set");

    const freeLicenses = generated.products.flatMap(({ variants }) => variants)
      .filter(({ name }) => name === "Free Student License");
    expect(freeLicenses.length).toBeGreaterThan(0);
    for (const license of freeLicenses) {
      expect(license.offers.length).toBeGreaterThan(0);
      expect(license.offers.every(({ price }) => price === 0)).toBe(true);
    }
  });
});
