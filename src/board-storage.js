/**
 * Local board persistence.
 *
 * The storage layer owns serialization only. Every card passes through the
 * engine's `restoreCard`, which applies the shared title/column validators and
 * rejects duplicates, so validation rules are never reimplemented here.
 */

import { isValidCardTitle } from "./card-title-validator.js";
import { isValidKanbanColumn } from "./kanban-column-validator.js";

/** Versioned localStorage key used for the board payload. */
export const STORAGE_KEY = "kanban-board:v1";

/** Schema version stored alongside the cards. */
export const STORAGE_VERSION = 1;

/**
 * @typedef {object} LoadResult
 * @property {'empty' | 'loaded' | 'partial' | 'corrupt' | 'unavailable'} status
 *   Outcome of the load attempt.
 * @property {number} loaded Number of cards restored onto the board.
 * @property {number} skipped Number of stored entries that were rejected.
 */

/**
 * @param {unknown} value Candidate value.
 * @returns {value is Record<string, unknown>} Whether value is a plain object.
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validate and normalize one stored card entry.
 *
 * Returns `null` when the entry is not shaped like a card or fails the shared
 * validators. Extra properties are dropped. The id check mirrors the engine's
 * restore precondition so obvious invalid entries are skipped without relying
 * on exceptions for control flow.
 *
 * @param {unknown} value Candidate stored card.
 * @returns {{ id: string, title: string, description: string, column: string } | null}
 *   A normalized card, or `null` when invalid.
 */
function normalizeStoredCard(value) {
  if (!isRecord(value)) {
    return null;
  }

  const { id, title, description, column } = value;

  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }
  if (!isValidCardTitle(title)) {
    return null;
  }
  if (typeof description !== "string") {
    return null;
  }
  if (!isValidKanbanColumn(column)) {
    return null;
  }

  return { id, title, description, column };
}

/**
 * Load persisted cards into an existing board.
 *
 * The board is cleared first. Missing, malformed, or partially invalid data is
 * handled without throwing: unreadable payloads reset the board to empty, and
 * individually invalid or duplicate entries are skipped. Cards that are
 * restored keep their original ids and insertion order.
 *
 * @param {import('./kanban-board.js').KanbanBoard} board Board to hydrate.
 * @param {Storage | undefined} [storage] Storage implementation; defaults to
 *   `globalThis.localStorage`. Tests may pass a fake.
 * @returns {LoadResult} Summary of the load attempt.
 */
export function loadBoard(board, storage) {
  board.clear();

  /** @type {LoadResult} */
  const result = { status: "empty", loaded: 0, skipped: 0 };

  let raw;
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target || typeof target.getItem !== "function") {
      return { ...result, status: "unavailable" };
    }
    raw = target.getItem(STORAGE_KEY);
  } catch {
    return { ...result, status: "unavailable" };
  }

  if (raw === null || raw === undefined) {
    return result;
  }

  if (typeof raw !== "string") {
    return { ...result, status: "corrupt" };
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ...result, status: "corrupt" };
  }

  if (
    !isRecord(payload) ||
    payload.version !== STORAGE_VERSION ||
    !Array.isArray(payload.cards)
  ) {
    return { ...result, status: "corrupt" };
  }

  for (const entry of payload.cards) {
    const card = normalizeStoredCard(entry);
    if (card === null) {
      result.skipped += 1;
      continue;
    }

    try {
      board.restoreCard(card);
      result.loaded += 1;
    } catch {
      // Duplicate ids and any remaining engine-level rejection are skipped.
      result.skipped += 1;
    }
  }

  result.status = result.skipped > 0 ? "partial" : "loaded";
  return result;
}

/**
 * Serialize the board and write it to storage.
 *
 * @param {import('./kanban-board.js').KanbanBoard} board Board to save.
 * @param {Storage | undefined} [storage] Storage implementation; defaults to
 *   `globalThis.localStorage`. Tests may pass a fake.
 * @returns {number} Number of cards written.
 * @throws {Error} When storage is unavailable or the write fails (for example,
 *   when the browser quota is exceeded).
 */
export function saveBoard(board, storage) {
  let target;
  try {
    target = storage === undefined ? globalThis.localStorage : storage;
  } catch (error) {
    throw new Error("Board storage is unavailable.", { cause: error });
  }

  if (!target || typeof target.setItem !== "function") {
    throw new Error("Board storage is unavailable.");
  }

  const payload = {
    version: STORAGE_VERSION,
    cards: board.getAllCards(),
  };

  try {
    target.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    throw new Error("Unable to save the board to browser storage.", { cause: error });
  }

  return payload.cards.length;
}
