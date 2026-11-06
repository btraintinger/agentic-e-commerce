import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  users: {
    accounts: r.many.accounts({ from: r.users.id, to: r.accounts.userId }),
  },
  accounts: {
    user: r.one.users({ from: r.accounts.userId, to: r.users.id, optional: false }),
  },
  sessions: {
    user: r.one.users({ from: r.sessions.userId, to: r.users.id, optional: false }),
  },
  products: {
    variants: r.many.variants({ from: r.products.id, to: r.variants.productId }),
  },
  variants: {
    product: r.one.products({ from: r.variants.productId, to: r.products.id, optional: false }),
    offers: r.many.offers({ from: r.variants.id, to: r.offers.variantId }),
  },
  offers: {
    variant: r.one.variants({ from: r.offers.variantId, to: r.variants.id, optional: false }),
  },
}));
