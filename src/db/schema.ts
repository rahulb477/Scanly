import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// =============================================================
// USERS
// =============================================================
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 200 }),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 32 }).notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

// =============================================================
// BUSINESSES
// =============================================================
export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessName: varchar("business_name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    logo: text("logo"),
    coverImage: text("cover_image"),
    category: varchar("category", { length: 100 }),
    description: text("description"),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    pincode: varchar("pincode", { length: 32 }),

    googleReviewUrl: text("google_review_url"),
    googlePlaceId: varchar("google_place_id", { length: 200 }),
    googleMapsUrl: text("google_maps_url"),
    websiteUrl: text("website_url"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    youtubeUrl: text("youtube_url"),
    whatsappUrl: text("whatsapp_url"),
    twitterUrl: text("twitter_url"),

    wifiEnabled: boolean("wifi_enabled").notNull().default(false),
    wifiName: varchar("wifi_name", { length: 120 }),
    wifiPassword: varchar("wifi_password", { length: 200 }),
    wifiSecurity: varchar("wifi_security", { length: 16 })
      .notNull()
      .default("WPA"),

    menuEnabled: boolean("menu_enabled").notNull().default(true),
    reviewEnabled: boolean("review_enabled").notNull().default(true),
    aiReviewEnabled: boolean("ai_review_enabled").notNull().default(true),

    theme: varchar("theme", { length: 64 }).notNull().default("coffee"),
    primaryColor: varchar("primary_color", { length: 16 })
      .notNull()
      .default("#7c2d12"),
    secondaryColor: varchar("secondary_color", { length: 16 })
      .notNull()
      .default("#d6a86c"),
    backgroundColor: varchar("background_color", { length: 16 })
      .notNull()
      .default("#fbf6ee"),
    font: varchar("font", { length: 64 }).notNull().default("Inter"),
    tagline: varchar("tagline", { length: 200 }),
    cardStyle: varchar("card_style", { length: 32 })
      .notNull()
      .default("rounded"),
    buttonStyle: varchar("button_style", { length: 32 })
      .notNull()
      .default("solid"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("businesses_slug_idx").on(t.slug),
    ownerIdx: index("businesses_owner_idx").on(t.ownerId),
    createdIdx: index("businesses_created_idx").on(t.createdAt),
  })
);

// =============================================================
// BUSINESS MEMBERS (Owner/Admin/Staff per business)
// =============================================================
export const businessMembers = pgTable(
  "business_members",
  {
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.businessId, t.userId] }),
    userIdx: index("members_user_idx").on(t.userId),
  })
);

// =============================================================
// QR CODES (one per business but stored for analytics)
// =============================================================
export const qrCodes = pgTable("qr_codes", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 100 }).notNull().default("Main QR"),
  style: varchar("style", { length: 32 }).notNull().default("classic"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// =============================================================
// MENU CATEGORIES
// =============================================================
export const menuCategories = pgTable(
  "menu_categories",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bizIdx: index("menu_categories_biz_idx").on(t.businessId),
  })
);

// =============================================================
// MENU ITEMS
// =============================================================
export const menuItems = pgTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    price: varchar("price", { length: 32 }).notNull(),
    image: text("image"),
    available: boolean("available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bizIdx: index("menu_items_biz_idx").on(t.businessId),
    catIdx: index("menu_items_cat_idx").on(t.categoryId),
  })
);

// =============================================================
// ANALYTICS EVENTS
// =============================================================
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    sessionId: varchar("session_id", { length: 100 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bizIdx: index("events_biz_idx").on(t.businessId),
    typeIdx: index("events_type_idx").on(t.type),
    createdIdx: index("events_created_idx").on(t.createdAt),
  })
);

// =============================================================
// REVIEW SESSIONS (AI review in progress)
// =============================================================
export const reviewSessions = pgTable("review_sessions", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  overallExperience: varchar("overall_experience", { length: 32 }),
  staffExperience: varchar("staff_experience", { length: 32 }),
  serviceExperience: varchar("service_experience", { length: 32 }),
  selectedItems: jsonb("selected_items").$type<string[]>().default([]),
  positiveFactors: jsonb("positive_factors").$type<string[]>().default([]),
  customComment: text("custom_comment"),
  language: varchar("language", { length: 16 }).notNull().default("English"),
  tone: varchar("tone", { length: 32 }).notNull().default("Natural"),
  generatedReview: text("generated_review"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// =============================================================
// ACTIVITY LOGS (admin recent activity feed)
// =============================================================
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    actor: varchar("actor", { length: 64 }).notNull().default("system"),
    action: varchar("action", { length: 64 }).notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bizIdx: index("activity_biz_idx").on(t.businessId),
    createdIdx: index("activity_created_idx").on(t.createdAt),
  })
);

// =============================================================
// SESSIONS (auth)
// =============================================================
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// =============================================================
// RELATIONS
// =============================================================
export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  memberships: many(businessMembers),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, { fields: [businesses.ownerId], references: [users.id] }),
  members: many(businessMembers),
  categories: many(menuCategories),
  items: many(menuItems),
  events: many(analyticsEvents),
  qrCodes: many(qrCodes),
  activity: many(activityLogs),
}));

export const menuCategoriesRelations = relations(
  menuCategories,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [menuCategories.businessId],
      references: [businesses.id],
    }),
    items: many(menuItems),
  })
);

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  business: one(businesses, {
    fields: [menuItems.businessId],
    references: [businesses.id],
  }),
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
}));

export const businessMembersRelations = relations(
  businessMembers,
  ({ one }) => ({
    business: one(businesses, {
      fields: [businessMembers.businessId],
      references: [businesses.id],
    }),
    user: one(users, {
      fields: [businessMembers.userId],
      references: [users.id],
    }),
  })
);

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type ReviewSession = typeof reviewSessions.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export { sql };
