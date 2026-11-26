import test from "node:test";
import assert from "node:assert/strict";
import { portalNav, primaryRole, currentSegment, initialTab, FRAMED_PAGES } from "../lib/portal-nav.mjs";

test("primary role follows school authority order", () => {
  assert.equal(primaryRole(["parent", "teacher"]), "teacher");
  assert.equal(primaryRole(["student"]), "student");
  assert.equal(primaryRole([]), null);
});
test("every role gets a sidebar and every link stays inside its own school", () => {
  for (const role of ["school_owner", "school_admin", "teacher", "staff", "parent", "student"]) {
    const nav = portalNav(role, "RW-SCH-000004", "communications");
    assert.ok(nav.length >= 5, role);
    for (const n of nav) assert.ok(n.href.startsWith("/s/RW-SCH-000004/"), n.href);
  }
});
test("the open module is highlighted and other schools lose the demo-only library", () => {
  assert.equal(portalNav("parent", "RW-SCH-000004", "communications").find((n) => n.active).label, "Messages");
  assert.ok(!portalNav("parent", "RW-SCH-000009", "").some((n) => n.label === "Learning Resources"));
});
test("tab links only accept known tab names", () => {
  assert.equal(currentSegment("/s/RW-SCH-000004/report-card"), "report-card");
  assert.equal(initialTab("?tab=homework", ["dashboard", "homework"], "dashboard"), "homework");
  assert.equal(initialTab("?tab=<script>", ["dashboard", "homework"], "dashboard"), "dashboard");
  assert.ok(FRAMED_PAGES.includes("fees") && !FRAMED_PAGES.includes("login"));
});
