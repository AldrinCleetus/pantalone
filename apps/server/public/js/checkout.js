import { clearCart, fetchCartQuote, readCart } from "./cart-storage.js";

const form = document.getElementById("checkout-form");
const layoutEl = document.getElementById("checkout-layout");
const emptyEl = document.getElementById("checkout-empty");
const confirmEl = document.getElementById("checkout-confirmation");
const errorSummaryEl = document.getElementById("checkout-error-summary");
const submitBtn = document.getElementById("checkout-submit");
const itemsListEl = document.getElementById("checkout-items");
const subtotalEl = document.getElementById("checkout-subtotal");
const shippingEl = document.getElementById("checkout-shipping");
const totalEl = document.getElementById("checkout-total");

const FIELD_IDS = ["customerName", "phone", "email", "addressLine1", "city", "state", "pincode"];

function setFieldError(id, message) {
  const input = document.getElementById(id);
  const errEl = document.getElementById(`err-${id}`);
  if (input) {
    if (message) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }
  if (errEl) {
    errEl.textContent = message || "";
  }
}

function validateField(id) {
  const input = document.getElementById(id);
  if (!input) return "";
  const val = input.value.trim();

  if (id === "customerName" && val.length < 2) {
    return "Enter your full name.";
  }
  if (id === "phone" && !/^[+\d\s()-]{10,16}$/.test(val)) {
    return "Enter a valid 10-digit Indian phone number.";
  }
  if (id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    return "Enter a valid email address.";
  }
  if (id === "addressLine1" && val.length < 5) {
    return "Enter your street address.";
  }
  if ((id === "city" || id === "state") && val.length < 2) {
    return `Enter your ${id}.`;
  }
  if (id === "pincode" && !/^\d{6}$/.test(val)) {
    return "Enter a valid 6-digit PIN code.";
  }
  return "";
}

function wireFieldValidation() {
  for (const id of FIELD_IDS) {
    const input = document.getElementById(id);
    if (!input) continue;
    let touched = false;
    input.addEventListener("input", () => {
      touched = true;
      setFieldError(id, "");
    });
    input.addEventListener("blur", () => {
      if (!touched && input.value.trim() === "") return;
      setFieldError(id, validateField(id));
    });
  }
}

function renderSummaryItems(items) {
  if (!itemsListEl) return;
  itemsListEl.replaceChildren();
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "cart-row";
    li.style.gridTemplateColumns = "64px 1fr";

    const img = document.createElement("img");
    img.className = "cart-thumb";
    img.style.width = "64px";
    img.style.height = "48px";
    img.src = item.imageUrl;
    img.alt = item.imageAlt;

    const meta = document.createElement("div");
    meta.className = "cart-meta";

    const name = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${item.productName} × ${item.qty}`;
    name.appendChild(strong);

    const sub = document.createElement("p");
    sub.textContent = `${item.variantLabel} · ${item.lineTotalFormatted}`;

    meta.append(name, sub);
    li.append(img, meta);
    itemsListEl.appendChild(li);
  }
}

async function initCheckout() {
  const items = readCart();
  if (items.length === 0) {
    if (layoutEl) layoutEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  try {
    const quote = await fetchCartQuote(items);
    if (quote.items.length === 0) {
      if (layoutEl) layoutEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    renderSummaryItems(quote.items);
    if (subtotalEl) subtotalEl.textContent = quote.subtotalFormatted;
    if (shippingEl) {
      shippingEl.textContent = quote.shippingPaise === 0 ? "Free" : quote.shippingFormatted;
    }
    if (totalEl) totalEl.textContent = quote.totalFormatted;
  } catch (err) {
    if (errorSummaryEl) {
      errorSummaryEl.textContent = err instanceof Error ? err.message : "Could not load summary.";
      errorSummaryEl.hidden = false;
    }
  }
}

if (form) {
  wireFieldValidation();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorSummaryEl) errorSummaryEl.hidden = true;

    let firstInvalidId = null;
    for (const id of FIELD_IDS) {
      const msg = validateField(id);
      setFieldError(id, msg);
      if (msg && !firstInvalidId) {
        firstInvalidId = id;
      }
    }

    if (firstInvalidId) {
      if (errorSummaryEl) {
        errorSummaryEl.textContent = "Please fix the highlighted fields below.";
        errorSummaryEl.hidden = false;
      }
      document.getElementById(firstInvalidId)?.focus();
      return;
    }

    const items = readCart();
    if (items.length === 0) {
      if (layoutEl) layoutEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    const formData = new FormData(form);
    const payload = {
      items,
      customerName: String(formData.get("customerName") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      addressLine1: String(formData.get("addressLine1") || "").trim(),
      addressLine2: String(formData.get("addressLine2") || "").trim() || undefined,
      city: String(formData.get("city") || "").trim(),
      state: String(formData.get("state") || "").trim(),
      pincode: String(formData.get("pincode") || "").trim(),
    };

    if (submitBtn) {
      submitBtn.setAttribute("disabled", "");
      submitBtn.textContent = "Creating order…";
    }

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        const fieldErrors = data?.error?.details?.fieldErrors;
        if (fieldErrors && typeof fieldErrors === "object") {
          for (const [key, messages] of Object.entries(fieldErrors)) {
            if (Array.isArray(messages) && messages[0]) {
              setFieldError(key, String(messages[0]));
            }
          }
        }
        throw new Error(data?.error?.message || "Checkout failed. Please review your details.");
      }

      clearCart();
      const order = data.order;
      if (layoutEl) layoutEl.hidden = true;
      if (confirmEl) confirmEl.hidden = false;

      const numEl = document.getElementById("confirmed-number");
      const statusEl = document.getElementById("confirmed-status");
      const confTotalEl = document.getElementById("confirmed-total");
      const confItemsEl = document.getElementById("confirmed-items");

      if (numEl) numEl.textContent = order.publicNumber;
      if (statusEl) statusEl.textContent = order.status;
      if (confTotalEl) confTotalEl.textContent = order.totalFormatted;

      if (confItemsEl) {
        confItemsEl.replaceChildren();
        for (const line of order.items) {
          const li = document.createElement("li");
          li.className = "cart-row";
          li.style.gridTemplateColumns = "1fr";
          li.textContent = `${line.nameSnapshot} × ${line.qty} — ${line.priceSnapshotFormatted}`;
          confItemsEl.appendChild(li);
        }
      }
    } catch (err) {
      if (errorSummaryEl) {
        errorSummaryEl.textContent = err instanceof Error ? err.message : "Could not place order.";
        errorSummaryEl.hidden = false;
        errorSummaryEl.focus();
      }
      if (submitBtn) {
        submitBtn.removeAttribute("disabled");
        submitBtn.textContent = "Create pending order";
      }
    }
  });
}

void initCheckout();
