const assert = require("assert");

let passed = 0, failed = 0, total = 0;
function describe(name, fn) { console.log(`  ${name}`); fn(); }
function it(name, fn) {
  total++;
  try { fn(); console.log(`    \u2713 ${name}`); passed++; }
  catch (e) { console.log(`    \u2717 ${name}: ${e.message}`); failed++; }
}

// The watch module exports sparkline after self-registration
const watchModule = require("../../cli/commands/watch.js");
const sparkline = watchModule.sparkline;

describe("sparkline", () => {
  it("returns empty string for empty array", () => {
    assert.strictEqual(sparkline([]), "");
  });

  it("returns a single block for a single value", () => {
    const result = sparkline([5]);
    assert.strictEqual(result.length, 1);
  });

  it("returns string with length equal to input length", () => {
    const result = sparkline([1, 2, 3, 4, 5]);
    assert.strictEqual(result.length, 5);
  });

  it("uses lowest block for minimum and highest for maximum", () => {
    const result = sparkline([0, 100]);
    // First char should be lowest block, second should be highest
    assert.strictEqual(result[0], "\u2581");
    assert.strictEqual(result[1], "\u2588");
  });

  it("produces all same blocks for constant values", () => {
    const result = sparkline([50, 50, 50, 50]);
    // All same value => range is 0 => formula uses range=1, all map to same block
    const chars = new Set(result.split(""));
    assert.strictEqual(chars.size, 1, "All blocks should be the same for constant values");
  });

  it("produces ascending blocks for ascending values", () => {
    const result = sparkline([0, 1, 2, 3, 4, 5, 6, 7]);
    // Each character should be >= the previous
    for (let i = 1; i < result.length; i++) {
      assert.ok(result.charCodeAt(i) >= result.charCodeAt(i - 1),
        `Character at ${i} should be >= character at ${i - 1}`);
    }
  });

  it("handles negative values", () => {
    const result = sparkline([-10, -5, 0, 5, 10]);
    assert.strictEqual(result.length, 5);
    assert.strictEqual(result[0], "\u2581");
    assert.strictEqual(result[4], "\u2588");
  });

  it("handles floating point values", () => {
    const result = sparkline([0.1, 0.5, 0.9]);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(typeof result, "string");
  });

  it("only uses valid sparkline block characters", () => {
    const validChars = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
    const result = sparkline([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    for (const ch of result) {
      assert.ok(validChars.includes(ch), `Character "${ch}" should be a valid sparkline block`);
    }
  });
});

console.log(`\n  watch.test.js: ${total} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
