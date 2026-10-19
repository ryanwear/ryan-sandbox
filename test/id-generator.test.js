import test from "node:test";
import assert from "node:assert/strict";

import { createFallbackId, generateId } from "../src/id-generator.js";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("generateId uses crypto.randomUUID when available", () => {
  const calls = [];
  const crypto = {
    randomUUID() {
      calls.push("randomUUID");
      return "b7f2a1c4-4e4e-4e4e-8e4e-1a2b3c4d5e6f";
    },
  };

  assert.equal(generateId(crypto), "b7f2a1c4-4e4e-4e4e-8e4e-1a2b3c4d5e6f");
  assert.deepEqual(calls, ["randomUUID"]);
});

test("generateId falls back when crypto is missing", () => {
  const id = generateId(undefined);

  assert.match(id, UUID_V4_PATTERN);
  assert.ok(id.length > 0);
});

test("generateId falls back when randomUUID is unavailable", () => {
  const id = generateId({});

  assert.match(id, UUID_V4_PATTERN);
});

test("generateId falls back when randomUUID throws", () => {
  const id = generateId({
    randomUUID() {
      throw new Error("blocked");
    },
  });

  assert.match(id, UUID_V4_PATTERN);
});

test("generateId falls back when randomUUID returns a non-string", () => {
  const id = generateId({ randomUUID: () => 42 });

  assert.match(id, UUID_V4_PATTERN);
});

test("fallback ids are well-formed and unique", () => {
  const ids = new Set();

  for (let index = 0; index < 200; index += 1) {
    const id = createFallbackId({});
    assert.match(id, UUID_V4_PATTERN);
    ids.add(id);
  }

  assert.equal(ids.size, 200);
});

test("fallback ids stay unique when random bytes are constant", () => {
  const crypto = {
    getRandomValues(bytes) {
      bytes.fill(0);
    },
  };

  const ids = new Set();
  for (let index = 0; index < 100; index += 1) {
    ids.add(generateId(crypto));
  }

  assert.equal(ids.size, 100);
});

test("fallback ids stay unique when getRandomValues throws", () => {
  const crypto = {
    getRandomValues() {
      throw new Error("blocked");
    },
  };

  const ids = new Set();
  for (let index = 0; index < 100; index += 1) {
    ids.add(generateId(crypto));
  }

  assert.equal(ids.size, 100);
});
