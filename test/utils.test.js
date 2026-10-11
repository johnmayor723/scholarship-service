const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyStatus, idFor } = require("../src/utils");

test("missing deadline never means open", () => {
  assert.equal(classifyStatus({ text: "Scholarship opportunity", applicationUrl: "https://example.edu.ng/apply" }), "unconfirmed");
});

test("expired deadline is closed", () => {
  assert.equal(classifyStatus({ deadline: "2020-01-01", text: "Applications open" }), "closed");
});

test("non-current session is archived", () => {
  assert.equal(classifyStatus({ sessionMatch: false, text: "Applications open" }), "archived");
});

test("ids are stable", () => {
  assert.equal(idFor("A", "B", "2026/2027"), idFor("A", "B", "2026/2027"));
});