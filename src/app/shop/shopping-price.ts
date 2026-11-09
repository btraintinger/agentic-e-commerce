const euro = new Intl.NumberFormat("en-AT", {
  style: "currency",
  currency: "EUR",
});

export function price(cents: number) {
  return euro.format(cents / 100);
}
