const DUBAI_SHEET_TAB = "Dubai form 29/10/";
const ROWS_PER_REQUEST = 20;

function setupDubaiLeadSync() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet.getSheetByName(DUBAI_SHEET_TAB)) {
    throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);
  }

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
  if (sheet.getName() !== DUBAI_SHEET_TAB || event.range.getLastRow() < 2) return;

  const firstRow = Math.max(2, event.range.getRow());
  const lastRow = event.range.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const values = sheet
    .getRange(firstRow, 1, lastRow - firstRow + 1, lastColumn)
    .getDisplayValues();
  const rows = values
    .map((row, index) => toSyncRow_(headers, row, firstRow + index))
    .filter((row) => row !== null);

  sendDubaiRows_(rows);
}

function syncAllDubaiLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DUBAI_SHEET_TAB);
  if (!sheet) throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  for (let firstRow = 2; firstRow <= lastRow; firstRow += ROWS_PER_REQUEST) {
    const rowCount = Math.min(ROWS_PER_REQUEST, lastRow - firstRow + 1);
    const values = sheet.getRange(firstRow, 1, rowCount, lastColumn).getDisplayValues();
    const rows = values
      .map((row, index) => toSyncRow_(headers, row, firstRow + index))
      .filter((row) => row !== null);
    if (rows.length > 0) sendDubaiRows_(rows);
  }
}

function syncChangedDubaiLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DUBAI_SHEET_TAB);
  if (!sheet) throw new Error(`Could not find the "${DUBAI_SHEET_TAB}" sheet tab.`);

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  for (let firstRow = 2; firstRow <= lastRow; firstRow += ROWS_PER_REQUEST) {
    const rowCount = Math.min(ROWS_PER_REQUEST, lastRow - firstRow + 1);
    const values = sheet.getRange(firstRow, 1, rowCount, lastColumn).getDisplayValues();
    const rows = values
      .map((row, index) => toSyncRow_(headers, row, firstRow + index))
      .filter((row) => row !== null);
    if (rows.length > 0) sendDubaiRows_(rows);
  }
}

function toSyncRow_(headers, row, rowNumber) {
  const values = {};
  headers.forEach((header, index) => {
    const name = String(header).trim();
    if (name) values[name] = String(row[index] || "");
  });
  if (Object.values(values).every((value) => value.trim() === "")) return null;
  return { rowNumber, values };
}

function sendDubaiRows_(rows) {
  if (!rows.length) return;

  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty("JMT_CRM_WEBHOOK_URL");
  const secret = properties.getProperty("JMT_CRM_WEBHOOK_SECRET");
  if (!endpoint || !secret) {
    throw new Error("Set JMT_CRM_WEBHOOK_URL and JMT_CRM_WEBHOOK_SECRET in Script Properties.");
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
      console.error(`CRM sync: ${result.failed} row(s) failed: ${JSON.stringify(result.errors)}`);
    } else {
      console.log(
        `CRM sync complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`,
      );
    }
  }
}
