import { describe, expect, it } from "vitest";
import { budgetHealth, formatCents, parseDollarsToCents } from "./money";

describe("money", () => {
  it("parses dollars into integer cents", () => {
    expect(parseDollarsToCents("$1,234.5")).toBe(123450);
    expect(parseDollarsToCents("0.1")).toBe(10);
    expect(parseDollarsToCents("12.345")).toBeNull();
  });
  it("formats cents as $1,234.56", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(-5)).toBe("-$0.05");
  });
  it("is red when spent is over budget", () => {
    expect(budgetHealth(10001, 0, 10000)).toBe("red");
  });
  it("is yellow at 80% spent", () => {
    expect(budgetHealth(8000, 0, 10000)).toBe("yellow");
  });
  it("is yellow when spent + promised exceeds budget", () => {
    expect(budgetHealth(5000, 5001, 10000)).toBe("yellow");
  });
  it("is green otherwise", () => {
    expect(budgetHealth(7999, 2001, 10000)).toBe("green");
  });
});
