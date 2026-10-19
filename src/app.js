import { loadBoard, saveBoard } from "./board-storage.js";
import { isValidCardTitle } from "./card-title-validator.js";
import { KanbanBoard } from "./kanban-board.js";
import { isValidKanbanColumn, VALID_COLUMNS } from "./kanban-column-validator.js";

const COLUMNS = [...VALID_COLUMNS];
const DEFAULT_COLUMN = COLUMNS[0];

const board = new KanbanBoard();

const boardElement = document.querySelector("#board");
const statusElement = document.querySelector("#status");
const newCardButton = document.querySelector("#new-card-button");

const cardDialog = document.querySelector("#card-dialog");
const cardDialogTitle = document.querySelector("#card-dialog-title");
const cardForm = document.querySelector("#card-form");
const titleInput = document.querySelector("#card-title");
const descriptionInput = document.querySelector("#card-description");
const columnSelect = document.querySelector("#card-column");
const formError = document.querySelector("#form-error");
const saveButton = document.querySelector("#card-save");
const cardCancelButton = document.querySelector("#card-cancel");

const deleteDialog = document.querySelector("#delete-dialog");
const deleteMessage = document.querySelector("#delete-dialog-message");
const deleteCancelButton = document.querySelector("#delete-cancel");
const deleteConfirmButton = document.querySelector("#delete-confirm");

let editingId = null;
let pendingDeleteId = null;

for (const column of COLUMNS) {
  columnSelect.append(new Option(column, column));
}

/**
 * Announce a message through the page's polite live region.
 *
 * @param {string} message Status text.
 * @returns {void}
 */
function announce(message) {
  statusElement.textContent = message;
}

/**
 * Persist the current board, reporting failures without losing in-memory work.
 *
 * @returns {boolean} `true` when the board was written.
 */
function persist() {
  try {
    saveBoard(board);
    return true;
  } catch {
    announce("Your changes are visible, but this browser could not save them.");
    return false;
  }
}

/**
 * Find a card element by its stored id.
 *
 * @param {string} id Card id.
 * @returns {HTMLElement | undefined} Matching card element.
 */
function findCardElement(id) {
  return [...boardElement.querySelectorAll(".card")].find(
    (element) => element.dataset.cardId === id,
  );
}

/**
 * Move focus to one of a card's controls after a re-render.
 *
 * @param {string} id Card id.
 * @param {'edit' | 'delete' | 'move-previous' | 'move-next'} action Control to focus.
 * @returns {void}
 */
function focusCardAction(id, action) {
  const cardElement = findCardElement(id);
  const button = cardElement?.querySelector(`[data-action="${action}"]`);
  if (button instanceof HTMLElement) {
    button.focus();
  }
}

/**
 * Build one column section with its cards.
 *
 * @param {string} column Column name.
 * @param {number} columnIndex Column position.
 * @returns {HTMLElement} Column section.
 */
function createColumn(column, columnIndex) {
  const cards = board.getCardsByColumn(column);
  const headingId = `column-${columnIndex}-heading`;

  const section = document.createElement("section");
  section.className = "column";
  section.setAttribute("aria-labelledby", headingId);

  const header = document.createElement("div");
  header.className = "column-header";

  const heading = document.createElement("h2");
  heading.id = headingId;
  heading.className = "column-title";
  heading.append(document.createTextNode(column));

  const count = document.createElement("span");
  count.className = "count";
  count.setAttribute("aria-hidden", "true");
  count.textContent = String(cards.length);

  const countLabel = document.createElement("span");
  countLabel.className = "sr-only";
  countLabel.textContent = `${cards.length} ${cards.length === 1 ? "card" : "cards"}`;

  header.append(heading, count, countLabel);

  const list = document.createElement("ul");
  list.className = "card-list";
  list.dataset.column = column;

  if (cards.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No cards yet.";
    list.append(empty);
  } else {
    for (const card of cards) {
      list.append(createCardElement(card, columnIndex));
    }
  }

  section.append(header, list);
  return section;
}

/**
 * Build a single card list item and its controls.
 *
 * @param {{ id: string, title: string, description: string, column: string }} card Card data.
 * @param {number} columnIndex Index of the card's current column.
 * @returns {HTMLLIElement} Card list item.
 */
function createCardElement(card, columnIndex) {
  const item = document.createElement("li");
  item.className = "card";
  item.dataset.cardId = card.id;

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = card.title;

  const description = document.createElement("p");
  description.className = "card-description";
  if (card.description.length === 0) {
    description.classList.add("is-empty");
    description.textContent = "No description.";
  } else {
    description.textContent = card.description;
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const previousColumn = COLUMNS[columnIndex - 1];
  const nextColumn = COLUMNS[columnIndex + 1];

  const movePrevious = createActionButton("move-previous", "←", card);
  movePrevious.classList.add("button", "button-quiet", "move-button");
  if (previousColumn) {
    movePrevious.setAttribute("aria-label", `Move “${card.title}” to ${previousColumn}`);
  } else {
    movePrevious.disabled = true;
    movePrevious.setAttribute("aria-label", `“${card.title}” is already in the first column`);
  }

  const moveNext = createActionButton("move-next", "→", card);
  moveNext.classList.add("button", "button-quiet", "move-button");
  if (nextColumn) {
    moveNext.setAttribute("aria-label", `Move “${card.title}” to ${nextColumn}`);
  } else {
    moveNext.disabled = true;
    moveNext.setAttribute("aria-label", `“${card.title}” is already in the last column`);
  }

  const spacer = document.createElement("span");
  spacer.className = "spacer";
  spacer.setAttribute("aria-hidden", "true");

  const edit = createActionButton("edit", "Edit", card);
  edit.classList.add("button", "button-quiet");
  edit.setAttribute("aria-label", `Edit “${card.title}”`);

  const remove = createActionButton("delete", "Delete", card);
  remove.classList.add("button", "button-danger-quiet");
  remove.setAttribute("aria-label", `Delete “${card.title}”`);

  actions.append(movePrevious, moveNext, spacer, edit, remove);
  item.append(title, description, actions);
  return item;
}

/**
 * Create a card action button carrying the card id.
 *
 * @param {string} action Action name.
 * @param {string} label Visible label.
 * @param {{ id: string }} card Card being acted on.
 * @returns {HTMLButtonElement} Configured button.
 */
function createActionButton(action, label, card) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.dataset.cardId = card.id;
  button.textContent = label;
  return button;
}

/**
 * Re-render every column from the current board state.
 *
 * @returns {void}
 */
function render() {
  const fragment = document.createDocumentFragment();
  COLUMNS.forEach((column, index) => {
    fragment.append(createColumn(column, index));
  });
  boardElement.replaceChildren(fragment);
}

/**
 * Hide and clear the dialog error message.
 *
 * @returns {void}
 */
function clearFormError() {
  formError.hidden = true;
  formError.textContent = "";
  titleInput.removeAttribute("aria-invalid");
  columnSelect.removeAttribute("aria-invalid");
}

/**
 * Show a validation or save error in the card dialog.
 *
 * @param {string} message Error text.
 * @param {HTMLElement} [field] Field to mark invalid and focus.
 * @returns {void}
 */
function showFormError(message, field) {
  formError.textContent = message;
  formError.hidden = false;
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

/**
 * Open the card dialog in create or edit mode.
 *
 * @param {{ id: string, title: string, description: string, column: string } | null} card
 *   Card to edit, or `null` to create a new card.
 * @returns {void}
 */
function openCardDialog(card) {
  editingId = card ? card.id : null;
  cardDialogTitle.textContent = card ? "Edit card" : "New card";
  saveButton.textContent = card ? "Save changes" : "Save card";

  cardForm.reset();
  clearFormError();
  columnSelect.value = card ? card.column : DEFAULT_COLUMN;
  if (card) {
    titleInput.value = card.title;
    descriptionInput.value = card.description;
  }

  if (!cardDialog.open) {
    cardDialog.showModal();
  }
  titleInput.focus();
  if (card) {
    titleInput.select();
  }
}

/**
 * Close the card dialog and clear edit state.
 *
 * @returns {void}
 */
function closeCardDialog() {
  editingId = null;
  if (cardDialog.open) {
    cardDialog.close();
  }
  newCardButton.focus();
}

/**
 * Open the delete confirmation dialog for a card.
 *
 * @param {string} id Card id.
 * @returns {void}
 */
function openDeleteDialog(id) {
  const card = board.getCard(id);
  if (!card) {
    return;
  }

  pendingDeleteId = id;
  deleteMessage.textContent = `“${card.title}” will be permanently removed from this browser.`;
  if (!deleteDialog.open) {
    deleteDialog.showModal();
  }
  deleteCancelButton.focus();
}

/**
 * Handle card dialog submission.
 *
 * @param {SubmitEvent} event Form submit event.
 * @returns {void}
 */
function handleCardSubmit(event) {
  event.preventDefault();

  const title = titleInput.value;
  const description = descriptionInput.value;
  const column = columnSelect.value;
  const wasEditing = editingId !== null;

  if (!isValidCardTitle(title)) {
    showFormError("Enter a title before saving the card.", titleInput);
    return;
  }
  if (!isValidKanbanColumn(column)) {
    showFormError("Choose a valid column before saving the card.", columnSelect);
    return;
  }

  let savedCard;
  try {
    savedCard = wasEditing
      ? board.updateCard(editingId, { title, description, column })
      : board.createCard(title, description, column);
  } catch (error) {
    showFormError(error instanceof Error ? error.message : "Unable to save this card.");
    return;
  }

  cardDialog.close();
  editingId = null;
  render();
  focusCardAction(savedCard.id, "edit");

  if (persist()) {
    announce(
      wasEditing
        ? `Saved changes to “${title}”.`
        : `Created “${title}” in ${savedCard.column}.`,
    );
  }
}

newCardButton.addEventListener("click", () => openCardDialog(null));

cardCancelButton.addEventListener("click", closeCardDialog);
cardForm.addEventListener("submit", handleCardSubmit);

cardForm.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    cardForm.requestSubmit();
  }
});

titleInput.addEventListener("input", clearFormError);
columnSelect.addEventListener("change", clearFormError);

deleteCancelButton.addEventListener("click", () => {
  pendingDeleteId = null;
  deleteDialog.close();
});

deleteDialog.addEventListener("close", () => {
  pendingDeleteId = null;
});

deleteConfirmButton.addEventListener("click", () => {
  const card = pendingDeleteId === null ? undefined : board.getCard(pendingDeleteId);
  pendingDeleteId = null;
  deleteDialog.close();

  if (!card) {
    return;
  }

  board.deleteCard(card.id);
  render();
  newCardButton.focus();

  if (persist()) {
    announce(`Deleted “${card.title}”.`);
  }
});

boardElement.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-action]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const { action, cardId } = button.dataset;
  if (!action || !cardId) {
    return;
  }

  if (action === "edit") {
    const card = board.getCard(cardId);
    if (card) {
      openCardDialog(card);
    }
    return;
  }

  if (action === "delete") {
    openDeleteDialog(cardId);
    return;
  }

  const card = board.getCard(cardId);
  if (!card) {
    return;
  }

  const currentIndex = COLUMNS.indexOf(card.column);
  const targetColumn =
    action === "move-previous"
      ? COLUMNS[currentIndex - 1]
      : action === "move-next"
        ? COLUMNS[currentIndex + 1]
        : undefined;

  if (!targetColumn) {
    return;
  }

  try {
    board.moveCard(card.id, targetColumn);
  } catch {
    announce("This card could not be moved.");
    return;
  }

  render();
  focusCardAction(card.id, "edit");

  if (persist()) {
    announce(`Moved “${card.title}” to ${targetColumn}.`);
  }
});

const loadResult = loadBoard(board);
render();

if (loadResult.status === "unavailable") {
  announce("Browser storage is unavailable. Cards will be lost when this page reloads.");
} else if (loadResult.status === "corrupt") {
  if (persist()) {
    announce("Saved board data could not be read and the board was reset.");
  }
} else if (loadResult.status === "partial") {
  if (persist()) {
    announce(
      `Restored ${loadResult.loaded} ${loadResult.loaded === 1 ? "card" : "cards"} and skipped ${loadResult.skipped} invalid ${loadResult.skipped === 1 ? "entry" : "entries"}.`,
    );
  }
} else if (loadResult.status === "loaded") {
  if (loadResult.loaded === 0) {
    announce("Board loaded. No cards yet.");
  } else {
    announce(
      `Restored ${loadResult.loaded} ${loadResult.loaded === 1 ? "card" : "cards"} from this browser.`,
    );
  }
}
