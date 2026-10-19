import test from "node:test";
import assert from "node:assert/strict";

import { isValidCardTitle } from "../src/card-title-validator.js";

test("accepts ordinary non-empty titles", () => {
  assert.equal(isValidCardTitle("Backlog"), true);
  assert.equal(isValidCardTitle("Fix login bug"), true);
  assert.equal(isValidCardTitle("a"), true);
  assert.equal(isValidCardTitle("-"), true);
  assert.equal(isValidCardTitle("0"), true);
});

test("accepts titles padded with whitespace", () => {
  assert.equal(isValidCardTitle(" Done "), true);
  assert.equal(isValidCardTitle("\tIn progress\n"), true);
  assert.equal(isValidCardTitle("  x  "), true);
});

test("rejects the empty string", () => {
  assert.equal(isValidCardTitle(""), false);
});

test("rejects whitespace-only titles", () => {
  const whitespaceOnly = [
    " ",
    "   ",
    "\t",
    "\n",
    "\r\n",
    "\t\n\r ",
    "\u00a0", // no-break space
    "\u2003", // em space
    "\u3000", // ideographic space
    "\ufeff", // zero-width no-break space (BOM), whitespace per ECMAScript
    "\u2028\u2029", // line and paragraph separators
  ];

  for (const title of whitespaceOnly) {
    assert.equal(
      isValidCardTitle(title),
      false,
      `expected ${JSON.stringify(title)} to be rejected`,
    );
  }
});

test("rejects non-string values", () => {
  const nonStrings = [
    undefined,
    null,
    true,
    false,
    0,
    1,
    -1,
    3.14,
    NaN,
    Infinity,
    10n,
    Symbol("title"),
    {},
    [],
    ["card"],
    () => "card",
    new String("card"), // boxed string is still not a primitive string
    new Date(0),
    /card/,
  ];

  for (const value of nonStrings) {
    assert.equal(
      isValidCardTitle(value),
      false,
      `expected ${String(value)} to be rejected`,
    );
  }
});

test("accepts Unicode titles", () => {
  assert.equal(isValidCardTitle("Revisar diseño"), true);
  assert.equal(isValidCardTitle("確認待ち"), true);
  assert.equal(isValidCardTitle("Прелоад"), true);
  assert.equal(isValidCardTitle("مراجعة"), true);
  assert.equal(isValidCardTitle("🚀 Ship it"), true);
  assert.equal(isValidCardTitle("🚀"), true);
  assert.equal(isValidCardTitle("\u00e9"), true); // é as a single code point
  assert.equal(isValidCardTitle("e\u0301"), true); // e + combining acute accent
  assert.equal(isValidCardTitle("\u{1f5d3}\ufe0f"), true); // emoji with variation selector
});

test("accepts a title surrounded by Unicode whitespace", () => {
  assert.equal(isValidCardTitle("\u00a0\u3000Content\u3000\u00a0"), true);
});

test("treats zero-width space as content", () => {
  // U+200B is not in the Unicode White_Space property, so trim() keeps it and
  // the title is considered non-empty content.
  assert.equal(isValidCardTitle("\u200b"), true);
});

test("returns a boolean for every input", () => {
  for (const value of ["card", "", "   ", 42, null, undefined, {}]) {
    assert.equal(typeof isValidCardTitle(value), "boolean");
  }
});
