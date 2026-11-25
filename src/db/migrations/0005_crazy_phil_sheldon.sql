CREATE TABLE "lead_external_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(100) NOT NULL,
	"external_key" varchar(100) NOT NULL,
	"payload_hash" varchar(64),
	"lead_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_external_references" ADD CONSTRAINT "lead_external_references_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_external_references_provider_key_unique" ON "lead_external_references" USING btree ("provider","external_key");--> statement-breakpoint
CREATE INDEX "lead_external_references_lead_id_idx" ON "lead_external_references" USING btree ("lead_id");