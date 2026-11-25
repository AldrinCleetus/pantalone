import { CART_KEY, readCart, updateCartBadge, writeCart } from "./cart-storage.js";

const THEME_KEY = "color-scheme";

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("on");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("on");
  }, 1700);
}

function addToCart(variantId, qty) {
  const items = readCart();
  const existing = items.find((i) => i.variantId === variantId);
  if (existing) {
    existing.qty = Math.min(20, existing.qty + qty);
  } else {
    items.push({ variantId, qty });
  }
  writeCart(items);
  updateCartBadge();
  showToast("Added to cart");
}

document.querySelectorAll("[data-add-variant]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const variantId = Number(btn.getAttribute("data-add-variant"));
    if (!Number.isInteger(variantId) || variantId <= 0) return;
    addToCart(variantId, 1);
  });
});

const productForm = document.getElementById("product-add-form");
if (productForm) {
  const priceEl = document.getElementById("selected-price");
  const leadEl = document.getElementById("selected-lead");

  productForm.querySelectorAll('input[name="variantId"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (priceEl) {
        priceEl.textContent = radio.getAttribute("data-price") || "";
      }
      if (leadEl) {
        const days = radio.getAttribute("data-lead") || "4";
        leadEl.textContent = `Made to order — usually ships in ${days} days.`;
      }
    });
  });

  productForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const checked = productForm.querySelector('input[name="variantId"]:checked');
    const qtyInput = document.getElementById("product-qty");
    if (!checked) return;
    const variantId = Number(checked.value);
    const qty = Math.max(1, Math.min(20, Number(qtyInput ? qtyInput.value : 1) || 1));
    addToCart(variantId, qty);
  });
}

const galleryMain = document.getElementById("gallery-main-img");
if (galleryMain) {
  const thumbButtons = document.querySelectorAll("[data-gallery-src]");
  thumbButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.getAttribute("data-gallery-src");
      const alt = btn.getAttribute("data-gallery-alt");
      if (src) galleryMain.setAttribute("src", src);
      if (alt) galleryMain.setAttribute("alt", alt);
      thumbButtons.forEach((other) => other.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
    });
  });
}

// Two-state theme toggle (System default vs explicit opposite override)
const themeMeta = document.querySelector('meta[name="color-scheme"]');
const themeBtn = document.getElementById("theme-toggle");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function getStoredTheme() {
  try {
    const val = localStorage.getItem(THEME_KEY);
    return val === "light" || val === "dark" ? val : null;
  } catch {
    return null;
  }
}

function applyTheme(stored) {
  const systemDark = darkQuery.matches;
  const effective = stored ?? (systemDark ? "dark" : "light");
  if (themeMeta) {
    themeMeta.setAttribute("content", stored ?? "light dark");
  }
  if (stored) {
    document.documentElement.setAttribute("data-theme", stored);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  if (themeBtn) {
    themeBtn.textContent = effective === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }
}

if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const systemPref = darkQuery.matches ? "dark" : "light";
    const currentStored = getStoredTheme();
    const currentRendered = currentStored ?? systemPref;
    const target = currentRendered === "dark" ? "light" : "dark";
    try {
      if (target === systemPref) {
        localStorage.removeItem(THEME_KEY);
        applyTheme(null);
      } else {
        localStorage.setItem(THEME_KEY, target);
        applyTheme(target);
      }
    } catch {
      applyTheme(target);
    }
  });
}

darkQuery.addEventListener("change", () => {
  applyTheme(getStoredTheme());
});

window.addEventListener("storage", (event) => {
  if (event.key === THEME_KEY) {
    applyTheme(getStoredTheme());
  } else if (event.key === CART_KEY) {
    updateCartBadge();
  }
});

applyTheme(getStoredTheme());
updateCartBadge();
