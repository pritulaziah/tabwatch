/**
 * Value that the fixture must have. A missing key fails the test with a
 * clear message instead of an undefined read.
 */
export function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('the test fixture has no such value');
  }
  return value;
}
