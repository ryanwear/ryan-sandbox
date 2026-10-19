import test from "node:test";
import assert from "node:assert/strict";

import { loadBoard, saveBoard, STORAGE_KEY, STORAGE_VERSION } from "../src/board-storage.js";
import { KanbanBoard } from "../src/kanban-board.js";

/**
 * Minimal in-memory Storage implementation for tests.
 *
 * @param {Record<string, string>} [initial] Initial key/value pairs.
 * @returns {Storage & { values: Map<string, string> }} Fake storage.
 */
function createFakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));

  return {
    values,
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

/**
 * Build a stored payload string.
 *
 * @param {unknown} cards Value for the cards property.
 * @param {number} [version] Schema version.
 * @returns {string} JSON payload.
 */
function payload(cards, version = STORAGE_VERSION) {
  return JSON.stringify({ version, cards });
}

const VALID_CARD = {
  id: "card-1",
  title: "First card",
  description: "Description",
  column: "To Do",
};

test("saveBoard writes a versioned payload under the versioned key", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Saved title", "Saved description", "In Progress");
  const storage = createFakeStorage();

  const count = saveBoard(board, storage);

  assert.equal(count, 1);
  assert.ok(storage.values.has(STORAGE_KEY));
  assert.match(STORAGE_KEY, /v1$/);

  const stored = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(stored.version, STORAGE_VERSION);
  assert.deepEqual(stored.cards, [card]);
});

test("saveBoard and loadBoard round-trip cards with preserved ids", () => {
  const source = new KanbanBoard();
  const first = source.createCard("First", "One", "To Do");
  const second = source.createCard("Second", "Two", "Done");
  const storage = createFakeStorage();

  saveBoard(source, storage);

  const restored = new KanbanBoard();
  const result = loadBoard(restored, storage);

  assert.deepEqual(result, { status: "loaded", loaded: 2, skipped: 0 });
  assert.deepEqual(restored.getAllCards(), [first, second]);
  assert.deepEqual(
    restored.getAllCards().map((card) => card.id),
    [first.id, second.id],
  );
});

test("saveBoard writes an empty board", () => {
  const board = new KanbanBoard();
  const storage = createFakeStorage();

  assert.equal(saveBoard(board, storage), 0);

  const restored = new KanbanBoard();
  restored.createCard("Existing", "", "To Do");
  assert.deepEqual(loadBoard(restored, storage), { status: "loaded", loaded: 0, skipped: 0 });
  assert.deepEqual(restored.getAllCards(), []);
});

test("loadBoard clears the board when the key is missing", () => {
  const board = new KanbanBoard();
  board.createCard("Existing", "", "To Do");
  const storage = createFakeStorage();

  assert.deepEqual(loadBoard(board, storage), { status: "empty", loaded: 0, skipped: 0 });
  assert.deepEqual(board.getAllCards(), []);
});

test("loadBoard recovers from corrupt JSON", () => {
  const board = new KanbanBoard();
  const storage = createFakeStorage({ [STORAGE_KEY]: "{not json" });

  assert.deepEqual(loadBoard(board, storage), { status: "corrupt", loaded: 0, skipped: 0 });
  assert.deepEqual(board.getAllCards(), []);
});

test("loadBoard rejects payloads with the wrong shape or version", () => {
  const invalidPayloads = [
    "null",
    "[]",
    '"string"',
    JSON.stringify({ version: 99, cards: [] }),
    JSON.stringify({ version: STORAGE_VERSION }),
    JSON.stringify({ version: STORAGE_VERSION, cards: {} }),
    JSON.stringify({ cards: [] }),
  ];

  for (const raw of invalidPayloads) {
    const board = new KanbanBoard();
    const storage = createFakeStorage({ [STORAGE_KEY]: raw });

    assert.deepEqual(loadBoard(board, storage), {
      status: "corrupt",
      loaded: 0,
      skipped: 0,
    });
    assert.deepEqual(board.getAllCards(), []);
  }
});

test("loadBoard skips invalid entries and reports a partial load", () => {
  const board = new KanbanBoard();
  const storage = createFakeStorage({
    [STORAGE_KEY]: payload([
      VALID_CARD,
      { ...VALID_CARD, id: "card-1", title: "Duplicate id" },
      { ...VALID_CARD, id: "card-2", title: "   " },
      { ...VALID_CARD, id: "card-3", description: 42 },
      { ...VALID_CARD, id: "card-4", column: "Todo" },
      { ...VALID_CARD, id: "card-5", id: "" },
      { ...VALID_CARD, id: "card-6", column: "In Progress" },
      null,
      "card",
      { ...VALID_CARD, id: "card-7", title: "No description property", description: undefined },
    ]),
  });

  const result = loadBoard(board, storage);

  assert.deepEqual(result, { status: "partial", loaded: 2, skipped: 8 });
  assert.deepEqual(
    board.getAllCards().map((card) => card.id),
    ["card-1", "card-6"],
  );
});

test("loadBoard drops extra properties from stored cards", () => {
  const board = new KanbanBoard();
  const storage = createFakeStorage({
    [STORAGE_KEY]: payload([{ ...VALID_CARD, unexpected: "ignored" }]),
  });

  loadBoard(board, storage);

  assert.deepEqual(board.getAllCards(), [VALID_CARD]);
});

test("loadBoard keeps the first card when stored ids are duplicated", () => {
  const board = new KanbanBoard();
  const storage = createFakeStorage({
    [STORAGE_KEY]: payload([
      VALID_CARD,
      { ...VALID_CARD, title: "Second with same id", column: "Done" },
    ]),
  });

  const result = loadBoard(board, storage);

  assert.deepEqual(result, { status: "partial", loaded: 1, skipped: 1 });
  assert.deepEqual(board.getAllCards(), [VALID_CARD]);
});

test("loadBoard reports unavailable storage when reading throws", () => {
  const board = new KanbanBoard();
  board.createCard("Existing", "", "To Do");
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
  };

  assert.deepEqual(loadBoard(board, storage), {
    status: "unavailable",
    loaded: 0,
    skipped: 0,
  });
  assert.deepEqual(board.getAllCards(), []);
});

test("loadBoard reports unavailable storage when getItem is missing", () => {
  const board = new KanbanBoard();

  assert.deepEqual(loadBoard(board, {}), {
    status: "unavailable",
    loaded: 0,
    skipped: 0,
  });
});

test("saveBoard throws a clear error when writing fails", () => {
  const board = new KanbanBoard();
  board.createCard("Card", "", "To Do");
  const storage = {
    setItem() {
      throw new Error("quota exceeded");
    },
  };

  assert.throws(() => saveBoard(board, storage), /save/i);
});

test("saveBoard throws when storage is unavailable", () => {
  const board = new KanbanBoard();

  assert.throws(() => saveBoard(board, {}), /unavailable/i);
  assert.throws(() => saveBoard(board, null), /unavailable/i);
});
