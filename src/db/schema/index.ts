import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "SUPER_ADMIN",
  "ADMIN",
  "STAFF",
]);
export const leadStatusEnum = pgEnum("lead_status", [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "JUNK",
]);
export const priorityEnum = pgEnum("priority", ["LOW", "MEDIUM", "HIGH", "HOT"]);
export const followupStatusEnum = pgEnum("followup_status", [
  "PENDING",
  "COMPLETED",
  "MISSED",
  "RESCHEDULED",
  "CANCELLED",
]);
export const customerStatusEnum = pgEnum("customer_status", [
  "ACTIVE",
  "INACTIVE",
  "CHURNED",
]);
export const packageStatusEnum = pgEnum("package_status", ["ACTIVE", "ARCHIVED"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "PAID",
  "PARTIAL",
  "PENDING",
  "REFUNDED",
]);
export const customerPackageStatusEnum = pgEnum("customer_package_status", [
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
]);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    active: boolean("active").default(true).notNull(),
    mustChangePassword: boolean("must_change_password").default(true).notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    version: integer("version").default(1).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_username_unique").on(table.username),
    index("users_role_idx").on(table.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const accountsSecurity = pgTable("accounts_security", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  totpSecretEncrypted: text("totp_secret_encrypted"),
  recoveryCodesHash: jsonb("recovery_codes_hash").$type<string[]>().default([]),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("password_reset_token_hash_unique").on(table.tokenHash)],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 100 }).notNull(),
    description: text("description"),
  },
  (table) => [uniqueIndex("permissions_key_unique").on(table.key)],
);

export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("user_permission_unique").on(table.userId, table.permissionId)],
);

export const leadSources = pgTable("lead_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").default(true).notNull(),
  ...auditColumns,
});

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    alternatePhone: varchar("alternate_phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    company: varchar("company", { length: 150 }),
    description: text("description"),
    sourceData: jsonb("source_data").$type<Record<string, string>>(),
    market: varchar("market", { length: 20 }).default("DOMESTIC").notNull(),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    country: varchar("country", { length: 100 }),
    sourceId: uuid("source_id").references(() => leadSources.id),
    packageId: uuid("package_id").references(() => packages.id),
    budget: integer("budget"),
    status: leadStatusEnum("status").default("NEW").notNull(),
    priority: priorityEnum("priority").default("MEDIUM").notNull(),
    assignedTo: uuid("assigned_to").references(() => users.id),
    lostReason: text("lost_reason"),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...auditColumns,
  },
  (table) => [
    index("leads_status_assigned_created_idx").on(table.status, table.assignedTo, table.createdAt),
    index("leads_market_created_idx")
      .on(table.market, table.createdAt)
      .where(sql`${table.deletedAt} is null`),
    index("leads_active_created_idx").on(table.createdAt).where(sql`${table.deletedAt} is null`),
    uniqueIndex("leads_active_phone_unique").on(table.phone).where(sql`${table.deletedAt} is null`),
  ],
);

export const leadExternalReferences = pgTable(
  "lead_external_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 100 }).notNull(),
    externalKey: varchar("external_key", { length: 100 }).notNull(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("lead_external_references_provider_key_unique").on(
      table.provider,
      table.externalKey,
    ),
    index("lead_external_references_lead_id_idx").on(table.leadId),
  ],
);

export const leadNotes = pgTable("lead_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }),
});

export const leadTags = pgTable(
  "lead_tags",
  {
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("lead_tag_unique").on(table.leadId, table.tagId)],
);

export const followups = pgTable(
  "followups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    type: varchar("type", { length: 30 }).notNull(),
    status: followupStatusEnum("status").default("PENDING").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    outcomeNote: text("outcome_note"),
    priority: priorityEnum("priority").default("MEDIUM").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    ...auditColumns,
  },
  (table) => [
    index("followups_due_status_assigned_idx").on(table.dueAt, table.status, table.assignedTo),
    index("followups_lead_status_due_idx")
      .on(table.leadId, table.status, table.dueAt)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    gstNumberEncrypted: text("gst_number_encrypted"),
    panNumberEncrypted: text("pan_number_encrypted"),
    status: customerStatusEnum("status").default("ACTIVE").notNull(),
    assignedTo: uuid("assigned_to").references(() => users.id),
    sourceLeadId: uuid("source_lead_id").references(() => leads.id),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...auditColumns,
  },
  (table) => [index("customers_assigned_status_idx").on(table.assignedTo, table.status)],
);

export const packages = pgTable("packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  price: integer("price").notNull(),
  durationDays: integer("duration_days"),
  taxPercent: integer("tax_percent").default(0).notNull(),
  features: jsonb("features").$type<string[]>().default([]),
  status: packageStatusEnum("status").default("ACTIVE").notNull(),
  ...auditColumns,
});

export const customerPackages = pgTable(
  "customer_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    packageId: uuid("package_id").notNull().references(() => packages.id),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }).notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
    priceSnapshot: integer("price_snapshot").notNull(),
    discount: integer("discount").default(0).notNull(),
    tax: integer("tax").default(0).notNull(),
    finalAmount: integer("final_amount").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").default("PENDING").notNull(),
    paymentMode: varchar("payment_mode", { length: 50 }),
    transactionReference: varchar("transaction_reference", { length: 150 }),
    invoiceNo: varchar("invoice_no", { length: 100 }),
    soldBy: uuid("sold_by").references(() => users.id),
    status: customerPackageStatusEnum("status").default("ACTIVE").notNull(),
    ...auditColumns,
  },
  (table) => [
    index("customer_packages_customer_status_idx").on(table.customerId, table.status),
    index("customer_packages_expiry_idx").on(table.expiryDate),
  ],
);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerPackageId: uuid("customer_package_id").notNull().references(() => customerPackages.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
  mode: varchar("mode", { length: 50 }),
  status: paymentStatusEnum("status").default("PENDING").notNull(),
  referenceNo: varchar("reference_no", { length: 150 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    priority: priorityEnum("priority").default("MEDIUM").notNull(),
    status: taskStatusEnum("status").default("TODO").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    leadId: uuid("lead_id").references(() => leads.id),
    customerId: uuid("customer_id").references(() => customers.id),
    version: integer("version").default(1).notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...auditColumns,
  },
  (table) => [index("tasks_status_due_idx").on(table.status, table.dueAt)],
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("task_assignee_unique").on(table.taskId, table.userId)],
);

export const taskComments = pgTable("task_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("notifications_user_created_idx").on(table.userId, table.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_actor_action_created_idx").on(table.actorId, table.action, table.createdAt),
  ],
);

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdBy: uuid("created_by").references(() => users.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  totalRows: integer("total_rows").default(0).notNull(),
  successRows: integer("success_rows").default(0).notNull(),
  errorRows: integer("error_rows").default(0).notNull(),
  report: jsonb("report").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 100 }).notNull(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  permissions: many(userPermissions),
  security: one(accountsSecurity, {
    fields: [users.id],
    references: [accountsSecurity.userId],
  }),
}));

