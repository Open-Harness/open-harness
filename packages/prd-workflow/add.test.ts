/**
 * Tests for the add function
 *
 * Comprehensive unit tests to verify the add function works correctly
 * with various inputs including positive numbers, negative numbers,
 * decimals, and zero.
 */

import { describe, it, expect } from "bun:test";
import { add } from "./add.js";

describe("add function", () => {
  it("should add positive numbers correctly", () => {
    expect(add(1, 2)).toBe(3);
    expect(add(5, 10)).toBe(15);
    expect(add(100, 200)).toBe(300);
  });

  it("should add negative numbers correctly", () => {
    expect(add(-1, -2)).toBe(-3);
    expect(add(-5, -10)).toBe(-15);
    expect(add(-100, -200)).toBe(-300);
  });

  it("should add mixed positive and negative numbers correctly", () => {
    expect(add(5, -3)).toBe(2);
    expect(add(-5, 3)).toBe(-2);
    expect(add(10, -15)).toBe(-5);
    expect(add(-10, 15)).toBe(5);
  });

  it("should add decimal numbers correctly", () => {
    expect(add(1.5, 2.3)).toBe(3.8);
    expect(add(0.1, 0.2)).toBeCloseTo(0.3); // Using toBeCloseTo for floating point precision
    expect(add(3.14, 2.86)).toBe(6);
    expect(add(-1.5, 2.5)).toBe(1);
  });

  it("should handle addition with zero correctly", () => {
    expect(add(0, 0)).toBe(0);
    expect(add(5, 0)).toBe(5);
    expect(add(0, 5)).toBe(5);
    expect(add(-5, 0)).toBe(-5);
    expect(add(0, -5)).toBe(-5);
  });

  it("should handle large numbers correctly", () => {
    expect(add(1000000, 2000000)).toBe(3000000);
    expect(add(-1000000, -2000000)).toBe(-3000000);
  });

  it("should handle very small decimal numbers correctly", () => {
    expect(add(0.0001, 0.0002)).toBeCloseTo(0.0003);
    expect(add(-0.0001, 0.0003)).toBeCloseTo(0.0002);
  });
});