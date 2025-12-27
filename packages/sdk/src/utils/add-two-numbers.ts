/**
 * Adds two numbers together and returns the result.
 *
 * @param num1 - The first number to add
 * @param num2 - The second number to add
 * @returns The sum of num1 and num2
 * @throws {TypeError} If either argument is not a valid number
 *
 * @example
 * ```ts
 * addTwoNumbers(5, 10);    // returns 15
 * addTwoNumbers(-3, 7);    // returns 4
 * addTwoNumbers(2.5, 3.5); // returns 6
 * ```
 */
export function addTwoNumbers(num1: number, num2: number): number {
	// Validate that both arguments are numbers
	if (typeof num1 !== "number" || typeof num2 !== "number") {
		throw new TypeError(
			`Expected two numbers, but received ${typeof num1} and ${typeof num2}`,
		);
	}

	// Check for NaN values
	if (Number.isNaN(num1) || Number.isNaN(num2)) {
		throw new TypeError("Arguments cannot be NaN");
	}

	// Perform the addition
	return num1 + num2;
}
