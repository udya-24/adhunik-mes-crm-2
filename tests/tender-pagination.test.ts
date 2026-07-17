import assert from "node:assert/strict";
import test from "node:test";
import { resolveTenderPagination } from "../lib/queries/tenders.ts";

test("clamps page 21 to the last valid page for 112 rows", () => {
  assert.deepEqual(resolveTenderPagination(112, 21, 10), {
    page: 12,
    pageSize: 10,
    maxPage: 12,
    from: 110,
    to: 111
  });
});

test("never produces an offset at or beyond a non-empty total", () => {
  for (const total of [1, 9, 10, 11, 49, 50, 51, 112]) {
    for (const pageSize of [10, 25, 50]) {
      const pagination = resolveTenderPagination(total, 999, pageSize);
      assert.ok(pagination.from < total);
      assert.ok(pagination.to < total);
      assert.equal(pagination.page, pagination.maxPage);
    }
  }
});

test("normalizes empty datasets and invalid page inputs", () => {
  assert.deepEqual(resolveTenderPagination(0, 21, 10), {
    page: 1,
    pageSize: 10,
    maxPage: 1,
    from: 0,
    to: 0
  });
  assert.equal(resolveTenderPagination(112, -4, 0).page, 1);
});
