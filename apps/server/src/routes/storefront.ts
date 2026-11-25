import { Router } from "express";
import { storeConfig } from "../config/store.js";
import { getProductBySlug, listActiveProducts } from "../services/catalog.js";

export const storefrontRouter = Router();

function splitBrandName(name: string): { first: string; rest: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { first: name, rest: "" };
  }
  const first = parts[0] ?? name;
  const rest = parts.slice(1).join("");
  return { first, rest };
}

storefrontRouter.use((_req, res, next) => {
  res.locals.store = {
    ...storeConfig,
    nameParts: splitBrandName(storeConfig.name),
  };
  res.locals.ogImageUrl = `${storeConfig.baseUrl}${storeConfig.ogImagePath}`;
  next();
});

storefrontRouter.get("/", async (_req, res) => {
  const { products } = await listActiveProducts();
  const featuredProducts = products.slice(0, 4);

  const orgJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: storeConfig.name,
    url: storeConfig.baseUrl,
    description: storeConfig.tagline,
  });

  res.render("pages/home.njk", {
    pageTitle: `${storeConfig.name}: 3D prints and cosplay pieces`,
    pageDescription:
      "Made-to-order 3D-printed cosplay props, masks, and desk pieces crafted one at a time in India.",
    canonicalUrl: `${storeConfig.baseUrl}/`,
    activeNav: "home",
    featuredProducts,
    totalProducts: products.length,
    orgJsonLd,
  });
});

storefrontRouter.get("/shop", async (req, res) => {
  const rawCategory = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const selectedCategory = rawCategory || "all";

  const [{ products, categories }, allResult] = await Promise.all([
    listActiveProducts(selectedCategory),
    listActiveProducts(),
  ]);

  const titlePrefix = selectedCategory === "all" ? "Shop" : `${selectedCategory} | Shop`;
  const canonicalUrl =
    selectedCategory === "all"
      ? `${storeConfig.baseUrl}/shop`
      : `${storeConfig.baseUrl}/shop?category=${encodeURIComponent(selectedCategory)}`;

  res.render("pages/shop.njk", {
    pageTitle: `${titlePrefix} — ${storeConfig.name}`,
    pageDescription:
      "Browse made-to-order 3D-printed masks, props, hardware, and desk pieces shipped across India.",
    canonicalUrl,
    activeNav: "shop",
    products,
    categories,
    selectedCategory,
    totalCount: allResult.products.length,
  });
});

storefrontRouter.get("/shop/:slug", async (req, res) => {
  const slug = req.params.slug?.trim() ?? "";
  const { product, redirectSlug } = await getProductBySlug(slug);

  if (redirectSlug) {
    res.redirect(301, `/shop/${encodeURIComponent(redirectSlug)}`);
    return;
  }

  if (!product) {
    res.status(404).render("pages/not-found.njk", {
      pageTitle: `Not found — ${storeConfig.name}`,
      pageDescription: "This product could not be found.",
      canonicalUrl: `${storeConfig.baseUrl}/shop`,
      noindex: true,
    });
    return;
  }

  const productUrl = `${storeConfig.baseUrl}/shop/${encodeURIComponent(product.slug)}`;
  const primaryImage = product.images[0]
    ? `${storeConfig.baseUrl}${product.images[0].url.startsWith("/") ? product.images[0].url : `/${product.images[0].url}`}`
    : `${storeConfig.baseUrl}${storeConfig.ogImagePath}`;

  const offers =
    product.variants.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "INR",
          lowPrice: (product.minPricePaise / 100).toFixed(2),
          highPrice: (product.maxPricePaise / 100).toFixed(2),
          offerCount: product.variants.length,
          availability: "https://schema.org/MadeToOrder",
          url: productUrl,
        }
      : {
          "@type": "Offer",
          priceCurrency: "INR",
          price: (product.minPricePaise / 100).toFixed(2),
          availability: "https://schema.org/MadeToOrder",
          url: productUrl,
        };

  const productJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: `KM-${product.id}`,
    image: product.images.map((img) =>
      img.url.startsWith("http") ? img.url : `${storeConfig.baseUrl}${img.url}`,
    ),
    brand: {
      "@type": "Brand",
      name: storeConfig.name,
    },
    offers,
  });

  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${storeConfig.baseUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${storeConfig.baseUrl}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: productUrl,
      },
    ],
  });

  res.render("pages/product.njk", {
    pageTitle: `${product.name} — ${storeConfig.name}`,
    pageDescription: product.description.slice(0, 155),
    canonicalUrl: productUrl,
    ogType: "product",
    ogImageUrl: primaryImage,
    activeNav: "shop",
    product,
    productJsonLd,
    breadcrumbJsonLd,
  });
});
