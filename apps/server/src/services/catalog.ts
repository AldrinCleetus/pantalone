import { and, asc, eq, inArray } from "drizzle-orm";
import { formatInr, resolveImageUrl } from "../config/store.js";
import { db } from "../db/index.js";
import { productImages, products, slugRedirects, variants } from "../db/schema.js";

export interface ProductCardView {
  id: number;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  minPricePaise: number;
  minPriceFormatted: string;
  leadTimeLabel: string;
  primaryVariantId: number | null;
  primaryVariantLabel: string;
  image: {
    url: string;
    alt: string;
  };
}

export interface ProductDetailView {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  images: Array<{ id: number; url: string; alt: string; sortOrder: number }>;
  variants: Array<{
    id: number;
    label: string;
    pricePaise: number;
    priceFormatted: string;
    leadTimeDays: number;
  }>;
  minPricePaise: number;
  maxPricePaise: number;
  minPriceFormatted: string;
}

function summarizeDescription(text: string, maxLen = 110): string {
  if (text.length <= maxLen) return text;
  const trimmed = text.slice(0, maxLen).replace(/\s+\S*$/, "");
  return `${trimmed}…`;
}

export async function listActiveProducts(category?: string): Promise<{
  products: ProductCardView[];
  categories: string[];
}> {
  const allRows = await db
    .select()
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.id));

  const categories = Array.from(new Set(allRows.map((p) => p.category))).sort((a, b) =>
    a.localeCompare(b),
  );

  const filtered =
    category && category !== "all"
      ? allRows.filter((p) => p.category.toLowerCase() === category.toLowerCase())
      : allRows;

  if (filtered.length === 0) {
    return { products: [], categories };
  }

  const productIds = filtered.map((p) => p.id);

  const [imageRows, variantRows] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db
      .select()
      .from(variants)
      .where(and(inArray(variants.productId, productIds), eq(variants.active, true)))
      .orderBy(asc(variants.pricePaise), asc(variants.id)),
  ]);

  const cards: ProductCardView[] = filtered.map((p) => {
    const imgs = imageRows.filter((img) => img.productId === p.id);
    const vars = variantRows.filter((v) => v.productId === p.id);
    const firstImg = imgs[0];
    const cheapest = vars[0];
    const minLead = vars.length > 0 ? Math.min(...vars.map((v) => v.leadTimeDays)) : 3;
    const maxLead = vars.length > 0 ? Math.max(...vars.map((v) => v.leadTimeDays)) : 5;
    const minPricePaise = cheapest?.pricePaise ?? 0;

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      shortDescription: summarizeDescription(p.description),
      category: p.category,
      minPricePaise,
      minPriceFormatted: formatInr(minPricePaise),
      leadTimeLabel: minLead === maxLead ? `${minLead} days` : `${minLead}–${maxLead} days`,
      primaryVariantId: cheapest?.id ?? null,
      primaryVariantLabel: cheapest?.label ?? "",
      image: {
        url: firstImg ? resolveImageUrl(firstImg.r2Key) : "/img/products/placeholder.svg",
        alt: firstImg?.alt ?? p.name,
      },
    };
  });

  return { products: cards, categories };
}

export async function getProductBySlug(slug: string): Promise<{
  product: ProductDetailView | null;
  redirectSlug: string | null;
}> {
  const row = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
  });

  if (!row) {
    const redirectRow = await db.query.slugRedirects.findFirst({
      where: eq(slugRedirects.oldSlug, slug),
    });
    if (redirectRow) {
      const target = await db.query.products.findFirst({
        where: and(eq(products.id, redirectRow.productId), eq(products.active, true)),
      });
      if (target) {
        return { product: null, redirectSlug: target.slug };
      }
    }
    return { product: null, redirectSlug: null };
  }

  const [imageRows, variantRows] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, row.id))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db
      .select()
      .from(variants)
      .where(and(eq(variants.productId, row.id), eq(variants.active, true)))
      .orderBy(asc(variants.pricePaise), asc(variants.id)),
  ]);

  const prices = variantRows.map((v) => v.pricePaise);
  const minPricePaise = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPricePaise = prices.length > 0 ? Math.max(...prices) : 0;

  return {
    redirectSlug: null,
    product: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category,
      images:
        imageRows.length > 0
          ? imageRows.map((img) => ({
              id: img.id,
              url: resolveImageUrl(img.r2Key),
              alt: img.alt,
              sortOrder: img.sortOrder,
            }))
          : [
              {
                id: 0,
                url: "/img/products/placeholder.svg",
                alt: row.name,
                sortOrder: 0,
              },
            ],
      variants: variantRows.map((v) => ({
        id: v.id,
        label: v.label,
        pricePaise: v.pricePaise,
        priceFormatted: formatInr(v.pricePaise),
        leadTimeDays: v.leadTimeDays,
      })),
      minPricePaise,
      maxPricePaise,
      minPriceFormatted: formatInr(minPricePaise),
    },
  };
}

export async function listActiveProductSlugs(): Promise<Array<{ slug: string; createdAt: Date }>> {
  return db
    .select({ slug: products.slug, createdAt: products.createdAt })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.id));
}
