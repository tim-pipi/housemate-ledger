CREATE TABLE IF NOT EXISTS "shopping_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"house_id" integer NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"added_by" integer NOT NULL,
	"bought_by" integer,
	"bought_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_added_by_members_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_bought_by_members_id_fk" FOREIGN KEY ("bought_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
