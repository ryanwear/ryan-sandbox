const VALID_COLUMNS = new Set(['To Do', 'In Progress', 'Done']);

/**
 * Determine whether a value is a valid kanban column name.
 *
 * Valid columns are exactly 'To Do', 'In Progress', and 'Done'.
 * Matching is case-sensitive and performs no trimming or coercion, so
 * whitespace variations, different casing, and non-string values are invalid.
 *
 * @param {unknown} value Candidate column name.
 * @returns {boolean} True only when value is one of the valid column names.
 */
export function isValidKanbanColumn(value) {
  return typeof value === 'string' && VALID_COLUMNS.has(value);
}

export { VALID_COLUMNS };
