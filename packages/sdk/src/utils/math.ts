/**
 * Adds two numbers together.
 *
 * @param a - The first number
 * @param b - The second number
 * @returns The sum of a and b
 * @throws {TypeError} If either argument is not a number
 *
 * @example
 * ```ts
 * add(2, 3); // returns 5
 * add(-1, 1); // returns 0
 * add(0.1, 0.2); // returns 0.3
 * ```
 */
export function add(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }

  if (isNaN(a) || isNaN(b)) {
    throw new TypeError('Arguments cannot be NaN');
  }

  return a + b;
}
