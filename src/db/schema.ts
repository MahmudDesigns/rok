import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "NATIONAL_OFFICER",
  "COUNTY_OFFICER",
  "WAREHOUSE_MANAGER",
  "PARTNER",
]);

export const distributionStatusEnum = pgEnum("distribution_status", [
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "QUEUED",
  "SENT",
  "FAILED",
]);

export const counties = pgTable("counties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  isAsal: boolean("is_asal").notNull().default(false),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  countyId: integer("county_id").references(() => counties.id),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  countyId: integer("county_id")
    .notNull()
    .references(() => counties.id),
  location: text("location"),
  capacityTonnes: doublePrecision("capacity_tonnes").notNull().default(1000),
});

export const foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  kgPerUnit: doublePrecision("kg_per_unit").notNull().default(1),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(200),
});

export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    foodItemId: integer("food_item_id")
      .notNull()
      .references(() => foodItems.id),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("inventory_warehouse_item_uq").on(t.warehouseId, t.foodItemId)],
);

export const stockIntakes = pgTable(
  "stock_intakes",
  {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    foodItemId: integer("food_item_id")
      .notNull()
      .references(() => foodItems.id),
    quantity: integer("quantity").notNull(),
    source: text("source").notNull(),
    reference: text("reference"),
    notes: text("notes"),
    receivedById: integer("received_by_id").references(() => users.id),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (t) => [index("intakes_warehouse_idx").on(t.warehouseId)],
);

export const beneficiaries = pgTable(
  "beneficiaries",
  {
    id: serial("id").primaryKey(),
    nationalId: text("national_id").notNull().unique(),
    fullName: text("full_name").notNull(),
    gender: text("gender").notNull().default("FEMALE"),
    birthYear: integer("birth_year"),
    phone: text("phone"),
    countyId: integer("county_id")
      .notNull()
      .references(() => counties.id),
    subCounty: text("sub_county"),
    village: text("village"),
    householdSize: integer("household_size").notNull().default(1),
    vulnerability: text("vulnerability").notNull().default("NONE"),
    active: boolean("active").notNull().default(true),
    registeredById: integer("registered_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("beneficiaries_county_idx").on(t.countyId),
    index("beneficiaries_name_idx").on(t.fullName),
  ],
);

export const distributions = pgTable(
  "distributions",
  {
    id: serial("id").primaryKey(),
    ref: text("ref").notNull().unique(),
    title: text("title").notNull(),
    countyId: integer("county_id")
      .notNull()
      .references(() => counties.id),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    venue: text("venue").notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    status: distributionStatusEnum("status").notNull().default("SCHEDULED"),
    notes: text("notes"),
    createdById: integer("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [index("distributions_county_idx").on(t.countyId)],
);

export const distributionItems = pgTable(
  "distribution_items",
  {
    id: serial("id").primaryKey(),
    distributionId: integer("distribution_id")
      .notNull()
      .references(() => distributions.id),
    foodItemId: integer("food_item_id")
      .notNull()
      .references(() => foodItems.id),
    plannedQty: integer("planned_qty").notNull(),
    issuedQty: integer("issued_qty").notNull().default(0),
  },
  (t) => [
    uniqueIndex("distribution_items_dist_item_uq").on(t.distributionId, t.foodItemId),
  ],
);

export const issueRecords = pgTable(
  "issue_records",
  {
    id: serial("id").primaryKey(),
    distributionId: integer("distribution_id")
      .notNull()
      .references(() => distributions.id),
    beneficiaryId: integer("beneficiary_id")
      .notNull()
      .references(() => beneficiaries.id),
    foodItemId: integer("food_item_id")
      .notNull()
      .references(() => foodItems.id),
    quantity: integer("quantity").notNull(),
    issuedById: integer("issued_by_id").references(() => users.id),
    issuedAt: timestamp("issued_at").notNull().defaultNow(),
  },
  (t) => [
    index("issue_records_dist_idx").on(t.distributionId),
    index("issue_records_beneficiary_idx").on(t.beneficiaryId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    distributionId: integer("distribution_id").references(() => distributions.id),
    beneficiaryId: integer("beneficiary_id").references(() => beneficiaries.id),
    channel: text("channel").notNull().default("SMS"),
    phone: text("phone"),
    message: text("message").notNull(),
    status: notificationStatusEnum("status").notNull().default("QUEUED"),
    providerRef: text("provider_ref"),
    queuedAt: timestamp("queued_at").notNull().defaultNow(),
    sentAt: timestamp("sent_at"),
  },
  (t) => [index("notifications_status_idx").on(t.status)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: text("detail"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export type County = typeof counties.$inferSelect;
export type User = typeof users.$inferSelect;
export type Role = User["role"];
export type Warehouse = typeof warehouses.$inferSelect;
export type FoodItem = typeof foodItems.$inferSelect;
export type InventoryRow = typeof inventory.$inferSelect;
export type StockIntake = typeof stockIntakes.$inferSelect;
export type Beneficiary = typeof beneficiaries.$inferSelect;
export type Distribution = typeof distributions.$inferSelect;
export type DistributionStatus = Distribution["status"];
export type DistributionItem = typeof distributionItems.$inferSelect;
export type IssueRecord = typeof issueRecords.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
