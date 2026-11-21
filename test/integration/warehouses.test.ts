import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { client } from "../support/trpc-client";

vi.mock("server-only", () => ({}));

describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL warehouses", () => {
  const api = client();

  it("lists warehouses in UUID order and includes package tax only where it applies", async () => {
    const warehouses = await api.warehouses.list.query();

    expect(warehouses).toHaveLength(4);
    const ids = warehouses.map(({ id }) => z.uuid().parse(id));
    expect(ids).toEqual([...ids].sort());

    const austrian = warehouses.filter(({ country }) => country === "AT");
    expect(austrian).toHaveLength(2);
    for (const warehouse of austrian) {
      expect(warehouse.packageTax).toBe(300);
    }
    for (const warehouse of warehouses.filter(
      ({ country }) => country !== "AT",
    )) {
      expect(warehouse).not.toHaveProperty("packageTax");
    }
  });
});
