const DUBAI_SHEET_TAB = "Dubai form 29/10/";
const DUBAI_CRM_WEBHOOK_URL =
  "https://jmt-crm.vercel.app/api/integrations/google-sheets/dubai";
const ROWS_PER_REQUEST = 20;
const HEADER_SCAN_LIMIT = 20;

function setupDubaiLeadSync() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet.getSheetByName(DUBAI_SHEET_TAB)) {
    throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);
  }
  PropertiesService.getScriptProperties().setProperty(
    "JMT_CRM_WEBHOOK_URL",
    DUBAI_CRM_WEBHOOK_URL,
  );

  ScriptApp.getProjectTriggers()
    .filter((trigger) =>
      ["onDubaiSheetEdit", "syncChangedDubaiLeads"].includes(trigger.getHandlerFunction())
    )
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("onDubaiSheetEdit")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  ScriptApp.newTrigger("syncChangedDubaiLeads")
    .timeBased()
    .everyMinutes(1)
    .create();
}

function onDubaiSheetEdit(event) {
  if (!event || !event.range) return;
  const sheet = event.range.getSheet();
  if (sheet.getName() !== DUBAI_SHEET_TAB) return;

  const header = findHeaderRow_(sheet);
  if (event.range.getLastRow() <= header.rowNumber) return;
  const firstRow = Math.max(header.rowNumber + 1, event.range.getRow());
  const lastRow = event.range.getLastRow();
  const values = sheet
    .getRange(firstRow, 1, lastRow - firstRow + 1, header.headers.length)
    .getDisplayValues();
  const result = collectSyncRows_(header.headers, values, firstRow);

  reportSkippedRows_(result.skippedRowNumbers);
  throwSyncErrors_(sendDubaiRows_(result.rows));
}

function syncAllDubaiLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DUBAI_SHEET_TAB);
  if (!sheet) throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);

  const lastRow = sheet.getLastRow();
  const header = findHeaderRow_(sheet);
  if (lastRow <= header.rowNumber) return;
  let errors = [];
  let skippedRowNumbers = [];

  for (
    let firstRow = header.rowNumber + 1;
    firstRow <= lastRow;
    firstRow += ROWS_PER_REQUEST
  ) {
    const rowCount = Math.min(ROWS_PER_REQUEST, lastRow - firstRow + 1);
    const values = sheet
      .getRange(firstRow, 1, rowCount, header.headers.length)
      .getDisplayValues();
    const result = collectSyncRows_(header.headers, values, firstRow);
    if (result.rows.length > 0) errors = errors.concat(sendDubaiRows_(result.rows));
    skippedRowNumbers = skippedRowNumbers.concat(result.skippedRowNumbers);
  }
  reportSkippedRows_(skippedRowNumbers);
  throwSyncErrors_(errors);
}

function syncChangedDubaiLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DUBAI_SHEET_TAB);
  if (!sheet) throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);

  const lastRow = sheet.getLastRow();
  const header = findHeaderRow_(sheet);
  if (lastRow <= header.rowNumber) return;
  let errors = [];
  let skippedRowNumbers = [];

  for (
    let firstRow = header.rowNumber + 1;
    firstRow <= lastRow;
    firstRow += ROWS_PER_REQUEST
  ) {
    const rowCount = Math.min(ROWS_PER_REQUEST, lastRow - firstRow + 1);
    const values = sheet
      .getRange(firstRow, 1, rowCount, header.headers.length)
      .getDisplayValues();
    const result = collectSyncRows_(header.headers, values, firstRow);
    if (result.rows.length > 0) errors = errors.concat(sendDubaiRows_(result.rows));
    skippedRowNumbers = skippedRowNumbers.concat(result.skippedRowNumbers);
  }
  reportSkippedRows_(skippedRowNumbers);
  throwSyncErrors_(errors);
}

function findHeaderRow_(sheet) {
  const rowsToScan = Math.min(sheet.getLastRow(), HEADER_SCAN_LIMIT);
  const columns = sheet.getLastColumn();
  if (rowsToScan < 1 || columns < 1) {
    throw new Error("The Dubai sheet is empty or has no columns.");
  }

  const candidates = sheet.getRange(1, 1, rowsToScan, columns).getDisplayValues();
  const knownHeaders = new Set([
    "fullname",
    "name",
    "leadname",
    "customername",
    "contactname",
    "firstname",
    "lastname",
    "phonenumber",
    "phone",
    "phoneno",
    "primaryphone",
    "mobilenumber",
    "mobile",
    "mobileno",
    "primarymobile",
    "contactmobile",
    "contactnumber",
    "telephone",
    "whatsappnumber",
    "alternatephone",
    "email",
    "emailaddress",
    "city",
    "createdtime",
    "formid",
    "leadstatus",
    "category",
    "leadcategory",
    "budget",
    "whatisthepurposeofyourdubaitrip",
    "whatisyourapproximatebudgetperperson",
  ]);
  let bestMatch = null;
  let bestScore = -1;
  for (let index = 0; index < candidates.length; index += 1) {
    const headers = candidates[index];
    const normalized = headers.map(normalizeSheetHeader_);
    const hasName = normalized.some((value) =>
      [
        "fullname",
        "name",
        "leadname",
        "customername",
        "contactname",
        "firstname",
        "lastname",
      ].includes(value),
    );
    const hasPhone = normalized.some((value) =>
      [
        "phonenumber",
        "phone",
        "phoneno",
        "primaryphone",
        "mobilenumber",
        "mobile",
        "mobileno",
        "primarymobile",
        "contactmobile",
        "contactnumber",
        "telephone",
      ].includes(value),
    );
    if (hasName && hasPhone) {
      const score = normalized.filter((value) => knownHeaders.has(value)).length;
      if (score > bestScore) {
        bestMatch = { rowNumber: index + 1, headers };
        bestScore = score;
      }
    }
  }

  if (bestMatch) return bestMatch;
  throw new Error(
    `Could not find a header row with full_name and phone_number in the first ${HEADER_SCAN_LIMIT} rows.`,
  );
}

function normalizeSheetHeader_(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toSyncRow_(headers, row, rowNumber) {
  const values = {};
  headers.forEach((header, index) => {
    const name = String(header).trim();
    if (name) values[name] = String(row[index] || "");
  });
  if (Object.values(values).every((value) => value.trim() === "")) return null;
  const leadName = sheetLeadName_(headers, values);
  if (!leadName) return null;
  return { rowNumber, values };
}

function sheetLeadName_(headers, values) {
  const nameHeader = headers.find((header) =>
    ["fullname", "name", "leadname", "customername", "contactname"].includes(
      normalizeSheetHeader_(header),
    ),
  );
  if (nameHeader && values[String(nameHeader).trim()]?.trim()) {
    return values[String(nameHeader).trim()].trim();
  }
  const firstNameHeader = headers.find(
    (header) => normalizeSheetHeader_(header) === "firstname",
  );
  const lastNameHeader = headers.find(
    (header) => normalizeSheetHeader_(header) === "lastname",
  );
  return [
    firstNameHeader ? values[String(firstNameHeader).trim()] : "",
    lastNameHeader ? values[String(lastNameHeader).trim()] : "",
  ]
    .map((value) => (value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function collectSyncRows_(headers, values, firstRow) {
  const rows = [];
  const skippedRowNumbers = [];
  values.forEach((row, index) => {
    const rowNumber = firstRow + index;
    const syncRow = toSyncRow_(headers, row, rowNumber);
    if (syncRow) {
      rows.push(syncRow);
    } else if (row.some((value) => String(value || "").trim() !== "")) {
      skippedRowNumbers.push(rowNumber);
    }
  });
  return { rows, skippedRowNumbers };
}

function reportSkippedRows_(rowNumbers) {
  const properties = PropertiesService.getScriptProperties();
  const currentSignature = rowNumbers.join(",");
  const previousSignature = properties.getProperty("JMT_CRM_LAST_SKIPPED_ROWS") || "";
  if (currentSignature === previousSignature) return;

  properties.setProperty("JMT_CRM_LAST_SKIPPED_ROWS", currentSignature);
  if (rowNumbers.length === 0) {
    if (previousSignature) console.log("Previously skipped sheet rows now have lead names.");
    return;
  }

  const shownRows = rowNumbers.slice(0, 20).join(", ");
  const remainder = rowNumbers.length > 20 ? ` and ${rowNumbers.length - 20} more` : "";
  console.warn(
    `Skipped ${rowNumbers.length} non-empty sheet row(s) without a recognized lead name: ${shownRows}${remainder}.`,
  );
}

function throwSyncErrors_(errors) {
  if (errors.length > 0) {
    throw new Error(
      `${errors.length} CRM sync batch(es) had row errors. See the preceding execution log entries.`,
    );
  }
}

function sendDubaiRows_(rows) {
  if (!rows.length) return [];

  const properties = PropertiesService.getScriptProperties();
  const endpoint =
    properties.getProperty("JMT_CRM_WEBHOOK_URL") || DUBAI_CRM_WEBHOOK_URL;
  const secret = properties.getProperty("JMT_CRM_WEBHOOK_SECRET");
  const errors = [];
  if (!secret) {
    throw new Error("Set JMT_CRM_WEBHOOK_SECRET in Script Properties.");
  }

  for (let offset = 0; offset < rows.length; offset += ROWS_PER_REQUEST) {
    const batch = rows.slice(offset, offset + ROWS_PER_REQUEST);
    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      headers: { "x-jmt-webhook-secret": secret },
      payload: JSON.stringify({ rows: batch }),
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    const responseText = response.getContentText();
    if (status < 200 || status >= 300) {
      throw new Error(`CRM sync failed with HTTP ${status}: ${responseText.slice(0, 500)}`);
    }

    const result = JSON.parse(responseText);
    if (result.failed > 0) {
      const message = `CRM sync: ${result.failed} row(s) failed: ${JSON.stringify(result.errors)}`;
      console.error(message);
      errors.push(message);
    } else {
      console.log(
        `CRM sync complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`,
      );
    }
  }
  return errors;
}
