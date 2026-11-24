DROP INDEX "leads_phone_idx";--> statement-breakpoint
CREATE INDEX "followups_lead_status_due_idx" ON "followups" USING btree ("lead_id","status","due_at") WHERE "followups"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "leads_active_created_idx" ON "leads" USING btree ("created_at") WHERE "leads"."deleted_at" is null;