export const CART_KEY = "pantalone_cart_v1";

export function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.variantId === "number" &&
        Number.isInteger(item.variantId) &&
        item.variantId > 0 &&
        typeof item.qty === "number" &&
        Number.isInteger(item.qty) &&
        item.qty > 0,
    );
  } catch {
    return [];
  }
}

export function writeCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function updateCartBadge() {
  const count = readCart().reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = `Cart (${count})`;
  });
}

export function clearCart() {
  writeCart([]);
  updateCartBadge();
}

export async function fetchCartQuote(items) {
  const res = await fetch("/api/cart/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Could not load cart summary.");
  }
  return data.quote;
}
