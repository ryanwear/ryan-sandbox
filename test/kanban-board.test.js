import test from "node:test";
import assert from "node:assert/strict";

import { KanbanBoard } from "../src/kanban-board.js";
import { VALID_COLUMNS } from "../src/kanban-column-validator.js";

/**
 * Assert that `fn` throws an error whose message matches `pattern`.
 *
 * @param {() => unknown} fn Function expected to throw.
 * @param {RegExp} pattern Message pattern.
 * @returns {void}
 */
function assertThrowsMessage(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof Error, "expected an Error instance");
    assert.match(error.message, pattern);
    return true;
  });
}

test("starts with no cards", () => {
  const board = new KanbanBoard();

  assert.deepEqual(board.getAllCards(), []);
  for (const column of VALID_COLUMNS) {
    assert.deepEqual(board.getCardsByColumn(column), []);
  }
});

test("creates a card with an id and the provided fields", () => {
  const board = new KanbanBoard();

  const card = board.createCard("Write tests", "Cover the board engine", "To Do");

  assert.equal(typeof card.id, "string");
  assert.ok(card.id.length > 0);
  assert.equal(card.title, "Write tests");
  assert.equal(card.description, "Cover the board engine");
  assert.equal(card.column, "To Do");
  assert.deepEqual(board.getCard(card.id), card);
});

test("creates cards in every valid column", () => {
  const board = new KanbanBoard();

  for (const column of VALID_COLUMNS) {
    const card = board.createCard(`Task for ${column}`, "", column);
    assert.equal(card.column, column);
    assert.equal(board.getCardsByColumn(column).length, 1);
  }

  assert.equal(board.getAllCards().length, VALID_COLUMNS.size);
});

test("generates unique ids for cards with identical content", () => {
  const board = new KanbanBoard();

  const ids = new Set();
  for (let index = 0; index < 50; index += 1) {
    const card = board.createCard("Same title", "Same description", "To Do");
    ids.add(card.id);
  }

  assert.equal(ids.size, 50);
  assert.equal(board.getAllCards().length, 50);
});

test("accepts Unicode titles and whitespace-padded titles", () => {
  const board = new KanbanBoard();

  const unicode = board.createCard("確認待ち 🚀", "", "To Do");
  const padded = board.createCard("  padded title  ", "", "Done");

  assert.equal(board.getCard(unicode.id).title, "確認待ち 🚀");
  assert.equal(board.getCard(padded.id).title, "  padded title  ");
});

test("rejects invalid titles without storing a card", () => {
  const board = new KanbanBoard();
  const invalidTitles = ["", "   ", "\t\n", null, undefined, 42, true, {}, ["title"]];

  for (const title of invalidTitles) {
    assertThrowsMessage(() => board.createCard(title, "description", "To Do"), /title/i);
  }

  assert.deepEqual(board.getAllCards(), []);
});

test("rejects invalid columns without storing a card", () => {
  const board = new KanbanBoard();
  const invalidColumns = ["Todo", "todo", "Done ", "In  Progress", "Backlog", "", null, undefined, 0, {}];

  for (const column of invalidColumns) {
    assertThrowsMessage(() => board.createCard("Valid title", "description", column), /column/i);
  }

  assert.deepEqual(board.getAllCards(), []);
});

test("rejects non-string descriptions without storing a card", () => {
  const board = new KanbanBoard();
  const invalidDescriptions = [undefined, null, 0, false, {}, [], () => "description"];

  for (const description of invalidDescriptions) {
    assertThrowsMessage(() => board.createCard("Valid title", description, "To Do"), /description/i);
  }

  assert.deepEqual(board.getAllCards(), []);
});

test("getCard returns undefined for unknown ids", () => {
  const board = new KanbanBoard();
  board.createCard("Only card", "", "To Do");

  assert.equal(board.getCard("missing-id"), undefined);
  assert.equal(board.getCard(""), undefined);
  assert.equal(board.getCard(undefined), undefined);
  assert.equal(board.getCard({ id: "x" }), undefined);
});

test("updateCard changes a single field", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Original", "Original description", "To Do");

  const updated = board.updateCard(card.id, { title: "Renamed" });

  assert.equal(updated.id, card.id);
  assert.equal(updated.title, "Renamed");
  assert.equal(updated.description, "Original description");
  assert.equal(updated.column, "To Do");
  assert.deepEqual(board.getCard(card.id), updated);
});

test("updateCard changes multiple fields at once", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Original", "Original description", "To Do");

  const updated = board.updateCard(card.id, {
    title: "New title",
    description: "New description",
    column: "In Progress",
  });

  assert.equal(updated.title, "New title");
  assert.equal(updated.description, "New description");
  assert.equal(updated.column, "In Progress");
  assert.equal(board.getCardsByColumn("To Do").length, 0);
  assert.equal(board.getCardsByColumn("In Progress").length, 1);
});

test("updateCard accepts an empty patch as a no-op", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Original", "Description", "To Do");

  const updated = board.updateCard(card.id, {});

  assert.equal(updated.id, card.id);
  assert.equal(updated.title, "Original");
  assert.equal(updated.description, "Description");
  assert.equal(updated.column, "To Do");
});

test("updateCard can set an empty description", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Original", "Description", "To Do");

  const updated = board.updateCard(card.id, { description: "" });

  assert.equal(updated.description, "");
});

test("updateCard throws for unknown ids", () => {
  const board = new KanbanBoard();

  assertThrowsMessage(() => board.updateCard("missing-id", { title: "New" }), /not found/i);
});

test("updateCard rejects non-object payloads", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Original", "Description", "To Do");
  const invalidPayloads = [undefined, null, "title", 42, [], ["title"]];

  for (const payload of invalidPayloads) {
    assertThrowsMessage(() => board.updateCard(card.id, payload), /update/i);
  }

  assert.equal(board.getCard(card.id).title, "Original");
});

test("updateCard rejects invalid fields and applies no partial changes", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Original", "Description", "To Do");
  const snapshot = { ...card };

  assertThrowsMessage(
    () => board.updateCard(card.id, { title: "   ", column: "Done" }),
    /title/i,
  );
  assertThrowsMessage(
    () => board.updateCard(card.id, { description: 42, column: "Done" }),
    /description/i,
  );
  assertThrowsMessage(
    () => board.updateCard(card.id, { title: "New title", column: "Review" }),
    /column/i,
  );

  assert.deepEqual(board.getCard(card.id), snapshot);
  assert.equal(board.getCard(card.id).column, "To Do");
});

test("updateCard treats an explicit undefined field as invalid", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Original", "Description", "To Do");

  assertThrowsMessage(() => board.updateCard(card.id, { title: undefined }), /title/i);
  assertThrowsMessage(() => board.updateCard(card.id, { description: undefined }), /description/i);
  assertThrowsMessage(() => board.updateCard(card.id, { column: undefined }), /column/i);
});

test("moveCard changes the column and returns the card", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Move me", "Description", "To Do");

  const moved = board.moveCard(card.id, "Done");

  assert.equal(moved.id, card.id);
  assert.equal(moved.column, "Done");
  assert.equal(board.getCard(card.id).column, "Done");
  assert.equal(board.getCardsByColumn("To Do").length, 0);
  assert.equal(board.getCardsByColumn("Done").length, 1);
});

test("moveCard rejects invalid columns and leaves the card in place", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Move me", "Description", "To Do");

  for (const column of ["done", "Done ", "Blocked", "", null, undefined, 1]) {
    assertThrowsMessage(() => board.moveCard(card.id, column), /column/i);
  }

  assert.equal(board.getCard(card.id).column, "To Do");
});

test("moveCard throws for unknown ids", () => {
  const board = new KanbanBoard();

  assertThrowsMessage(() => board.moveCard("missing-id", "Done"), /not found/i);
});

test("deleteCard removes an existing card and reports success", () => {
  const board = new KanbanBoard();
  const card = board.createCard("Delete me", "Description", "To Do");

  assert.equal(board.deleteCard(card.id), true);
  assert.equal(board.getCard(card.id), undefined);
  assert.equal(board.deleteCard(card.id), false);
  assert.deepEqual(board.getAllCards(), []);
});

test("deleteCard returns false for unknown ids", () => {
  const board = new KanbanBoard();
  board.createCard("Keep me", "", "To Do");

  assert.equal(board.deleteCard("missing-id"), false);
  assert.equal(board.deleteCard(undefined), false);
  assert.equal(board.getAllCards().length, 1);
});

test("getAllCards returns every card in insertion order", () => {
  const board = new KanbanBoard();
  const first = board.createCard("First", "", "To Do");
  const second = board.createCard("Second", "", "In Progress");
  const third = board.createCard("Third", "", "Done");

  assert.deepEqual(
    board.getAllCards().map((card) => card.id),
    [first.id, second.id, third.id],
  );
});

test("getAllCards returns a new array that cannot mutate the board", () => {
  const board = new KanbanBoard();
  board.createCard("Only card", "", "To Do");

  const cards = board.getAllCards();
  cards.push({ id: "fake" });
  cards.length = 0;

  assert.equal(board.getAllCards().length, 1);
});

test("getCardsByColumn filters by exact column", () => {
  const board = new KanbanBoard();
  const todo = board.createCard("Todo card", "", "To Do");
  const progress = board.createCard("Progress card", "", "In Progress");
  const done = board.createCard("Done card", "", "Done");
  const anotherTodo = board.createCard("Another todo", "", "To Do");

  assert.deepEqual(
    board.getCardsByColumn("To Do").map((card) => card.id),
    [todo.id, anotherTodo.id],
  );
  assert.deepEqual(board.getCardsByColumn("In Progress").map((card) => card.id), [progress.id]);
  assert.deepEqual(board.getCardsByColumn("Done").map((card) => card.id), [done.id]);
});

test("getCardsByColumn returns a new array that cannot mutate the board", () => {
  const board = new KanbanBoard();
  board.createCard("Todo card", "", "To Do");

  const cards = board.getCardsByColumn("To Do");
  cards.pop();

  assert.equal(board.getCardsByColumn("To Do").length, 1);
});

test("getCardsByColumn rejects invalid columns", () => {
  const board = new KanbanBoard();

  for (const column of ["Todo", "Done ", "", null, undefined]) {
    assertThrowsMessage(() => board.getCardsByColumn(column), /column/i);
  }
});

test("clear removes all cards and allows reuse", () => {
  const board = new KanbanBoard();
  board.createCard("One", "", "To Do");
  board.createCard("Two", "", "Done");

  board.clear();

  assert.deepEqual(board.getAllCards(), []);
  assert.equal(board.deleteCard("anything"), false);
  for (const column of VALID_COLUMNS) {
    assert.deepEqual(board.getCardsByColumn(column), []);
  }

  const card = board.createCard("After clear", "", "In Progress");
  assert.deepEqual(board.getAllCards(), [card]);
});

test("boards are independent of one another", () => {
  const first = new KanbanBoard();
  const second = new KanbanBoard();

  const card = first.createCard("First board card", "", "To Do");

  assert.deepEqual(second.getAllCards(), []);
  assert.equal(second.getCard(card.id), undefined);
});

test("card-returning methods never hand out the stored object", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Description", "To Do");

  assert.notEqual(board.getCard(created.id), created);
  assert.notEqual(board.getAllCards()[0], created);
  assert.notEqual(board.updateCard(created.id, { title: "Updated" }), board.getCard(created.id));
  assert.notEqual(board.moveCard(created.id, "Done"), board.getCard(created.id));
  assert.notEqual(board.getAllCards()[0], board.getCard(created.id));
  assert.notEqual(board.getCardsByColumn("Done")[0], board.getCard(created.id));
});

test("mutating the object returned by createCard does not affect the board", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Description", "To Do");
  const originalId = created.id;

  created.id = "tampered-id";
  created.title = "";
  created.description = 42;
  created.column = "Bogus";

  assert.deepEqual(board.getCard(originalId), {
    id: originalId,
    title: "Original",
    description: "Description",
    column: "To Do",
  });
  assert.equal(board.getCard("tampered-id"), undefined);
  assert.equal(board.getAllCards().length, 1);
});

test("mutating the object returned by getCard does not affect the board", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Description", "To Do");

  const fetched = board.getCard(created.id);
  fetched.id = "tampered-id";
  fetched.title = "Tampered";
  fetched.description = "Tampered";
  fetched.column = "Done";

  assert.deepEqual(board.getCard(created.id), {
    id: created.id,
    title: "Original",
    description: "Description",
    column: "To Do",
  });
  assert.deepEqual(board.getAllCards(), [
    { id: created.id, title: "Original", description: "Description", column: "To Do" },
  ]);
  assert.equal(board.getCardsByColumn("To Do").length, 1);
  assert.deepEqual(board.getCardsByColumn("Done"), []);
});

test("mutating the object returned by updateCard does not affect the board", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Description", "To Do");

  const updated = board.updateCard(created.id, { title: "Updated" });
  updated.title = "Tampered";
  updated.column = "Bogus";
  updated.id = "tampered-id";

  assert.deepEqual(board.getCard(created.id), {
    id: created.id,
    title: "Updated",
    description: "Description",
    column: "To Do",
  });
  assert.equal(board.getCard("tampered-id"), undefined);
});

test("mutating the object returned by moveCard does not affect the board", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Description", "To Do");

  const moved = board.moveCard(created.id, "Done");
  moved.column = "To Do";
  moved.title = "Tampered";

  assert.deepEqual(board.getCard(created.id), {
    id: created.id,
    title: "Original",
    description: "Description",
    column: "Done",
  });
  assert.equal(board.getCardsByColumn("Done").length, 1);
  assert.equal(board.getCardsByColumn("To Do").length, 0);
});

test("mutating elements of getAllCards does not affect the board", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Description", "To Do");

  const cards = board.getAllCards();
  cards[0].id = "tampered-id";
  cards[0].title = "";
  cards[0].description = null;
  cards[0].column = "Bogus";

  assert.deepEqual(board.getAllCards(), [
    { id: created.id, title: "Original", description: "Description", column: "To Do" },
  ]);
  assert.equal(board.getCard("tampered-id"), undefined);
  assert.equal(board.getCardsByColumn("To Do").length, 1);
});

test("mutating elements of getCardsByColumn does not affect the board", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Description", "To Do");

  const cards = board.getCardsByColumn("To Do");
  cards[0].id = "tampered-id";
  cards[0].title = "";
  cards[0].column = "Done";

  assert.deepEqual(board.getAllCards(), [
    { id: created.id, title: "Original", description: "Description", column: "To Do" },
  ]);
  assert.equal(board.getCard("tampered-id"), undefined);
  assert.equal(board.getCardsByColumn("Done").length, 0);
});

test("external mutation cannot bypass validation on later updates", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Description", "To Do");

  const tampered = board.getCard(created.id);
  tampered.column = "Bogus";
  tampered.title = "   ";

  assertThrowsMessage(() => board.updateCard(created.id, { title: "   " }), /title/i);
  assertThrowsMessage(() => board.moveCard(created.id, "Bogus"), /column/i);
  assert.equal(board.getCard(created.id).column, "To Do");
  assert.equal(board.getCard(created.id).title, "Original");
});

test("restoreCard hydrates a card while preserving its id", () => {
  const board = new KanbanBoard();
  const stored = {
    id: "stored-card-id",
    title: "Restored card",
    description: "Loaded from local storage",
    column: "In Progress",
  };

  const restored = board.restoreCard(stored);

  assert.deepEqual(restored, stored);
  assert.deepEqual(board.getCard("stored-card-id"), stored);
  assert.deepEqual(board.getCardsByColumn("In Progress"), [stored]);
});

test("restoreCard preserves insertion order across restores and creates", () => {
  const board = new KanbanBoard();

  board.restoreCard({ id: "a", title: "First", description: "", column: "To Do" });
  board.restoreCard({ id: "b", title: "Second", description: "", column: "Done" });
  const created = board.createCard("Third", "", "To Do");

  assert.deepEqual(
    board.getAllCards().map((card) => card.id),
    ["a", "b", created.id],
  );
});

test("restoreCard rejects invalid fields without storing anything", () => {
  const board = new KanbanBoard();
  const valid = { id: "stored-id", title: "Valid", description: "", column: "To Do" };
  const invalidCards = [
    [{ ...valid, id: "" }, /id/i],
    [{ ...valid, id: "   " }, /id/i],
    [{ ...valid, id: 42 }, /id/i],
    [{ ...valid, id: undefined }, /id/i],
    [{ ...valid, title: "" }, /title/i],
    [{ ...valid, title: "   " }, /title/i],
    [{ ...valid, title: null }, /title/i],
    [{ ...valid, description: undefined }, /description/i],
    [{ ...valid, description: 42 }, /description/i],
    [{ ...valid, column: "Todo" }, /column/i],
    [{ ...valid, column: "" }, /column/i],
    [{ ...valid, column: null }, /column/i],
  ];

  for (const [card, pattern] of invalidCards) {
    assertThrowsMessage(() => board.restoreCard(card), pattern);
  }

  assert.deepEqual(board.getAllCards(), []);
});

test("restoreCard rejects non-object payloads", () => {
  const board = new KanbanBoard();

  for (const payload of [undefined, null, "card", 42, [], [{ id: "a" }]]) {
    assertThrowsMessage(() => board.restoreCard(payload), /restore/i);
  }

  assert.deepEqual(board.getAllCards(), []);
});

test("restoreCard rejects duplicate ids without overwriting the original", () => {
  const board = new KanbanBoard();
  const original = board.restoreCard({
    id: "duplicate-id",
    title: "Original",
    description: "Keep me",
    column: "To Do",
  });

  assertThrowsMessage(
    () =>
      board.restoreCard({
        id: "duplicate-id",
        title: "Replacement",
        description: "Should not win",
        column: "Done",
      }),
    /already exists/i,
  );

  assert.deepEqual(board.getCard("duplicate-id"), original);
  assert.equal(board.getAllCards().length, 1);
});

test("restoreCard rejects ids already created by createCard", () => {
  const board = new KanbanBoard();
  const created = board.createCard("Original", "Keep me", "To Do");

  assertThrowsMessage(
    () =>
      board.restoreCard({
        id: created.id,
        title: "Replacement",
        description: "Should not win",
        column: "Done",
      }),
    /already exists/i,
  );

  assert.deepEqual(board.getCard(created.id), created);
});

test("restoreCard ignores extra properties and returns a detached copy", () => {
  const board = new KanbanBoard();

  const restored = board.restoreCard({
    id: "extra-id",
    title: "Extra",
    description: "Properties",
    column: "Done",
    unexpected: "ignored",
  });

  assert.deepEqual(restored, {
    id: "extra-id",
    title: "Extra",
    description: "Properties",
    column: "Done",
  });

  restored.title = "Tampered";
  restored.column = "To Do";

  assert.equal(board.getCard("extra-id").title, "Extra");
  assert.equal(board.getCard("extra-id").column, "Done");
});
