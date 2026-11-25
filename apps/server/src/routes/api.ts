import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { getProductBySlug, listActiveProducts } from "../services/catalog.js";
import { CheckoutValidationError, createPendingOrder, quoteCart } from "../services/checkout.js";
import { createCustomRequest } from "../services/customRequests.js";

export const apiRouter = Router();

const productsQuerySchema = z.object({
  category: z.string().trim().max(80).optional(),
});

const productSlugParamSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const cartItemSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().min(1).max(20),
});

const cartQuoteSchema = z.object({
  items: z.array(cartItemSchema).max(50),
});

const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Add at least one item to your cart.").max(50),
  customerName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{10,16}$/, "Enter a valid 10-digit Indian phone number."),
  email: z.string().trim().email("Enter a valid email address.").max(160),
  addressLine1: z.string().trim().min(5, "Enter your street address.").max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  state: z.string().trim().min(2, "Enter your state.").max(80),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit Indian PIN code."),
});

export const customRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  contact: z
    .string()
    .trim()
    .min(5, "Enter your WhatsApp number, Instagram handle, or email.")
    .max(160),
  details: z
    .string()
    .trim()
    .min(10, "Describe the piece, approximate size, and deadline if any.")
    .max(2000),
  referenceUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine(
      (val) => !val || /^https?:\/\/.+/i.test(val),
      "Reference link must start with http:// or https://",
    ),
  website: z.string().optional(),
});

apiRouter.get("/health", async (_req, res) => {
  await db.execute(sql`SELECT 1`);
  res.json({ ok: true, db: "connected" });
});

apiRouter.get("/products", async (req, res) => {
  const parsed = productsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters.",
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const data = await listActiveProducts(parsed.data.category);
  res.json(data);
});

apiRouter.get("/products/:slug", async (req, res) => {
  const parsed = productSlugParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid product slug.",
      },
    });
    return;
  }

  const { product, redirectSlug } = await getProductBySlug(parsed.data.slug);
  if (redirectSlug) {
    res.status(301).json({ redirectSlug });
    return;
  }
  if (!product) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Product not found.",
      },
    });
    return;
  }

  res.json({ product });
});

apiRouter.post("/cart/quote", async (req, res) => {
  const parsed = cartQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid cart items.",
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const quote = await quoteCart(parsed.data.items);
  res.json({ quote });
});

apiRouter.post("/checkout", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please check the highlighted checkout fields.",
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  try {
    const order = await createPendingOrder(parsed.data);
    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof CheckoutValidationError) {
      res.status(400).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
      return;
    }
    throw err;
  }
});

apiRouter.post("/custom-requests", async (req, res) => {
  const parsed = customRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please fill out all required fields.",
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  // Honeypot check: silently ignore automated spam submissions
  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    res.status(201).json({ request: { id: 0, status: "new" } });
    return;
  }

  const created = await createCustomRequest({
    name: parsed.data.name,
    contact: parsed.data.contact,
    details: parsed.data.details,
    referenceUrl: parsed.data.referenceUrl,
  });

  res.status(201).json({ request: created });
});
