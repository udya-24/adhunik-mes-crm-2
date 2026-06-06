import assert from "node:assert/strict";
import test from "node:test";
import { tenderSchema } from "../lib/validations.ts";

const baseTender = {
  tender_id: "T-1",
  tender_title: "Panel supply",
  source_type: "EXCEL_UPLOAD" as const
};

test("tenderSchema converts numeric Excel text fields to strings", () => {
  const parsed = tenderSchema.parse({
    ...baseTender,
    tender_ref_no: 3541728,
    bid_number: 3541728,
    contact_number_1: 9876543210,
    contact_number_2: "9876543211",
    contact_number_3: 9876543212
  });

  assert.equal(parsed.tender_ref_no, "3541728");
  assert.equal(parsed.bid_number, "3541728");
  assert.equal(parsed.contact_number_1, "9876543210");
  assert.equal(parsed.contact_number_2, "9876543211");
  assert.equal(parsed.contact_number_3, "9876543212");
});

test("tenderSchema converts string and numeric Excel money fields to numbers", () => {
  const parsed = tenderSchema.parse({
    ...baseTender,
    awarded_value: "3541728",
    our_value: 12000.5
  });

  assert.equal(parsed.awarded_value, 3541728);
  assert.equal(parsed.our_value, 12000.5);
});

test("tenderSchema preserves manual empty optional fields", () => {
  const parsed = tenderSchema.parse({
    tender_id: "T-2",
    tender_title: "Manual tender",
    tender_ref_no: "",
    bid_number: "",
    contact_number_1: "",
    awarded_value: "",
    our_value: "",
    source_type: "MANUAL_ENTRY"
  });

  assert.equal(parsed.tender_ref_no, undefined);
  assert.equal(parsed.bid_number, undefined);
  assert.equal(parsed.contact_number_1, undefined);
  assert.equal(parsed.awarded_value, undefined);
  assert.equal(parsed.our_value, undefined);
});
