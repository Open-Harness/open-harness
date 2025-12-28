/**
 * Adds two numbers together
 * @param {number} a - The first number
 * @param {number} b - The second number
 * @returns {number} The sum of a and b
 * @throws {TypeError} If either argument is not a number
 */
function add(a, b) {
	if (typeof a !== "number" || typeof b !== "number") {
		throw new TypeError("Both arguments must be numbers");
	}

	if (!Number.isFinite(a) || !Number.isFinite(b)) {
		throw new RangeError("Arguments must be finite numbers");
	}

	return a + b;
}

module.exports = add;
