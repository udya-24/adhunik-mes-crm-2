import assert from "node:assert/strict";
import test from "node:test";
import { excelDateToISO, formatDate, formatDateIST, formatDateTimeIST, normalizeDateFields, normalizeDateValue } from "../lib/date-utils.ts";

test("formatDateTimeIST converts UTC timestamps to Asia/Kolkata display time", () => {
  assert.equal(formatDateTimeIST("2026-06-01T08:40:25Z"), "01/06/2026, 14:10:25");
});

test("formatDateTimeIST treats Supabase timezone-less timestamps as UTC", () => {
  assert.equal(formatDateTimeIST("2026-06-01 08:40:25"), "01/06/2026, 14:10:25");
});

test("formatDateIST formats dates in IST and handles empty values", () => {
  assert.equal(formatDateIST("2026-06-01T08:40:25Z"), "01/06/2026");
  assert.equal(formatDateIST(null), "-");
  assert.equal(formatDateTimeIST(null), "-");
});

test("formatDate displays date-only contract dates without shifting the day", () => {
  assert.equal(formatDate("2026-05-26"), "26/05/2026");
  assert.equal(formatDate(null), "-");
  assert.equal(formatDate(undefined), "-");
});

test("excelDateToISO converts Excel serial dates to ISO dates", () => {
  assert.equal(excelDateToISO(46091), "2026-03-10");
});

test("normalizeDateValue supports import date formats", () => {
  assert.equal(normalizeDateValue(46091), "2026-03-10");
  assert.equal(normalizeDateValue("2026-06-01"), "2026-06-01");
  assert.equal(normalizeDateValue("01-06-2026"), "2026-06-01");
  assert.equal(normalizeDateValue("01/06/2026"), "2026-06-01");
});

test("normalizeDateFields applies conversion to configured date fields", () => {
  assert.deepEqual(normalizeDateFields({ contract_date: 46091, tender_id: "T-1" }), {
    contract_date: "2026-03-10",
    tender_id: "T-1"
  });
});
