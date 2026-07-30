CREATE TABLE IF NOT EXISTS "house_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"house_id" integer NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"next_date" date NOT NULL,
	"recurrence" jsonb NOT NULL,
	"remind_days_before" integer DEFAULT 1 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"last_reminded_on" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "house_events" ADD CONSTRAINT "house_events_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "house_events" ADD CONSTRAINT "house_events_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
