import { Router } from "express";
import { storeConfig } from "../config/store.js";
import { listActiveProductSlugs } from "../services/catalog.js";

export const seoRouter = Router();

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

seoRouter.get("/robots.txt", (_req, res) => {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin/",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /orders/",
    "",
    `Sitemap: ${storeConfig.baseUrl}/sitemap.xml`,
  ];
  res.type("text/plain; charset=utf-8").send(lines.join("\n"));
});

seoRouter.get("/sitemap.xml", async (_req, res) => {
  const productRows = await listActiveProductSlugs();

  const urls = [
    { loc: `${storeConfig.baseUrl}/`, lastmod: null as string | null },
    { loc: `${storeConfig.baseUrl}/shop`, lastmod: null as string | null },
    ...productRows.map((row) => ({
      loc: `${storeConfig.baseUrl}/shop/${encodeURIComponent(row.slug)}`,
      lastmod: row.createdAt.toISOString(),
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) =>
      u.lastmod
        ? `  <url><loc>${escapeXml(u.loc)}</loc><lastmod>${escapeXml(u.lastmod)}</lastmod></url>`
        : `  <url><loc>${escapeXml(u.loc)}</loc></url>`,
    ),
    "</urlset>",
  ].join("\n");

  res.type("application/xml; charset=utf-8").send(xml);
});
