ALTER TABLE "leads" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "package_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;