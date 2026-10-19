/**
 * Runtime-agnostic identifier generation.
 *
 * The Kanban engine runs both in Node.js (tests, tooling) and in the browser.
 * This module uses `globalThis.crypto.randomUUID()` when the runtime provides
 * it and falls back to a dependency-free UUID v4 implementation otherwise, so
 * no `node:` import is ever required by browser code.
 */

let fallbackCounter = 0;

/**
 * Fill a byte array with random values, preferring the Web Crypto API.
 *
 * @param {Uint8Array} bytes Destination buffer.
 * @param {Crypto | undefined} cryptoSource Runtime crypto implementation, if any.
 * @returns {void}
 */
function fillRandomBytes(bytes, cryptoSource) {
  if (cryptoSource && typeof cryptoSource.getRandomValues === "function") {
    try {
      cryptoSource.getRandomValues(bytes);
      return;
    } catch {
      // Fall through to the Math.random implementation below.
    }
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
}

/**
 * Build a UUID v4-shaped identifier without any runtime dependency.
 *
 * Timestamp and counter bytes are mixed in so identifiers stay distinct even
 * when `Math.random` is weak, mocked, or unavailable. The version and variant
 * bits are set so the result is a well-formed UUID v4 string.
 *
 * @param {Crypto | undefined} [cryptoSource] Runtime crypto implementation.
 * @returns {string} A UUID v4 string.
 */
export function createFallbackId(cryptoSource = globalThis.crypto) {
  const bytes = new Uint8Array(16);
  fillRandomBytes(bytes, cryptoSource);

  fallbackCounter = (fallbackCounter + 1) >>> 0;
  const timestamp = Date.now();

  // Mix a millisecond timestamp into bytes 0-5 and a process-local counter into
  // bytes 12-15, keeping collisions unlikely regardless of random quality.
  for (let index = 0; index < 6; index += 1) {
    bytes[index] ^= Math.floor(timestamp / 2 ** (8 * index)) & 0xff;
  }
  bytes[12] = (fallbackCounter >>> 24) & 0xff;
  bytes[13] = (fallbackCounter >>> 16) & 0xff;
  bytes[14] = (fallbackCounter >>> 8) & 0xff;
  bytes[15] = fallbackCounter & 0xff;

  // RFC 4122 version 4 and variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * Generate a unique identifier for a card.
 *
 * @param {Crypto | undefined} [cryptoSource] Runtime crypto implementation.
 *   Defaults to `globalThis.crypto`; callers normally omit this argument.
 * @returns {string} A non-empty identifier string.
 */
export function generateId(cryptoSource = globalThis.crypto) {
  if (cryptoSource && typeof cryptoSource.randomUUID === "function") {
    try {
      const id = cryptoSource.randomUUID();
      if (typeof id === "string" && id.length > 0) {
        return id;
      }
    } catch {
      // Fall through to the dependency-free implementation.
    }
  }

  return createFallbackId(cryptoSource);
}

export default generateId;
