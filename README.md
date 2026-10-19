# ryan-sandbox

A dependency-free Kanban board built with plain HTML, CSS, and JavaScript ES
modules. The repository also contains the reusable in-memory board engine and
validators that the app is built on.

## Run the app

Requires Node.js 20 or newer (Node 24 is used in CI).

```bash
npm start
```

Then open <http://127.0.0.1:4173/>. Set `PORT` to use a different port:

```bash
PORT=8080 npm start
```

The app is fully static. If you already have a static file server, serve the
repository root and open `index.html`; no build step or runtime dependency is
needed. Opening the HTML file with a `file://` URL will not work because
browser modules are blocked by CORS.

## Features

- Three columns: **To Do**, **In Progress**, and **Done**.
- Create cards with a title, description, and column.
- Edit card text and column, move cards between columns, and delete cards after
  confirmation.
- Cards persist in `localStorage` under the versioned key
  `kanban-board:v1`; reloading restores cards with their original ids.
- Invalid, partially invalid, malformed, or missing stored data never crashes
  the app. Unreadable payloads reset to an empty board, and individual bad
  entries are skipped and reported through the live status region.
- Accessible controls: native buttons, inputs, selects, and labelled form
  fields; modal `<dialog>` semantics; visible focus; a polite `aria-live`
  status region; keyboard operation; responsive layout down to 320px.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | App shell, card dialog, and delete confirmation dialog. |
| `styles.css` | Responsive layout, focus styles, and dialog styling. |
| `src/app.js` | DOM rendering and UI interaction. |
| `src/board-storage.js` | Versioned serialize/load/save with injectable storage. |
| `src/id-generator.js` | Runtime-agnostic id generation (Web Crypto plus fallback). |
| `src/kanban-board.js` | Framework-free board engine, including `restoreCard`. |
| `src/card-title-validator.js` | Shared card-title validation. |
| `src/kanban-column-validator.js` | Shared column validation. |
| `scripts/serve.js` | Dependency-free local static server. |
| `test/` | Node.js built-in test suites. |

## Engine API

```js
import { KanbanBoard } from "./src/kanban-board.js";

const board = new KanbanBoard();
const card = board.createCard("Write tests", "Cover the engine", "To Do");
board.updateCard(card.id, { description: "Updated" });
board.moveCard(card.id, "In Progress");
board.deleteCard(card.id);
```

`restoreCard({ id, title, description, column })` hydrates a persisted card
while preserving its id. It validates every field through the shared
validators and rejects duplicate ids, so storage adapters cannot bypass engine
rules.

## Test

```bash
npm test
```

The suite uses only `node:test` and `node:assert` and covers the validators,
the engine, id generation including the no-Web-Crypto fallback, and storage
round-trips, corrupt data, invalid entries, duplicate ids, and missing keys.

## Persistence format

```json
{
  "version": 1,
  "cards": [
    {
      "id": "7e7f6c2b-2f5c-4b0e-8f37-0f7f2f9a1c11",
      "title": "Write tests",
      "description": "Cover the engine",
      "column": "To Do"
    }
  ]
}
```

## Limitations

- Persistence is per browser and per origin. Private browsing modes may discard
  storage when the session ends, and clearing site data removes the board.
- There is no sync, backend, authentication, or multi-user conflict handling.
- The board is a local single-user tool; it does not include drag-and-drop.
  Cards are moved with accessible move buttons.
