import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { getProductBySlug, listActiveProducts } from "../services/catalog.js";

export const apiRouter = Router();

const productsQuerySchema = z.object({
  category: z.string().trim().max(80).optional(),
});

const productSlugParamSchema = z.object({
  slug: z.string().trim().min(1).max(120),
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
