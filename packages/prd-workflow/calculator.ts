/**
 * Calculator function that performs basic arithmetic operations
 * @param operation - The operation to perform: 'add', 'subtract', 'multiply', or 'divide'
 * @param a - The first number
 * @param b - The second number
 * @returns The result of the calculation
 */
export function calculate(operation: string, a: number, b: number): number {
  // Validate and perform the requested arithmetic operation

  switch (operation) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      return a / b;
    default:
      // Placeholder error handling - will be completed in T004
      throw new Error(`Unknown operation: ${operation}`);
  }
}