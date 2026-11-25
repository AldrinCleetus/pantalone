const customForm = document.getElementById("custom-order-form");
const statusBox = document.getElementById("custom-status");
const submitBtn = document.getElementById("custom-submit");

if (customForm) {
  const fields = [
    { id: "custom-name", key: "name", check: (v) => (v.length < 2 ? "Enter your name." : "") },
    {
      id: "custom-contact",
      key: "contact",
      check: (v) => (v.length < 5 ? "Enter your WhatsApp number, Instagram handle, or email." : ""),
    },
    {
      id: "custom-ref",
      key: "referenceUrl",
      check: (v) =>
        v && !/^https?:\/\/.+/i.test(v) ? "Reference link must start with http:// or https://" : "",
    },
    {
      id: "custom-details",
      key: "details",
      check: (v) =>
        v.length < 10 ? "Describe the piece, approximate size, and deadline if any." : "",
    },
  ];

  function setErr(id, msg) {
    const el = document.getElementById(id);
    const errEl = document.getElementById(`err-${id}`);
    if (el) {
      if (msg) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    }
    if (errEl) errEl.textContent = msg || "";
  }

  for (const field of fields) {
    const el = document.getElementById(field.id);
    if (!el) continue;
    let dirty = false;
    el.addEventListener("input", () => {
      dirty = true;
      setErr(field.id, "");
    });
    el.addEventListener("blur", () => {
      if (!dirty && el.value.trim() === "") return;
      setErr(field.id, field.check(el.value.trim()));
    });
  }

  customForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (statusBox) {
      statusBox.hidden = true;
      statusBox.className = "alert-box";
    }

    let firstBad = null;
    for (const field of fields) {
      const el = document.getElementById(field.id);
      const val = el ? el.value.trim() : "";
      const msg = field.check(val);
      setErr(field.id, msg);
      if (msg && !firstBad) firstBad = el;
    }

    if (firstBad) {
      firstBad.focus();
      return;
    }

    const fd = new FormData(customForm);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      contact: String(fd.get("contact") || "").trim(),
      referenceUrl: String(fd.get("referenceUrl") || "").trim() || undefined,
      details: String(fd.get("details") || "").trim(),
      website: String(fd.get("website") || ""),
    };

    if (submitBtn) {
      submitBtn.setAttribute("disabled", "");
      submitBtn.textContent = "Sending…";
    }

    try {
      const res = await fetch("/api/custom-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Could not send your request.");
      }

      customForm.reset();
      if (statusBox) {
        statusBox.textContent = "Request received! I’ll reply within a day with a quote.";
        statusBox.classList.add("success");
        statusBox.hidden = false;
      }
    } catch (err) {
      if (statusBox) {
        statusBox.textContent = err instanceof Error ? err.message : "Could not send request.";
        statusBox.classList.add("error");
        statusBox.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.removeAttribute("disabled");
        submitBtn.textContent = "Send custom request";
      }
    }
  });
}
