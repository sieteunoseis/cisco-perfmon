const assert = require("assert");

let passed = 0, failed = 0, total = 0;
function describe(name, fn) { console.log(`  ${name}`); fn(); }
function it(name, fn) {
  total++;
  try { fn(); console.log(`    \u2713 ${name}`); passed++; }
  catch (e) { console.log(`    \u2717 ${name}: ${e.message}`); failed++; }
}
async function itAsync(name, fn) {
  total++;
  try { await fn(); console.log(`    \u2713 ${name}`); passed++; }
  catch (e) { console.log(`    \u2717 ${name}: ${e.message}`); failed++; }
}

const formatTable = require("../../cli/formatters/table.js");
const formatJson = require("../../cli/formatters/json.js");
const formatCsv = require("../../cli/formatters/csv.js");
const formatToon = require("../../cli/formatters/toon.js");

const sampleList = [
  { object: "Cisco CallManager", counter: "CallsActive", instance: "", value: "5", cstatus: "1" },
  { object: "Cisco CallManager", counter: "CallsInProgress", instance: "", value: "12", cstatus: "1" },
];
const sampleItem = { object: "Cisco CallManager", counter: "CallsActive", instance: "", value: "5", cstatus: "1" };

(async () => {
  describe("table formatter", () => {
    it("produces string output for an array", () => {
      const result = formatTable(sampleList);
      assert.strictEqual(typeof result, "string");
      assert.ok(result.length > 0, "Output should not be empty");
    });

    it("includes column headers from object keys", () => {
      const result = formatTable(sampleList);
      assert.ok(result.includes("object"), "Should contain 'object' header");
      assert.ok(result.includes("counter"), "Should contain 'counter' header");
      assert.ok(result.includes("value"), "Should contain 'value' header");
    });

    it("includes data values", () => {
      const result = formatTable(sampleList);
      assert.ok(result.includes("CallsActive"), "Should contain counter name");
      assert.ok(result.includes("Cisco CallManager"), "Should contain object name");
    });

    it("includes row count in output", () => {
      const result = formatTable(sampleList);
      assert.ok(result.includes("2 results found"), "Should show result count");
    });

    it("shows singular 'result' for single-item array", () => {
      const result = formatTable([sampleItem]);
      assert.ok(result.includes("1 result found"), "Should show singular result");
    });

    it("produces key-value output for a single object", () => {
      const result = formatTable(sampleItem);
      assert.strictEqual(typeof result, "string");
      assert.ok(result.includes("CallsActive"), "Should contain item value");
    });

    it("returns 'No results found' for empty array", () => {
      const result = formatTable([]);
      assert.strictEqual(result, "No results found");
    });

    it("handles null/undefined values gracefully", () => {
      const result = formatTable([{ object: "test", counter: null, value: undefined }]);
      assert.strictEqual(typeof result, "string");
    });
  });

  describe("json formatter", () => {
    it("produces valid JSON for an array", () => {
      const result = formatJson(sampleList);
      const parsed = JSON.parse(result);
      assert.ok(Array.isArray(parsed), "Parsed result should be an array");
      assert.strictEqual(parsed.length, 2);
    });

    it("produces valid JSON for a single item", () => {
      const result = formatJson(sampleItem);
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.counter, "CallsActive");
    });

    it("output is pretty-printed with 2-space indent", () => {
      const result = formatJson(sampleItem);
      assert.ok(result.includes("  "), "Should contain 2-space indentation");
    });

    it("preserves all fields", () => {
      const result = formatJson(sampleItem);
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.object, "Cisco CallManager");
      assert.strictEqual(parsed.value, "5");
    });
  });

  describe("csv formatter", () => {
    it("produces CSV with headers for an array", () => {
      const result = formatCsv(sampleList);
      const lines = result.trim().split("\n");
      assert.ok(lines.length >= 3, "Should have header + 2 data rows");
      assert.ok(lines[0].includes("object"), "First line should contain header 'object'");
      assert.ok(lines[0].includes("counter"), "First line should contain header 'counter'");
    });

    it("produces CSV for a single item (wrapped in array)", () => {
      const result = formatCsv(sampleItem);
      const lines = result.trim().split("\n");
      assert.ok(lines.length >= 2, "Should have header + 1 data row");
    });

    it("returns empty string for empty array", () => {
      const result = formatCsv([]);
      assert.strictEqual(result, "");
    });

    it("includes data values in rows", () => {
      const result = formatCsv(sampleList);
      assert.ok(result.includes("CallsActive"), "Should contain counter name");
      assert.ok(result.includes("Cisco CallManager"), "Should contain object name");
    });
  });

  console.log(`  toon formatter`);
  await itAsync("produces string output", async () => {
    const result = await formatToon(sampleItem);
    assert.strictEqual(typeof result, "string");
    assert.ok(result.length > 0, "Output should not be empty");
  });

  await itAsync("handles array input", async () => {
    const result = await formatToon(sampleList);
    assert.strictEqual(typeof result, "string");
    assert.ok(result.length > 0, "Output should not be empty");
  });

  console.log(`\n  formatters.test.js: ${total} tests, ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
