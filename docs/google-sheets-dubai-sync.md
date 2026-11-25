# Dubai Google Sheets lead sync

The Dubai Meta Ads sheet tab syncs into the CRM as `INTERNATIONAL` leads. Apps Script sends edits to the CRM webhook, and a one-minute trigger checks for changes written by external integrations that do not fire Google Sheets edit triggers.

## Fields and sync rules

- The tab name is `Dubai form 29/10/`.
- The Apps Script scans the first 20 rows for the header row containing `full_name`/`name` and `phone_number`/`phone`.
- `full_name`, `phone_number`, `whatsapp_number`, `email`, `city`, trip purpose, budget, and `lead_status` populate the matching lead fields.
- Budget values are interpreted as INR. All sheet columns are also retained in `sourceData`; `raw_payload` preserves the original row, including the original `lead_status` text.
- Phone numbers with a country prefix are kept in E.164 form. A 10-digit local number defaults to `+91`. If the phone is blank, `created_time + full_name + form_id` identifies the row; row number is never used as an identity.
- Existing CRM leads with the same normalized phone are updated. The sheet is the source of truth for status: matching CRM statuses are applied on every sync; blank or unknown values become `NEW`.
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
6. Run `setupDubaiLeadSync` once and approve the requested permissions. This installs the edit trigger and one-minute change check.
7. Run `syncAllDubaiLeads` once to import existing rows. Later edits sync automatically; rows updated by external tools are detected on the next one-minute check.

The Apps Script execution log reports row-level errors. The webhook also rejects requests without the shared secret and limits batches to 100 rows and 512 KB.
