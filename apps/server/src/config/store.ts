import { env } from "./env.js";

/**
 * Central store identity & non-secret storefront config.
 * "Knight Makes" is only a default fallback for STORE_NAME.
 */
export const storeConfig = {
  name: env.STORE_NAME,
  tagline: "3D-printed props and cosplay pieces, made to order in India.",
  currency: "INR",
  baseUrl: env.PUBLIC_BASE_URL.replace(/\/+$/, ""),
  mediaBaseUrl: env.R2_PUBLIC_BASE_URL.replace(/\/+$/, ""),
  ogImagePath: "/img/og-cover.svg",
  makerLocation: "Kerala, India",
  /** Placeholder flat shipping rate in paise until shipping plan is finalized (Section 13). */
  flatShippingPaise: 9900,
  freeShippingThresholdPaise: 249900,
} as const;

export function formatInr(paise: number): string {
  const rupees = Math.round(paise / 100);
  return `₹${rupees.toLocaleString("en-IN")}`;
}

export function resolveImageUrl(r2Key: string): string {
  if (r2Key.startsWith("/") || r2Key.startsWith("http://") || r2Key.startsWith("https://")) {
    return r2Key;
  }
  if (storeConfig.mediaBaseUrl) {
    return `${storeConfig.mediaBaseUrl}/${r2Key.replace(/^\/+/, "")}`;
  }
  return `/img/products/${r2Key.replace(/^\/+/, "")}`;
}
