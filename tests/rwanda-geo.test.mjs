import test from "node:test";
import assert from "node:assert/strict";
import { RWANDA_DISTRICTS, DISTRICT_PROVINCE, districtKey, DISTRICT_NAMES } from "../lib/rwanda-geo.js";

test("map has all 30 districts across the 5 provinces", () => {
  assert.equal(RWANDA_DISTRICTS.length, 30);
  assert.equal(new Set(DISTRICT_NAMES).size, 30);
  const per = {};
  for (const d of RWANDA_DISTRICTS) per[d.p] = (per[d.p] || 0) + 1;
  assert.deepEqual(per, { kigali: 3, southern: 8, western: 7, eastern: 7, northern: 5 });
  assert.ok(RWANDA_DISTRICTS.every((d) => d.d.startsWith("M")));
});

test("district lookup is case-insensitive and rejects unknown names", () => {
  assert.equal(districtKey(" gasabo "), "Gasabo");
  assert.equal(DISTRICT_PROVINCE.Gasabo, "kigali");
  assert.equal(DISTRICT_PROVINCE.Musanze, "northern");
  assert.equal(districtKey("Atlantis"), null);
  assert.equal(districtKey(""), null);
});
