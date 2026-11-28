# Dubai Google Sheets lead sync

The Dubai Meta Ads sheet tab syncs into the CRM as `INTERNATIONAL` leads. Apps Script sends edits to the CRM webhook, and a one-minute trigger checks for changes written by external integrations that do not fire Google Sheets edit triggers.

## Fields and sync rules

- The tab name is `Dubai form 29/10/`.
- The Apps Script scans the first 20 rows for a name and phone header. Lead rows can be above or below the header; the header row itself is never sent. It supports `full_name`, `name`, `lead_name`, `customer_name`, `contact_name`, or separate `first_name` / `last_name` columns. Supported phone headers include `phone_number`, `phone`, `phone_no`, `primary_phone`, `mobile_number`, `mobile`, `mobile_no`, `primary_mobile`, `contact_mobile`, `contact_number`, and `telephone`.
- `full_name`, `phone_number`, `whatsapp_number`, `email`, `city`, trip purpose, budget, and `lead_status` populate the matching lead fields.
- Budget values are interpreted as INR. All sheet columns are also retained in `sourceData`; `raw_payload` preserves the original row, including the original `lead_status` text.
- Phone numbers with a country prefix are kept in E.164 form. A 10-digit local number defaults to `+91`. Meta `lead_id` (or `id`) is the preferred stable identity; `created_time + form_id` and normalized phone are fallbacks. Legacy references are recognized and upgraded during sync. Row number is never used as a CRM identity.
- Existing CRM leads with the same normalized phone are updated. Mapped sheet fields, including blank values, are the source of truth and replace their CRM counterparts; blank optional fields clear the CRM value. Status is also sheet-owned; blank or unknown values become `NEW`.
- Removing a row from the sheet does not delete its CRM lead.
- An open Leads page refreshes to show synced changes within 15 seconds.

## Configure and deploy

1. Generate and apply the database migration after configuring the database URLs:

   ```powershell
   npm run db:generate
   npm run db:migrate
   ```

2. Generate a random secret locally (at least 32 characters), then set it as `GOOGLE_SHEETS_WEBHOOK_SECRET` in `.env.local` and in the production hosting environment. Do not commit the value or send it in chat.

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. Deploy/restart the CRM so the webhook is available at:

   ```text
   https://jmt-crm.vercel.app/api/integrations/google-sheets/dubai
   ```

4. Open the Dubai spreadsheet and select **Extensions → Apps Script**. Add the contents of [`scripts/google-sheets-dubai-sync.gs`](../scripts/google-sheets-dubai-sync.gs) to its bound Apps Script project.
5. In Apps Script **Project Settings → Script Properties**, add `JMT_CRM_WEBHOOK_SECRET` with the same secret used by the CRM environment. `setupDubaiLeadSync` writes `JMT_CRM_WEBHOOK_URL` automatically as `https://jmt-crm.vercel.app/api/integrations/google-sheets/dubai`.
6. Run `setupDubaiLeadSync` once and approve the requested permissions. Setup verifies the sheet headers, secret, and CRM webhook before installing the edit trigger and one-minute change check.
7. Run `testDubaiLeadSyncConnection` to verify the configured tab, detected header row, trigger installation, and webhook connection. The execution log reports the result without sending lead data.
8. Run `syncAllDubaiLeads` once to sync existing rows. Later edits sync automatically; rows updated by external tools are detected on the next one-minute check. Only changed row contents are sent during polling; the cache expires after six hours, when a full recheck can sync the sheet again.

Rows without a lead name or a usable identity are skipped and listed in the execution log with their row numbers. The Apps Script retries transient webhook/network failures, continues through later batches, and reports per-row CRM validation errors. A failed row is not marked synced, so the next poll retries it. The webhook rejects requests without the shared secret and limits batches to 100 rows and 512 KB.

If setup or sync fails, open Apps Script **Executions** and run `testDubaiLeadSyncConnection`. HTTP `401` means the script and production secrets do not match; `503` means the secret is missing in production; `404` or other HTTP errors usually indicate the webhook URL/deployment is wrong. Fix the reported configuration and run `syncAllDubaiLeads` again.
