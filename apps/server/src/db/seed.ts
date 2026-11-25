import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { productImages, products, variants } from "./schema.js";

interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  category: string;
  images: Array<{ r2Key: string; alt: string; sortOrder: number }>;
  variants: Array<{ label: string; pricePaise: number; leadTimeDays: number }>;
}

const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: "raven-half-mask",
    name: "Raven half-mask",
    description:
      "Lightweight vented PLA half-mask with an elastic strap and foam nose cushion. Printed in 0.16mm layers, hand-sanded, primed, and sealed in matte acrylic. Fits most adult heads.",
    category: "Masks & Helmets",
    images: [
      {
        r2Key: "raven-half-mask.svg",
        alt: "Raven half-mask in matte obsidian PLA with gold trim",
        sortOrder: 0,
      },
      {
        r2Key: "raven-half-mask-detail.svg",
        alt: "Side profile showing strap mounts and breathable vent slots",
        sortOrder: 1,
      },
    ],
    variants: [
      { label: "Unpainted raw PLA (ready to sand)", pricePaise: 129900, leadTimeDays: 3 },
      { label: "Hand-painted matte black + gold", pricePaise: 189900, leadTimeDays: 5 },
      { label: "Weathered metallic gunmetal", pricePaise: 239900, leadTimeDays: 6 },
    ],
  },
  {
    slug: "flexi-dragon",
    name: "Flexi dragon",
    description:
      "Articulated print-in-place desk dragon that moves smoothly right off the build plate. No glue or assembly needed, printed in durable silk or matte PLA.",
    category: "Desk & Fidgets",
    images: [
      {
        r2Key: "flexi-dragon.svg",
        alt: "Articulated teal and gold flexi dragon curled on a desk",
        sortOrder: 0,
      },
    ],
    variants: [
      { label: "28 cm - Matte Obsidian", pricePaise: 64900, leadTimeDays: 2 },
      { label: "28 cm - Silk Teal & Gold", pricePaise: 84900, leadTimeDays: 2 },
      { label: "45 cm - Giant Display Scale", pricePaise: 139900, leadTimeDays: 3 },
    ],
  },
  {
    slug: "wolf-ear-headband",
    name: "Wolf-ear headband",
    description:
      "Clip-on wolf ears mounted on a slim metal headband with hidden wire cores so you can angle each ear slightly. Light enough for full convention days.",
    category: "Cosplay Accessories",
    images: [
      {
        r2Key: "wolf-ear-headband.svg",
        alt: "Sculpted wolf-ear cosplay headband in warm amber and dark slate",
        sortOrder: 0,
      },
    ],
    variants: [
      { label: "Unpainted PLA shell", pricePaise: 89900, leadTimeDays: 3 },
      { label: "Sanded, painted + faux-fur inner trim", pricePaise: 149900, leadTimeDays: 5 },
    ],
  },
  {
    slug: "armor-buckle-set",
    name: "Armor buckle set",
    description:
      "Six heavy-profile fantasy armor buckles printed in tough ABS-like resin for EVA foam straps up to 25 mm wide. Deburred, cured, and clean out of the box.",
    category: "Armor & Hardware",
    images: [
      {
        r2Key: "armor-buckle-set.svg",
        alt: "Set of six resin cosplay armor buckles arranged in pairs",
        sortOrder: 0,
      },
    ],
    variants: [
      { label: "Set of 6 - Raw grey resin", pricePaise: 49900, leadTimeDays: 3 },
      { label: "Set of 6 - Sanded & primed", pricePaise: 69900, leadTimeDays: 4 },
      { label: "Set of 6 - Antique brass finish", pricePaise: 94900, leadTimeDays: 5 },
    ],
  },
  {
    slug: "oni-jaw-visor",
    name: "Oni jaw visor",
    description:
      "Cyber-fantasy lower face armor with sculpted fangs, removable cheek plates, and soft inner padding. Built in tough PETG so it survives travel in a con bag.",
    category: "Masks & Helmets",
    images: [
      {
        r2Key: "oni-jaw-visor.svg",
        alt: "Crimson and charcoal Oni jaw cosplay visor with carved fangs",
        sortOrder: 0,
      },
    ],
    variants: [
      { label: "Matte black PETG (raw)", pricePaise: 159900, leadTimeDays: 4 },
      { label: "Crimson & gold hand-painted", pricePaise: 229900, leadTimeDays: 6 },
    ],
  },
  {
    slug: "arcane-prop-lantern",
    name: "Arcane prop lantern",
    description:
      "Handheld cosplay lantern with translucent amber diffuser panels and a replaceable CR2032 warm flicker LED puck. Includes a top brass-finish ring for belts or staffs.",
    category: "Props & Lamps",
    images: [
      {
        r2Key: "arcane-prop-lantern.svg",
        alt: "Glowing handheld arcane cosplay prop lantern with lattice frame",
        sortOrder: 0,
      },
    ],
    variants: [
      { label: "DIY kit (unpainted + LED puck)", pricePaise: 179900, leadTimeDays: 4 },
      { label: "Finished & weathered + warm LED", pricePaise: 269900, leadTimeDays: 7 },
      { label: "Finished + USB-C rechargeable core", pricePaise: 319900, leadTimeDays: 7 },
    ],
  },
];

async function seed() {
  for (const item of SEED_PRODUCTS) {
    const existing = await db.query.products.findFirst({
      where: eq(products.slug, item.slug),
    });

    if (existing) {
      console.log(`Skipping existing product: ${item.slug}`);
      continue;
    }

    const [created] = await db
      .insert(products)
      .values({
        slug: item.slug,
        name: item.name,
        description: item.description,
        category: item.category,
        active: true,
      })
      .returning();

    if (!created) {
      throw new Error(`Failed to insert product ${item.slug}`);
    }

    await db.insert(productImages).values(
      item.images.map((img) => ({
        productId: created.id,
        r2Key: img.r2Key,
        alt: img.alt,
        sortOrder: img.sortOrder,
      })),
    );

    await db.insert(variants).values(
      item.variants.map((v) => ({
        productId: created.id,
        label: v.label,
        pricePaise: v.pricePaise,
        leadTimeDays: v.leadTimeDays,
        active: true,
      })),
    );

    console.log(`Seeded product: ${item.slug} (${item.variants.length} variants)`);
  }
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
