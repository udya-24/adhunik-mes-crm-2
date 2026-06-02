import assert from "node:assert/strict";
import test from "node:test";
import { formatDateIST, formatDateTimeIST } from "../lib/date-utils.ts";

test("formatDateTimeIST converts UTC timestamps to Asia/Kolkata display time", () => {
  assert.equal(formatDateTimeIST("2026-06-01T08:40:25Z"), "01 Jun 2026, 02:10:25 PM");
});

test("formatDateTimeIST treats Supabase timezone-less timestamps as UTC", () => {
  assert.equal(formatDateTimeIST("2026-06-01 08:40:25"), "01 Jun 2026, 02:10:25 PM");
});

test("formatDateIST formats dates in IST and handles empty values", () => {
  assert.equal(formatDateIST("2026-06-01T08:40:25Z"), "01 Jun 2026");
  assert.equal(formatDateIST(null), "-");
  assert.equal(formatDateTimeIST(null), "-");
});
