import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path of the repository root that contains the public app files.
 *
 * @type {string}
 */
export const DEFAULT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * Explicit allowlist of request paths mapped to public application files.
 *
 * The development server deliberately serves only these files. Everything else
 * in the repository, including `.git/`, tests, scripts, and configuration, is
 * not reachable over HTTP.
 *
 * @type {ReadonlyMap<string, string>}
 */
export const PUBLIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/src/app.js", "src/app.js"],
  ["/src/board-storage.js", "src/board-storage.js"],
  ["/src/id-generator.js", "src/id-generator.js"],
  ["/src/kanban-board.js", "src/kanban-board.js"],
  ["/src/card-title-validator.js", "src/card-title-validator.js"],
  ["/src/kanban-column-validator.js", "src/kanban-column-validator.js"],
]);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
]);

/**
 * Resolve an allowed URL pathname to a file inside the repository root.
 *
 * @param {string} pathname Decoded URL pathname.
 * @param {string} root Repository root.
 * @returns {string | null} Absolute file path, or `null` when the path is not
 *   part of the public application.
 */
function resolvePublicPath(pathname, root) {
  const relativePath = PUBLIC_FILES.get(pathname);
  if (relativePath === undefined) {
    return null;
  }

  const filePath = resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${sep}`)) {
    return null;
  }

  return filePath;
}

/**
 * Create the static application server without starting it.
 *
 * Only {@link PUBLIC_FILES} are served. Unknown paths, including internal
 * repository files and traversal attempts, receive a plain 404 so the server
 * does not disclose what exists outside the public application.
 *
 * @param {{ root?: string }} [options] Server options.
 * @returns {import('node:http').Server} Configured HTTP server.
 */
export function createStaticServer({ root = DEFAULT_ROOT } = {}) {
  const resolvedRoot = resolve(root);

  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    const filePath = resolvePublicPath(pathname, resolvedRoot);
    if (filePath === null) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw new Error("Not a file");
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": MIME_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
        "Content-Length": body.byteLength,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });

      if (request.method === "HEAD") {
        response.end();
      } else {
        response.end(body);
      }
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

/**
 * Stop a running server.
 *
 * @param {import('node:http').Server} server Server to close.
 * @param {string} signal Received signal name.
 * @returns {void}
 */
function shutdown(server, signal) {
  console.log(`\nReceived ${signal}; stopping the Kanban dev server.`);
  server.close(() => process.exit(0));
}

const isMainModule =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = Number.parseInt(process.env.PORT ?? "4173", 10);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = createStaticServer();

  server.listen(port, host, () => {
    console.log(`Kanban board: http://${host}:${port}/`);
  });

  process.on("SIGINT", () => shutdown(server, "SIGINT"));
  process.on("SIGTERM", () => shutdown(server, "SIGTERM"));
}
