import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const houses = pgTable("houses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").notNull().default("SGD"),
  telegramChatId: text("telegram_chat_id"),
  telegramLinkCode: text("telegram_link_code"),
  lastDigestDate: text("last_digest_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    houseId: integer("house_id")
      .notNull()
      .references(() => houses.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    passwordHash: text("password_hash"),
    color: text("color").notNull(),
    active: integer("active").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("members_house_username").on(t.houseId, t.username)]
);

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  houseId: integer("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category").notNull(),
  date: date("date").notNull(),
  payerMemberId: integer("payer_member_id")
    .notNull()
    .references(() => members.id),
  splitMethod: text("split_method").notNull(), // equal | exact | percent | shares | adjustment
  splitConfig: jsonb("split_config").notNull(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => members.id),
  updatedBy: integer("updated_by").references(() => members.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const expenseShares = pgTable(
  "expense_shares",
  {
    id: serial("id").primaryKey(),
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    shareCents: integer("share_cents").notNull(),
  },
  (t) => [uniqueIndex("shares_expense_member").on(t.expenseId, t.memberId)]
);

export const settlements = pgTable("settlements", {
  id: serial("id").primaryKey(),
  houseId: integer("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  fromMemberId: integer("from_member_id")
    .notNull()
    .references(() => members.id),
  toMemberId: integer("to_member_id")
    .notNull()
    .references(() => members.id),
  amountCents: integer("amount_cents").notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => members.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Shared shopping list. Status is derived, never stored: open = boughtAt
// IS NULL, bought = boughtAt NOT NULL AND archivedAt IS NULL, archived =
// hidden (set by "Clear bought", a soft delete — rows are kept).
export const shoppingItems = pgTable("shopping_items", {
  id: serial("id").primaryKey(),
  houseId: integer("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  note: text("note"),
  addedBy: integer("added_by")
    .notNull()
    .references(() => members.id),
  boughtBy: integer("bought_by").references(() => members.id),
  boughtAt: timestamp("bought_at"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// House calendar / reminders — deliberately separate from recurring_templates.
// recurring_templates auto-posts the rent EXPENSE (ledger entry); house_events
// reminds about doing things in the real world (paying the landlord, booking
// servicing). Different lifecycles, different failure impact — do not merge.
export const houseEvents = pgTable("house_events", {
  id: serial("id").primaryKey(),
  houseId: integer("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  note: text("note"),
  nextDate: date("next_date").notNull(),
  recurrence: jsonb("recurrence").notNull(), // see Recurrence type in lib/events.ts
  remindDaysBefore: integer("remind_days_before").notNull().default(1),
  active: integer("active").notNull().default(1),
  lastRemindedOn: text("last_reminded_on"), // "YYYY-MM-DD" idempotency
  createdBy: integer("created_by")
    .notNull()
    .references(() => members.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// M4: recurring templates (schema ready; cron generation comes later)
export const recurringTemplates = pgTable("recurring_templates", {
  id: serial("id").primaryKey(),
  houseId: integer("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category").notNull(),
  payerMemberId: integer("payer_member_id")
    .notNull()
    .references(() => members.id),
  splitMethod: text("split_method").notNull(),
  splitConfig: jsonb("split_config").notNull(),
  dayOfMonth: integer("day_of_month").notNull(),
  active: integer("active").notNull().default(1),
  lastPostedMonth: text("last_posted_month"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
