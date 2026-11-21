# tRPC API

The public endpoint is `/api/trpc`. TypeScript consumers use the exported
[`AppRouter`](../src/server/api/root.ts) type and configure their tRPC client
with SuperJSON. An external frontend can call the endpoint from its server.

## Procedures

| Procedure             | Behavior                                                  | Former REST operation          |
| --------------------- | --------------------------------------------------------- | ------------------------------ |
| `health.check`        | Returns `{ status: "ok" }`.                               | `GET /health`                  |
| `categories.list`     | Lists categories.                                         | `GET /categories`              |
| `categories.products` | Lists products for a category ID.                         | `GET /categories/:id/products` |
| `products.list`       | Filters by `category`, `q`, `minPrice`, and `maxPrice`.   | `GET /products`                |
| `products.byId`       | Returns the product, variants, and offers.                | `GET /products/:id`            |
| `vendors.list`        | Lists vendors.                                            | `GET /vendors`                 |
| `vendors.byId`        | Returns the vendor.                                       | `GET /vendors/:id`             |
| `warehouses.list`     | Lists warehouses.                                         | `GET /warehouses`              |
| `cart.validate`       | Validates cart items and calculates shipments and totals. | `POST /validate`               |

## Catalog rules

- Search matches substrings in names, descriptions, brands, and tags without
  regard to case.
- A product matches a price range when one offer satisfies both bounds. All
  money values use integer euro cents.
- Read UUIDs from the catalog for product, vendor, category, and offer lookups.
  `products.byId`, `vendors.byId`, and `categories.products` return tRPC
  `NOT_FOUND` for unknown IDs.

## Cart validation

Call `cart.validate` as a mutation with
`{ items: [{ offerId, quantity }], voucherCode? }`. The result includes
issues, shipments, totals, delivery days, and package count.

Valid items are grouped by vendor and warehouse. Shipping can be waived when a
shipment meets a free-shipping threshold. Austrian warehouses add a flat
300-cent package tax per shipment. Voucher codes are checked only during cart
validation and can discount eligible items.

Each app instance allows five validation calls per IP in a fixed 60-second
window. Additional calls return tRPC `TOO_MANY_REQUESTS`. Local HTTP requests
use a shared loopback bucket. The counters live in process memory and reset at
restart.
