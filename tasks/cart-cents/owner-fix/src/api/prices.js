// Prices are stored in cents. The API returns them in pesos.
export function unitPrice(item) {
  return item.cents / 100;
}

export function lineTotal(item) {
  return unitPrice(item) * item.qty;
}
