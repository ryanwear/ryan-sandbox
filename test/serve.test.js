import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request } from "node:http";

import { createStaticServer, PUBLIC_FILES } from "../scripts/serve.js";

/**
 * Start a server on an ephemeral loopback port and close it after the test.
 *
 * @param {import('node:test').TestContext} t Test context.
 * @returns {Promise<string>} Server origin.
 */
async function startServer(t) {
  const server = createStaticServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

/**
 * Issue a raw HTTP request without letting the client normalize the path.
 *
 * @param {string} origin Server origin.
 * @param {string} path Request path.
 * @param {string} [method] HTTP method.
 * @returns {Promise<{status: number | undefined, headers: import('node:http').IncomingHttpHeaders, body: string}>}
 *   Response details.
 */
function requestPath(origin, path, method = "GET") {
  const url = new URL(origin);

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        port: url.port,
        path,
        method,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({ status: response.statusCode, headers: response.headers, body });
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

test("serves every public application file", async (t) => {
  const origin = await startServer(t);

  for (const [pathname, relativePath] of PUBLIC_FILES) {
    const response = await requestPath(origin, pathname);

    assert.equal(response.status, 200, `${pathname} should be public`);
    assert.ok(response.body.length > 0, `${pathname} should have a body`);

    if (relativePath.endsWith(".css")) {
      assert.match(response.headers["content-type"] ?? "", /^text\/css/);
    } else if (relativePath.endsWith(".js")) {
      assert.match(response.headers["content-type"] ?? "", /^text\/javascript/);
    } else {
      assert.match(response.headers["content-type"] ?? "", /^text\/html/);
    }
  }
});

test("serves index.html for the application root", async (t) => {
  const origin = await startServer(t);
  const response = await requestPath(origin, "/");

  assert.equal(response.status, 200);
  assert.match(response.body, /<title>Kanban Board<\/title>/);
  assert.match(response.body, /src="src\/app\.js"/);
});

test("does not serve internal repository files", async (t) => {
  const origin = await startServer(t);
  const internalPaths = [
    "/.git/config",
    "/.git/HEAD",
    "/.github/workflows/ci.yml",
    "/.gitignore",
    "/AGENTS.md",
    "/README.md",
    "/package.json",
    "/package-lock.json",
    "/scripts/serve.js",
    "/test/kanban-board.test.js",
    "/test/board-storage.test.js",
  ];

  for (const pathname of internalPaths) {
    const response = await requestPath(origin, pathname);

    assert.equal(response.status, 404, `${pathname} must not be served`);
    assert.equal(response.body, "Not found");
    assert.match(response.headers["content-type"] ?? "", /^text\/plain/);
  }
});

test("does not serve traversal attempts", async (t) => {
  const origin = await startServer(t);
  const traversalPaths = [
    "/%2e%2e/package.json",
    "/..%2fpackage.json",
    "/%2e%2e%2f%2e%2e%2fpackage.json",
    "/src/%2e%2e/%2e%2e/package.json",
    "/src/%2e%2e%2f..%2f.git%2fconfig",
    "/%2e%2e%2f.git%2fconfig",
  ];

  for (const pathname of traversalPaths) {
    const response = await requestPath(origin, pathname);

    assert.equal(response.status, 404, `${pathname} must not be served`);
    assert.equal(response.body, "Not found");
  }
});

test("ignores query strings when resolving public files", async (t) => {
  const origin = await startServer(t);
  const response = await requestPath(origin, "/styles.css?cache-bust=1");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"] ?? "", /^text\/css/);
});

test("supports HEAD and rejects unsupported methods", async (t) => {
  const origin = await startServer(t);

  const head = await requestPath(origin, "/index.html", "HEAD");
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
  assert.ok(Number(head.headers["content-length"]) > 0);

  for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
    const response = await requestPath(origin, "/", method);
    assert.equal(response.status, 405, `${method} should not be allowed`);
    assert.equal(response.headers.allow, "GET, HEAD");
  }
});

test("every local asset referenced by index.html is public", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith("#") && !reference.includes("://"));

  assert.ok(references.length > 0);
  for (const reference of references) {
    const pathname = new URL(reference, "http://localhost/").pathname;
    assert.ok(
      PUBLIC_FILES.has(pathname),
      `${reference} is referenced by index.html but is not in PUBLIC_FILES`,
    );
  }
});
