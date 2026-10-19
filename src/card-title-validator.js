/**
 * Validates a Kanban card title.
 *
 * A title is valid when it is a string containing at least one character that
 * is not Unicode whitespace. Non-string values are never valid.
 *
 * @param {unknown} title - Candidate card title.
 * @returns {boolean} `true` when `title` is a non-empty string containing at
 *   least one non-whitespace character, otherwise `false`.
 */
export function isValidCardTitle(title) {
  if (typeof title !== "string") {
    return false;
  }

  // String.prototype.trim() strips whitespace per the ECMAScript WhiteSpace
  // and LineTerminator definitions, which include Unicode space separators
  // such as U+00A0 and U+3000. Any character remaining is real content.
  return title.trim().length > 0;
}

export default isValidCardTitle;
