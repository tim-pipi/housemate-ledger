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
