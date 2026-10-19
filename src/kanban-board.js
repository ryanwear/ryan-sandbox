import { isValidCardTitle } from "./card-title-validator.js";
import { generateId } from "./id-generator.js";
import { isValidKanbanColumn, VALID_COLUMNS } from "./kanban-column-validator.js";

const VALID_COLUMN_LIST = [...VALID_COLUMNS].map((column) => JSON.stringify(column)).join(", ");

/**
 * Throws unless `title` is a valid Kanban card title.
 *
 * @param {unknown} title Candidate title.
 * @returns {void}
 * @throws {TypeError} When the title is not a non-empty string.
 */
function assertValidTitle(title) {
  if (!isValidCardTitle(title)) {
    throw new TypeError("Invalid card title: expected a non-empty string.");
  }
}

/**
 * Throws unless `description` is a string.
 *
 * @param {unknown} description Candidate description.
 * @returns {void}
 * @throws {TypeError} When the description is not a string.
 */
function assertValidDescription(description) {
  if (typeof description !== "string") {
    throw new TypeError("Invalid card description: expected a string.");
  }
}

/**
 * Throws unless `column` is a valid Kanban column.
 *
 * @param {unknown} column Candidate column.
 * @returns {void}
 * @throws {TypeError} When the column is not one of `VALID_COLUMNS`.
 */
function assertValidColumn(column) {
  if (!isValidKanbanColumn(column)) {
    throw new TypeError(
      `Invalid kanban column: ${JSON.stringify(column)}. Expected one of ${VALID_COLUMN_LIST}.`,
    );
  }
}

/**
 * Throws unless `changes` is a plain object suitable for `updateCard`.
 *
 * @param {unknown} changes Candidate update payload.
 * @returns {void}
 * @throws {TypeError} When the payload is not a non-array object.
 */
function assertValidChanges(changes) {
  if (changes === null || typeof changes !== "object" || Array.isArray(changes)) {
    throw new TypeError(
      "Invalid card update: expected an object with optional title, description, and column properties.",
    );
  }
}

/**
 * Throws unless `card` is a plain object suitable for `restoreCard`.
 *
 * @param {unknown} card Candidate hydrate payload.
 * @returns {void}
 * @throws {TypeError} When the payload is not a non-array object.
 */
function assertValidCardRecord(card) {
  if (card === null || typeof card !== "object" || Array.isArray(card)) {
    throw new TypeError(
      "Invalid card restore: expected an object with id, title, description, and column properties.",
    );
  }
}

/**
 * Throws unless `id` is a non-empty string.
 *
 * @param {unknown} id Candidate card id.
 * @returns {void}
 * @throws {TypeError} When the id is not a non-empty string.
 */
function assertValidCardId(id) {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new TypeError("Invalid card id: expected a non-empty string.");
  }
}

/**
 * Shallow-copy a stored card for handing to a caller.
 *
 * Every card-returning method hands out a copy so callers cannot bypass
 * validation, change a stored id, or otherwise mutate internal state.
 *
 * @param {{ id: string, title: string, description: string, column: string }} card Stored card.
 * @returns {{ id: string, title: string, description: string, column: string }} A detached copy.
 */
function copyCard(card) {
  return { ...card };
}

/**
 * In-memory Kanban board.
 *
 * Cards are stored by unique id in insertion order. Every mutation validates
 * its inputs before changing state, so a failed call leaves the board intact.
 * Card-returning methods hand out shallow copies, so mutating a returned
 * object never reaches the board's internal state.
 */
export class KanbanBoard {
  /** @type {Map<string, { id: string, title: string, description: string, column: string }>} */
  #cards = new Map();

  /**
   * Create and store a new card.
   *
   * @param {string} title Card title; must pass `isValidCardTitle`.
   * @param {string} description Card description; may be empty.
   * @param {'To Do' | 'In Progress' | 'Done'} column Initial column.
   * @returns {{ id: string, title: string, description: string, column: string }} A copy of the stored card.
   * @throws {TypeError} When the title, description, or column is invalid.
   */
  createCard(title, description, column) {
    assertValidTitle(title);
    assertValidDescription(description);
    assertValidColumn(column);

    let id = generateId();
    while (this.#cards.has(id)) {
      id = generateId();
    }

    const card = { id, title, description, column };
    this.#cards.set(id, card);
    return copyCard(card);
  }

  /**
   * Restore a previously persisted card while preserving its existing id.
   *
   * Every field is validated with the same rules used by `createCard` before
   * anything is stored, so invalid or inconsistent persisted data never enters
   * the board. Duplicate ids are rejected rather than overwriting an existing
   * card.
   *
   * @param {{ id: string, title: string, description: string, column: string }} card
   *   Stored card representation to hydrate.
   * @returns {{ id: string, title: string, description: string, column: string }}
   *   A copy of the restored card.
   * @throws {TypeError} When the payload or one of its fields is invalid.
   * @throws {Error} When a card with the same id already exists.
   */
  restoreCard(card) {
    assertValidCardRecord(card);

    const { id, title, description, column } = card;

    assertValidCardId(id);
    assertValidTitle(title);
    assertValidDescription(description);
    assertValidColumn(column);

    if (this.#cards.has(id)) {
      throw new Error(`Card already exists: ${id}`);
    }

    const restored = { id, title, description, column };
    this.#cards.set(id, restored);
    return copyCard(restored);
  }

  /**
   * Look up a card by id.
   *
   * @param {string} id Card id.
   * @returns {{ id: string, title: string, description: string, column: string } | undefined}
   *   A copy of the card, or `undefined` when no card has that id.
   */
  getCard(id) {
    const card = this.#cards.get(id);
    return card === undefined ? undefined : copyCard(card);
  }

  /**
   * Update one or more fields of an existing card.
   *
   * All provided fields are validated before any of them are applied.
   *
   * @param {string} id Card id.
   * @param {{ title?: string, description?: string, column?: string }} changes
   *   Fields to update; omitted fields keep their current value.
   * @returns {{ id: string, title: string, description: string, column: string }} A copy of the updated card.
   * @throws {Error} When no card has the given id.
   * @throws {TypeError} When the payload or one of its fields is invalid.
   */
  updateCard(id, changes) {
    const card = this.#cards.get(id);
    if (!card) {
      throw new Error(`Card not found: ${String(id)}`);
    }

    assertValidChanges(changes);

    const hasTitle = Object.hasOwn(changes, "title");
    const hasDescription = Object.hasOwn(changes, "description");
    const hasColumn = Object.hasOwn(changes, "column");

    if (hasTitle) {
      assertValidTitle(changes.title);
    }
    if (hasDescription) {
      assertValidDescription(changes.description);
    }
    if (hasColumn) {
      assertValidColumn(changes.column);
    }

    if (hasTitle) {
      card.title = changes.title;
    }
    if (hasDescription) {
      card.description = changes.description;
    }
    if (hasColumn) {
      card.column = changes.column;
    }

    return copyCard(card);
  }

  /**
   * Move a card to another column.
   *
   * @param {string} id Card id.
   * @param {'To Do' | 'In Progress' | 'Done'} newColumn Destination column.
   * @returns {{ id: string, title: string, description: string, column: string }} A copy of the moved card.
   * @throws {Error} When no card has the given id.
   * @throws {TypeError} When the destination column is invalid.
   */
  moveCard(id, newColumn) {
    const card = this.#cards.get(id);
    if (!card) {
      throw new Error(`Card not found: ${String(id)}`);
    }

    assertValidColumn(newColumn);
    card.column = newColumn;
    return copyCard(card);
  }

  /**
   * Delete a card.
   *
   * @param {string} id Card id.
   * @returns {boolean} `true` when a card was removed, otherwise `false`.
   */
  deleteCard(id) {
    return this.#cards.delete(id);
  }

  /**
   * Get every card in insertion order.
   *
   * @returns {Array<{ id: string, title: string, description: string, column: string }>}
   *   A new array containing copies of all stored cards.
   */
  getAllCards() {
    return [...this.#cards.values()].map(copyCard);
  }

  /**
   * Get every card in a specific column, in insertion order.
   *
   * @param {'To Do' | 'In Progress' | 'Done'} column Column to filter by.
   * @returns {Array<{ id: string, title: string, description: string, column: string }>}
   *   A new array containing copies of the matching cards.
   * @throws {TypeError} When the column is invalid.
   */
  getCardsByColumn(column) {
    assertValidColumn(column);
    return [...this.#cards.values()]
      .filter((card) => card.column === column)
      .map(copyCard);
  }

  /**
   * Remove every card. Useful for resetting a board between tests.
   *
   * @returns {void}
   */
  clear() {
    this.#cards.clear();
  }
}

export default KanbanBoard;
