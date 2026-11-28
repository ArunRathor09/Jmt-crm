const DUBAI_SHEET_TAB = "Dubai form 29/10/";
const DUBAI_CRM_WEBHOOK_URL =
  "https://jmt-crm.vercel.app/api/integrations/google-sheets/dubai";
const ROWS_PER_REQUEST = 20;
const HEADER_SCAN_LIMIT = 20;
const ROW_HASH_CACHE_TTL_SECONDS = 21600;

function setupDubaiLeadSync() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(DUBAI_SHEET_TAB);
  if (!sheet) {
    throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);
  }
  findHeaderRow_(sheet);

  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty("JMT_CRM_WEBHOOK_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error(
      "Set JMT_CRM_WEBHOOK_SECRET in Script Properties. It must match the CRM secret and be at least 32 characters.",
    );
  }
  properties.setProperty("JMT_CRM_WEBHOOK_URL", DUBAI_CRM_WEBHOOK_URL);
  checkWebhookConnection_();

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
  console.log("Dubai lead sync is configured. Run syncAllDubaiLeads once to sync existing rows.");
}

function testDubaiLeadSyncConnection() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(DUBAI_SHEET_TAB);
  if (!sheet) throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);
  const header = findHeaderRow_(sheet);
  const rows = collectSheetRows_(sheet, header, 1, sheet.getLastRow());
  const triggerNames = ScriptApp.getProjectTriggers().map((trigger) =>
    trigger.getHandlerFunction(),
  );
  console.log(
    JSON.stringify({
      spreadsheet: spreadsheet.getName(),
      sheet: DUBAI_SHEET_TAB,
      headerRow: header.rowNumber,
      leadRowsFound: rows.rows.length,
      skippedRows: rows.skippedRowNumbers,
      editTriggerInstalled: triggerNames.includes("onDubaiSheetEdit"),
      pollingTriggerInstalled: triggerNames.includes("syncChangedDubaiLeads"),
    }),
  );
  checkWebhookConnection_();
}

function checkWebhookConnection_() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint =
    properties.getProperty("JMT_CRM_WEBHOOK_URL") || DUBAI_CRM_WEBHOOK_URL;
  const secret = properties.getProperty("JMT_CRM_WEBHOOK_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error("JMT_CRM_WEBHOOK_SECRET is missing or shorter than 32 characters.");
  }

  let response;
  try {
    response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      headers: { "x-jmt-webhook-secret": secret },
      payload: JSON.stringify({ rows: [] }),
      muteHttpExceptions: true,
    });
  } catch (error) {
    throw new Error(
      `Could not reach the CRM webhook at ${endpoint}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status === 400 && body.includes("Expected 1-100 rows")) {
    console.log("CRM webhook connected and shared secret accepted.");
    return;
  }
  if (status === 401) {
    throw new Error("CRM webhook rejected the secret. Match Script Properties to the CRM production secret.");
  }
  if (status === 503) {
    throw new Error("CRM webhook is deployed, but GOOGLE_SHEETS_WEBHOOK_SECRET is not configured in production.");
  }
  throw new Error(
    `CRM webhook check failed with HTTP ${status}: ${body.slice(0, 500)}`,
  );
}

function onDubaiSheetEdit(event) {
  if (!event || !event.range) return;
  const sheet = event.range.getSheet();
  if (sheet.getName() !== DUBAI_SHEET_TAB) return;

  const header = findHeaderRow_(sheet);
  const result = collectSheetRows_(
    sheet,
    header,
    event.range.getRow(),
    event.range.getLastRow(),
  );

  reportSkippedRows_(result.skippedRowNumbers);
  const syncResult = syncRows_(result.rows, false);
  throwSyncErrors_(syncResult.errors);
}

function syncAllDubaiLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DUBAI_SHEET_TAB);
  if (!sheet) throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);

  const lastRow = sheet.getLastRow();
  const header = findHeaderRow_(sheet);
  if (lastRow < 1) return;
  let errors = [];
  let skippedRowNumbers = [];
  let synced = 0;
  let unchanged = 0;

  for (
    let firstRow = 1;
    firstRow <= lastRow;
    firstRow += ROWS_PER_REQUEST
  ) {
    const rowCount = Math.min(ROWS_PER_REQUEST, lastRow - firstRow + 1);
    const result = collectSheetRows_(sheet, header, firstRow, firstRow + rowCount - 1);
    const syncResult = syncRows_(result.rows, false);
    errors = errors.concat(syncResult.errors);
    synced += syncResult.synced;
    unchanged += syncResult.unchanged;
    skippedRowNumbers = skippedRowNumbers.concat(result.skippedRowNumbers);
  }
  reportSkippedRows_(skippedRowNumbers);
  console.log(`Full sync finished: ${synced} sent, ${unchanged} unchanged in CRM.`);
  throwSyncErrors_(errors);
}

function syncChangedDubaiLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DUBAI_SHEET_TAB);
  if (!sheet) throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);

  const lastRow = sheet.getLastRow();
  const header = findHeaderRow_(sheet);
  if (lastRow < 1) return;
  let errors = [];
  let skippedRowNumbers = [];
  let synced = 0;
  let unchanged = 0;

  for (
    let firstRow = 1;
    firstRow <= lastRow;
    firstRow += ROWS_PER_REQUEST
  ) {
    const rowCount = Math.min(ROWS_PER_REQUEST, lastRow - firstRow + 1);
    const result = collectSheetRows_(sheet, header, firstRow, firstRow + rowCount - 1);
    const syncResult = syncRows_(result.rows, true);
    errors = errors.concat(syncResult.errors);
    synced += syncResult.synced;
    unchanged += syncResult.unchanged;
    skippedRowNumbers = skippedRowNumbers.concat(result.skippedRowNumbers);
  }
  reportSkippedRows_(skippedRowNumbers);
  console.log(`Change check finished: ${synced} changed rows sent, ${unchanged} unchanged.`);
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
    "leadid",
    "metaleadid",
    "facebookleadid",
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

function collectSheetRows_(sheet, header, firstRow, lastRow) {
  const result = { rows: [], skippedRowNumbers: [] };
  const dataRanges = [
    [firstRow, Math.min(lastRow, header.rowNumber - 1), true],
    [Math.max(firstRow, header.rowNumber + 1), lastRow, false],
  ];

  dataRanges.forEach(([rangeStart, rangeEnd, isBeforeHeader]) => {
    if (rangeStart > rangeEnd) return;
    const values = sheet
      .getRange(rangeStart, 1, rangeEnd - rangeStart + 1, header.headers.length)
      .getDisplayValues();
    const rows = collectSyncRows_(header.headers, values, rangeStart);

    if (isBeforeHeader) {
      const validRows = rows.rows.filter((row) =>
        hasLeadIdentity_(header.headers, row.values),
      );
      const validRowNumbers = new Set(validRows.map((row) => row.rowNumber));
      rows.skippedRowNumbers = rows.skippedRowNumbers.concat(
        rows.rows
          .filter((row) => !validRowNumbers.has(row.rowNumber))
          .map((row) => row.rowNumber),
      );
      rows.rows = validRows;
    }

    result.rows = result.rows.concat(rows.rows);
    result.skippedRowNumbers = result.skippedRowNumbers.concat(rows.skippedRowNumbers);
  });

  return result;
}

function hasLeadIdentity_(headers, values) {
  const normalizedHeaders = headers.map(normalizeSheetHeader_);
  const phoneHeaders = new Set([
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
  ]);
  const hasPhone = normalizedHeaders.some(
    (header, index) =>
      phoneHeaders.has(header) &&
      Boolean(String(values[String(headers[index]).trim()] || "").trim()),
  );
  const hasCreatedAt = normalizedHeaders.some(
    (header, index) =>
      header === "createdtime" &&
      Boolean(String(values[String(headers[index]).trim()] || "").trim()),
  );
  const hasFormId = normalizedHeaders.some(
    (header, index) =>
      header === "formid" &&
      Boolean(String(values[String(headers[index]).trim()] || "").trim()),
  );
  const leadIdHeaders = new Set(["id", "leadid", "metaleadid", "facebookleadid"]);
  const hasLeadId = normalizedHeaders.some(
    (header, index) =>
      leadIdHeaders.has(header) &&
      Boolean(String(values[String(headers[index]).trim()] || "").trim()),
  );
  return hasPhone || hasLeadId || (hasCreatedAt && hasFormId);
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
      `${errors.length} CRM sync error(s). Check the preceding execution logs for the exact rows and webhook response.`,
    );
  }
}

function syncRows_(rows, skipUnchanged) {
  if (!rows.length) return { errors: [], synced: 0, unchanged: 0 };
  const cache = CacheService.getScriptCache();
  const rowsToSend = skipUnchanged
    ? rows.filter((row) => cache.get(rowHashCacheKey_(row.rowNumber)) !== rowFingerprint_(row.values))
    : rows;
  const unchanged = rows.length - rowsToSend.length;
  if (unchanged > 0) console.log(`Skipped ${unchanged} unchanged sheet row(s).`);
  if (!rowsToSend.length) return { errors: [], synced: 0, unchanged };

  const result = sendDubaiRows_(rowsToSend);
  rememberSyncedRows_(result.syncedRows);
  return {
    errors: result.errors,
    synced: result.syncedRows.length,
    unchanged,
  };
}

function rowHashCacheKey_(rowNumber) {
  return `jmt-dubai-row-${rowNumber}`;
}

function rowFingerprint_(values) {
  const normalized = Object.keys(values)
    .sort()
    .map((key) => [key, values[key]]);
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(normalized),
    Utilities.Charset.UTF_8,
  );
  return Utilities.base64EncodeWebSafe(digest);
}

function rememberSyncedRows_(rows) {
  const cache = CacheService.getScriptCache();
  for (let offset = 0; offset < rows.length; offset += ROWS_PER_REQUEST) {
    const batch = rows.slice(offset, offset + ROWS_PER_REQUEST);
    const hashes = {};
    batch.forEach((row) => {
      hashes[rowHashCacheKey_(row.rowNumber)] = rowFingerprint_(row.values);
    });
    cache.putAll(hashes, ROW_HASH_CACHE_TTL_SECONDS);
  }
}

function sendDubaiRows_(rows) {
  if (!rows.length) return { errors: [], syncedRows: [] };
  const properties = PropertiesService.getScriptProperties();
  const endpoint =
    properties.getProperty("JMT_CRM_WEBHOOK_URL") || DUBAI_CRM_WEBHOOK_URL;
  const secret = properties.getProperty("JMT_CRM_WEBHOOK_SECRET");
  const errors = [];
  const syncedRows = [];
  if (!secret || secret.length < 32) throw new Error("JMT_CRM_WEBHOOK_SECRET is missing or invalid.");

  for (let offset = 0; offset < rows.length; offset += ROWS_PER_REQUEST) {
    const batch = rows.slice(offset, offset + ROWS_PER_REQUEST);
    let response = null;
    let fetchError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = UrlFetchApp.fetch(endpoint, {
          method: "post",
          contentType: "application/json",
          headers: { "x-jmt-webhook-secret": secret },
          payload: JSON.stringify({ rows: batch }),
          muteHttpExceptions: true,
        });
        const retryableStatus = response.getResponseCode() === 429 || response.getResponseCode() >= 500;
        if (retryableStatus && attempt < 2) {
          Utilities.sleep(500 * (attempt + 1));
          continue;
        }
        fetchError = null;
        break;
      } catch (error) {
        fetchError = error;
        if (attempt < 2) Utilities.sleep(500 * (attempt + 1));
      }
    }
    if (fetchError) {
      const message = `CRM webhook request failed after 3 attempts for rows ${batch[0].rowNumber}-${batch[batch.length - 1].rowNumber}: ${
        fetchError instanceof Error ? fetchError.message : String(fetchError)
      }`;
      console.error(message);
      errors.push(message);
      continue;
    }
    if (!response) {
      const message = `CRM webhook returned no response for rows ${batch[0].rowNumber}-${batch[batch.length - 1].rowNumber}.`;
      console.error(message);
      errors.push(message);
      continue;
    }

    const status = response.getResponseCode();
    const responseText = response.getContentText();
    if (status < 200 || status >= 300) {
      const message = `CRM sync failed with HTTP ${status} for rows ${batch[0].rowNumber}-${batch[batch.length - 1].rowNumber}: ${responseText.slice(0, 500)}`;
      console.error(message);
      errors.push(message);
      continue;
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (error) {
      const message = `CRM returned invalid JSON for rows ${batch[0].rowNumber}-${batch[batch.length - 1].rowNumber}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(message);
      errors.push(message);
      continue;
    }
    if (
      !Number.isInteger(result.created) ||
      !Number.isInteger(result.updated) ||
      !Number.isInteger(result.unchanged) ||
      !Number.isInteger(result.failed) ||
      !Array.isArray(result.errors)
    ) {
      const message = `CRM returned an unexpected response for rows ${batch[0].rowNumber}-${batch[batch.length - 1].rowNumber}: ${responseText.slice(0, 500)}`;
      console.error(message);
      errors.push(message);
      continue;
    }

    if (result.failed > 0) {
      const failedRowNumbers = new Set(
        result.errors.map((error) => Number(error.rowNumber)),
      );
      result.errors.forEach((error) => {
        const message = `CRM rejected sheet row ${error.rowNumber}: ${error.message}`;
        console.error(message);
        errors.push(message);
      });
      if (failedRowNumbers.size !== result.failed) {
        const message = `CRM reported ${result.failed} failed row(s), but returned ${failedRowNumbers.size} row details. This batch will be retried on the next sync.`;
        console.error(message);
        errors.push(message);
        continue;
      }
      syncedRows.push(...batch.filter((row) => !failedRowNumbers.has(row.rowNumber)));
    }
    else syncedRows.push(...batch);

    console.log(
      `CRM sync batch: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged, ${result.failed} failed.`,
    );
  }
  return { errors, syncedRows };
}
