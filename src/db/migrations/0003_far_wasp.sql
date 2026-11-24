ALTER TABLE "leads" ADD COLUMN "market" varchar(20) DEFAULT 'DOMESTIC' NOT NULL;--> statement-breakpoint
CREATE INDEX "leads_market_created_idx" ON "leads" USING btree ("market","created_at") WHERE "leads"."deleted_at" is null;--> statement-breakpoint
UPDATE "packages"
SET "category" = CASE
  WHEN upper("name") = 'DUBAI' THEN 'INTERNATIONAL'
  ELSE 'DOMESTIC'
END
WHERE upper("name") IN ('GOA', 'MANALI', 'DUBAI')
  AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "leads" AS lead
SET "market" = 'INTERNATIONAL'
FROM "packages" AS package
WHERE lead."package_id" = package."id"
  AND upper(package."category") = 'INTERNATIONAL'
  AND lead."deleted_at" IS NULL;--> statement-breakpoint
INSERT INTO "packages" ("name", "code", "description", "category", "price", "status")
SELECT 'Goa', 'JMT-GOA-DOMESTIC', 'Starting price INR 7,000; typical package range INR 7,000-8,000.', 'DOMESTIC', 7000, 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM "packages"
  WHERE lower("name") = 'goa' AND "category" = 'DOMESTIC' AND "deleted_at" IS NULL
);--> statement-breakpoint
INSERT INTO "packages" ("name", "code", "description", "category", "price", "status")
SELECT 'Manali', 'JMT-MANALI-DOMESTIC', 'Manali travel package.', 'DOMESTIC', 18000, 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM "packages"
  WHERE lower("name") = 'manali' AND "category" = 'DOMESTIC' AND "deleted_at" IS NULL
);--> statement-breakpoint
INSERT INTO "packages" ("name", "code", "description", "category", "price", "status")
SELECT 'Dubai', 'JMT-DUBAI-INTERNATIONAL', 'Dubai travel package.', 'INTERNATIONAL', 28800, 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM "packages"
  WHERE lower("name") = 'dubai' AND "category" = 'INTERNATIONAL' AND "deleted_at" IS NULL
);--> statement-breakpoint
