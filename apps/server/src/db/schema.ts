import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "printing",
  "finishing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const customRequestStatusEnum = pgEnum("custom_request_status", [
  "new",
  "quoted",
  "accepted",
  "declined",
  "archived",
]);

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const slugRedirects = pgTable("slug_redirects", {
  oldSlug: text("old_slug").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  r2Key: text("r2_key").notNull(),
  alt: text("alt").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  pricePaise: integer("price_paise").notNull(),
  leadTimeDays: integer("lead_time_days").notNull().default(4),
  active: boolean("active").notNull().default(true),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  publicNumber: text("public_number").notNull().unique(),
  userId: text("user_id"),
  status: orderStatusEnum("status").notNull().default("pending_payment"),
  subtotalPaise: integer("subtotal_paise").notNull(),
  shippingPaise: integer("shipping_paise").notNull(),
  totalPaise: integer("total_paise").notNull(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
  nameSnapshot: text("name_snapshot").notNull(),
  priceSnapshotPaise: integer("price_snapshot_paise").notNull(),
  qty: integer("qty").notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  razorpayOrderId: text("razorpay_order_id").notNull(),
  razorpayPaymentId: text("razorpay_payment_id"),
  status: text("status").notNull(),
  rawEvent: jsonb("raw_event"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customRequests = pgTable("custom_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  details: text("details").notNull(),
  referenceUrl: text("reference_url"),
  status: customRequestStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
