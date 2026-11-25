CREATE TYPE "public"."lead_category" AS ENUM('TICKET', 'VISA', 'HOLIDAY');--> statement-breakpoint
CREATE TYPE "public"."lead_query_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "lead_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"assigned_to" uuid NOT NULL,
	"assigned_by" uuid,
	"status" "lead_query_status" DEFAULT 'OPEN' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "category" "lead_category";--> statement-breakpoint
ALTER TABLE "lead_queries" ADD CONSTRAINT "lead_queries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_queries" ADD CONSTRAINT "lead_queries_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_queries" ADD CONSTRAINT "lead_queries_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_queries" ADD CONSTRAINT "lead_queries_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_queries_lead_assigned_idx" ON "lead_queries" USING btree ("lead_id","assigned_at");--> statement-breakpoint
CREATE INDEX "lead_queries_assigned_status_idx" ON "lead_queries" USING btree ("assigned_to","status","assigned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_queries_one_open_per_lead_unique" ON "lead_queries" USING btree ("lead_id") WHERE "lead_queries"."status" = 'OPEN';
--> statement-breakpoint
CREATE FUNCTION public.track_lead_assignment_query() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	UPDATE public.lead_queries
	SET status = 'CLOSED', closed_at = now(), closed_by = NEW.updated_by
	WHERE lead_id = NEW.id AND status = 'OPEN';

	IF NEW.assigned_to IS NOT NULL THEN
		INSERT INTO public.lead_queries (lead_id, assigned_to, assigned_by)
		VALUES (NEW.id, NEW.assigned_to, NEW.updated_by)
		ON CONFLICT DO NOTHING;
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER leads_assignment_query_history
AFTER UPDATE OF assigned_to ON public.leads
FOR EACH ROW
WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION public.track_lead_assignment_query();
--> statement-breakpoint
INSERT INTO public.lead_queries (lead_id, assigned_to, assigned_by, assigned_at)
SELECT id, assigned_to, updated_by, now()
FROM public.leads
WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;