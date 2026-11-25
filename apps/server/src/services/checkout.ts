import crypto from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { formatInr, resolveImageUrl, storeConfig } from "../config/store.js";
import { db } from "../db/index.js";
import { orderItems, orders, productImages, products, variants } from "../db/schema.js";

export interface CartItemInput {
  variantId: number;
  qty: number;
}

export interface QuotedCartItem {
  variantId: number;
  productId: number;
  slug: string;
  productName: string;
  variantLabel: string;
  unitPricePaise: number;
  unitPriceFormatted: string;
  lineTotalPaise: number;
  lineTotalFormatted: string;
  leadTimeDays: number;
  qty: number;
  imageUrl: string;
  imageAlt: string;
}

export interface CartQuote {
  items: QuotedCartItem[];
  droppedVariantIds: number[];
  subtotalPaise: number;
  subtotalFormatted: string;
  shippingPaise: number;
  shippingFormatted: string;
  freeShippingThresholdPaise: number;
  freeShippingThresholdFormatted: string;
  totalPaise: number;
  totalFormatted: string;
  maxLeadTimeDays: number;
}

export interface CheckoutInput {
  items: CartItemInput[];
  customerName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  userId?: string | null;
}

export interface CreatedOrderSummary {
  id: number;
  publicNumber: string;
  status: string;
  subtotalPaise: number;
  subtotalFormatted: string;
  shippingPaise: number;
  shippingFormatted: string;
  totalPaise: number;
  totalFormatted: string;
  customerName: string;
  email: string;
  items: Array<{
    nameSnapshot: string;
    priceSnapshotPaise: number;
    priceSnapshotFormatted: string;
    qty: number;
  }>;
  createdAt: string;
}

export class CheckoutValidationError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code = "INVALID_CART", details?: Record<string, unknown>) {
    super(message);
    this.name = "CheckoutValidationError";
    this.code = code;
    this.details = details;
  }
}

function normalizeCartItems(items: CartItemInput[]): CartItemInput[] {
  const merged = new Map<number, number>();
  for (const item of items) {
    const current = merged.get(item.variantId) ?? 0;
    merged.set(item.variantId, Math.min(20, current + item.qty));
  }
  return Array.from(merged.entries()).map(([variantId, qty]) => ({ variantId, qty }));
}

export function computeShippingPaise(subtotalPaise: number): number {
  if (subtotalPaise <= 0) return 0;
  if (subtotalPaise >= storeConfig.freeShippingThresholdPaise) return 0;
  return storeConfig.flatShippingPaise;
}

export async function quoteCart(rawItems: CartItemInput[]): Promise<CartQuote> {
  const normalized = normalizeCartItems(rawItems);

  if (normalized.length === 0) {
    return {
      items: [],
      droppedVariantIds: [],
      subtotalPaise: 0,
      subtotalFormatted: formatInr(0),
      shippingPaise: 0,
      shippingFormatted: formatInr(0),
      freeShippingThresholdPaise: storeConfig.freeShippingThresholdPaise,
      freeShippingThresholdFormatted: formatInr(storeConfig.freeShippingThresholdPaise),
      totalPaise: 0,
      totalFormatted: formatInr(0),
      maxLeadTimeDays: 0,
    };
  }

  const variantIds = normalized.map((i) => i.variantId);
  const rows = await db
    .select({
      variantId: variants.id,
      variantLabel: variants.label,
      pricePaise: variants.pricePaise,
      leadTimeDays: variants.leadTimeDays,
      productId: products.id,
      slug: products.slug,
      productName: products.name,
    })
    .from(variants)
    .innerJoin(products, eq(variants.productId, products.id))
    .where(
      and(inArray(variants.id, variantIds), eq(variants.active, true), eq(products.active, true)),
    );

  const productIds = Array.from(new Set(rows.map((r) => r.productId)));
  const imageRows =
    productIds.length > 0
      ? await db
          .select()
          .from(productImages)
          .where(inArray(productImages.productId, productIds))
          .orderBy(asc(productImages.sortOrder), asc(productImages.id))
      : [];

  const rowMap = new Map(rows.map((r) => [r.variantId, r]));
  const items: QuotedCartItem[] = [];
  const droppedVariantIds: number[] = [];

  for (const entry of normalized) {
    const row = rowMap.get(entry.variantId);
    if (!row) {
      droppedVariantIds.push(entry.variantId);
      continue;
    }

    const firstImage = imageRows.find((img) => img.productId === row.productId);
    const lineTotalPaise = row.pricePaise * entry.qty;

    items.push({
      variantId: row.variantId,
      productId: row.productId,
      slug: row.slug,
      productName: row.productName,
      variantLabel: row.variantLabel,
      unitPricePaise: row.pricePaise,
      unitPriceFormatted: formatInr(row.pricePaise),
      lineTotalPaise,
      lineTotalFormatted: formatInr(lineTotalPaise),
      leadTimeDays: row.leadTimeDays,
      qty: entry.qty,
      imageUrl: firstImage ? resolveImageUrl(firstImage.r2Key) : "/img/products/placeholder.svg",
      imageAlt: firstImage?.alt ?? row.productName,
    });
  }

  const subtotalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  const shippingPaise = computeShippingPaise(subtotalPaise);
  const totalPaise = subtotalPaise + shippingPaise;
  const maxLeadTimeDays =
    items.length > 0 ? Math.max(...items.map((item) => item.leadTimeDays)) : 0;

  return {
    items,
    droppedVariantIds,
    subtotalPaise,
    subtotalFormatted: formatInr(subtotalPaise),
    shippingPaise,
    shippingFormatted: formatInr(shippingPaise),
    freeShippingThresholdPaise: storeConfig.freeShippingThresholdPaise,
    freeShippingThresholdFormatted: formatInr(storeConfig.freeShippingThresholdPaise),
    totalPaise,
    totalFormatted: formatInr(totalPaise),
    maxLeadTimeDays,
  };
}

function generatePublicOrderNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const token = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `KM-${year}-${token}`;
}

export async function createPendingOrder(input: CheckoutInput): Promise<CreatedOrderSummary> {
  const quote = await quoteCart(input.items);

  if (quote.droppedVariantIds.length > 0) {
    throw new CheckoutValidationError(
      "Some items in your cart are no longer available. Please review your cart.",
      "UNAVAILABLE_ITEMS",
      { droppedVariantIds: quote.droppedVariantIds },
    );
  }

  if (quote.items.length === 0) {
    throw new CheckoutValidationError("Your cart is empty.", "EMPTY_CART");
  }

  return db.transaction(async (tx) => {
    const publicNumber = generatePublicOrderNumber();

    const [createdOrder] = await tx
      .insert(orders)
      .values({
        publicNumber,
        userId: input.userId ?? null,
        status: "pending_payment",
        subtotalPaise: quote.subtotalPaise,
        shippingPaise: quote.shippingPaise,
        totalPaise: quote.totalPaise,
        customerName: input.customerName,
        phone: input.phone,
        email: input.email.toLowerCase(),
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2?.trim() || null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
      })
      .returning();

    if (!createdOrder) {
      throw new Error("Failed to create order row.");
    }

    const itemsToInsert = quote.items.map((item) => ({
      orderId: createdOrder.id,
      variantId: item.variantId,
      nameSnapshot: `${item.productName} — ${item.variantLabel}`,
      priceSnapshotPaise: item.unitPricePaise,
      qty: item.qty,
    }));

    await tx.insert(orderItems).values(itemsToInsert);

    return {
      id: createdOrder.id,
      publicNumber: createdOrder.publicNumber,
      status: createdOrder.status,
      subtotalPaise: createdOrder.subtotalPaise,
      subtotalFormatted: formatInr(createdOrder.subtotalPaise),
      shippingPaise: createdOrder.shippingPaise,
      shippingFormatted: formatInr(createdOrder.shippingPaise),
      totalPaise: createdOrder.totalPaise,
      totalFormatted: formatInr(createdOrder.totalPaise),
      customerName: createdOrder.customerName,
      email: createdOrder.email,
      items: itemsToInsert.map((item) => ({
        nameSnapshot: item.nameSnapshot,
        priceSnapshotPaise: item.priceSnapshotPaise,
        priceSnapshotFormatted: formatInr(item.priceSnapshotPaise),
        qty: item.qty,
      })),
      createdAt: createdOrder.createdAt.toISOString(),
    };
  });
}
