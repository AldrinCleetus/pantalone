import { fetchCartQuote, readCart, updateCartBadge, writeCart } from "./cart-storage.js";

const loadingEl = document.getElementById("cart-loading");
const emptyEl = document.getElementById("cart-empty");
const listEl = document.getElementById("cart-items");
const summaryEl = document.getElementById("cart-summary");
const alertEl = document.getElementById("cart-alert");
const subtotalEl = document.getElementById("summary-subtotal");
const shippingEl = document.getElementById("summary-shipping");
const totalEl = document.getElementById("summary-total");
const noteEl = document.getElementById("summary-note");

function createCartRow(item) {
  const li = document.createElement("li");
  li.className = "cart-row";

  const img = document.createElement("img");
  img.className = "cart-thumb";
  img.src = item.imageUrl;
  img.alt = item.imageAlt;
  img.width = 88;
  img.height = 66;

  const meta = document.createElement("div");
  meta.className = "cart-meta";

  const title = document.createElement("h3");
  const link = document.createElement("a");
  link.href = `/shop/${encodeURIComponent(item.slug)}`;
  link.textContent = item.productName;
  title.appendChild(link);

  const variantP = document.createElement("p");
  variantP.textContent = `${item.variantLabel} · ${item.unitPriceFormatted} each`;

  const lineTotalP = document.createElement("p");
  const strongTotal = document.createElement("strong");
  strongTotal.textContent = `Line total: ${item.lineTotalFormatted}`;
  lineTotalP.appendChild(strongTotal);

  meta.append(title, variantP, lineTotalP);

  const actions = document.createElement("div");
  actions.className = "cart-actions";

  const decBtn = document.createElement("button");
  decBtn.type = "button";
  decBtn.className = "qty-btn";
  decBtn.textContent = "−";
  decBtn.setAttribute("aria-label", `Decrease quantity for ${item.productName}`);
  decBtn.addEventListener("click", () => void changeQty(item.variantId, -1));

  const countSpan = document.createElement("span");
  countSpan.className = "qty-count";
  countSpan.textContent = String(item.qty);

  const incBtn = document.createElement("button");
  incBtn.type = "button";
  incBtn.className = "qty-btn";
  incBtn.textContent = "+";
  incBtn.setAttribute("aria-label", `Increase quantity for ${item.productName}`);
  incBtn.addEventListener("click", () => void changeQty(item.variantId, 1));

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "Remove";
  removeBtn.setAttribute("aria-label", `Remove ${item.productName} from cart`);
  removeBtn.addEventListener("click", () => void removeItem(item.variantId));

  actions.append(decBtn, countSpan, incBtn, removeBtn);
  li.append(img, meta, actions);
  return li;
}

async function changeQty(variantId, delta) {
  const items = readCart();
  const target = items.find((i) => i.variantId === variantId);
  if (!target) return;
  const nextQty = target.qty + delta;
  const updated =
    nextQty <= 0
      ? items.filter((i) => i.variantId !== variantId)
      : items.map((i) =>
          i.variantId === variantId ? { variantId, qty: Math.min(20, nextQty) } : i,
        );
  writeCart(updated);
  updateCartBadge();
  await renderCart();
}

async function removeItem(variantId) {
  const updated = readCart().filter((i) => i.variantId !== variantId);
  writeCart(updated);
  updateCartBadge();
  await renderCart();
}

async function renderCart() {
  const items = readCart();
  if (loadingEl) loadingEl.hidden = false;

  try {
    const quote = await fetchCartQuote(items);

    if (quote.droppedVariantIds.length > 0) {
      const cleaned = items.filter((i) => !quote.droppedVariantIds.includes(i.variantId));
      writeCart(cleaned);
      updateCartBadge();
      if (alertEl) {
        alertEl.textContent = "Some unavailable items were removed from your cart.";
        alertEl.hidden = false;
      }
    }

    if (loadingEl) loadingEl.hidden = true;
    if (!listEl || !emptyEl || !summaryEl) return;

    listEl.replaceChildren();

    if (quote.items.length === 0) {
      emptyEl.hidden = false;
      summaryEl.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    summaryEl.hidden = false;

    for (const item of quote.items) {
      listEl.appendChild(createCartRow(item));
    }

    if (subtotalEl) subtotalEl.textContent = quote.subtotalFormatted;
    if (shippingEl) {
      shippingEl.textContent = quote.shippingPaise === 0 ? "Free" : quote.shippingFormatted;
    }
    if (totalEl) totalEl.textContent = quote.totalFormatted;
    if (noteEl) {
      noteEl.textContent =
        quote.shippingPaise === 0
          ? `Free shipping unlocked (orders ${quote.freeShippingThresholdFormatted}+). Max lead time: ~${quote.maxLeadTimeDays} days.`
          : `Provisional shipping is free above ${quote.freeShippingThresholdFormatted}. Max lead time: ~${quote.maxLeadTimeDays} days.`;
    }
  } catch (err) {
    if (loadingEl) loadingEl.hidden = true;
    if (alertEl) {
      alertEl.textContent = err instanceof Error ? err.message : "Could not load cart.";
      alertEl.classList.add("error");
      alertEl.hidden = false;
    }
  }
}

void renderCart();
