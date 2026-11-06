import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { generateDataset } from "../scripts/generate-data.mjs";
import { parseDataset } from "../src/dataset.js";

describe("dataset", () => {
  const dataset = parseDataset(generateDataset());

  it("includes the curated JKU catalog", () => {
    expect(dataset.categories.map(({ name }) => name)).toEqual([
      "Electronics & Gadgets",
      "Textbooks & Stationery",
      "JKU Merchandise & Apparel",
      "Campus Clothing",
      "Software & Subscriptions",
      "Campus Accessories",
    ]);
    expect(dataset.products).toHaveLength(201);
    expect(dataset.vendors).toHaveLength(5);
    expect(dataset.vendors.map(({ name }) => name)).toContain("JKU Campus Shop");
    expect(dataset.warehouses.map(({ country }) => country)).toEqual(["AT", "AT", "DE", "NL"]);
    expect(dataset.vouchers.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "WELCOME10", "STUDENT20", "FLAT500", "MINORDER3000", "EXPIRED2024",
    ]));
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

  it("requires an explicit export path and can read back a JSON export", () => {
    const cwd = mkdtempSync(join(tmpdir(), "jku-export-"));
    const generator = fileURLToPath(new URL("../scripts/generate-data.mjs", import.meta.url));
    const dataDir = join(cwd, "data");
    try {
      mkdirSync(dataDir);

      const missingPath = spawnSync(process.execPath, [generator], { cwd, encoding: "utf8" });
      expect(missingPath.status).toBe(1);
      expect(missingPath.stderr).toContain("Usage: node scripts/generate-data.mjs <output-path>");
      expect(readdirSync(dataDir)).toEqual([]);

      const output = join(cwd, "generated.json");
      const explicitPath = spawnSync(process.execPath, [generator, output], { cwd, encoding: "utf8" });
      expect(explicitPath.status).toBe(0);
      const exported = readFileSync(output, "utf-8");
      const dataset = generateDataset();
      expect(exported).toBe(JSON.stringify(dataset, null, 2));
      expect(parseDataset(JSON.parse(exported))).toEqual(parseDataset(dataset));
      expect(readdirSync(dataDir)).toEqual([]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("keeps the starter-set tag and zero-cent student licenses", () => {
    const generated = parseDataset(generateDataset());
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
