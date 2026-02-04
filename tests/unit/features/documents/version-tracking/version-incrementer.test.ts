import { describe, it, expect, beforeEach } from "vitest";
import { VersionIncrementer } from "../../../../../src/features/documents/version-tracking/version-incrementer";

describe("VersionIncrementer", () => {
	let incrementer: VersionIncrementer;

	beforeEach(() => {
		incrementer = new VersionIncrementer();
	});

	describe("increment()", () => {
		it("should increment minor version (1.0 → 1.1)", () => {
			const result = incrementer.increment("1.0");
			expect(result).toBe("1.1");
		});

		it("should increment minor version (1.5 → 1.6)", () => {
			const result = incrementer.increment("1.5");
			expect(result).toBe("1.6");
		});

		it("should overflow from 1.9 to 2.0", () => {
			const result = incrementer.increment("1.9");
			expect(result).toBe("2.0");
		});

		it("should increment in major version 2 (2.5 → 2.6)", () => {
			const result = incrementer.increment("2.5");
			expect(result).toBe("2.6");
		});

		it("should overflow from 2.9 to 3.0", () => {
			const result = incrementer.increment("2.9");
			expect(result).toBe("3.0");
		});

		it("should handle major version 10+ (10.5 → 10.6)", () => {
			const result = incrementer.increment("10.5");
			expect(result).toBe("10.6");
		});

		it("should normalize and increment empty string (empty → 1.0 → 1.1)", () => {
			const result = incrementer.increment("");
			expect(result).toBe("1.1");
		});

		it("should normalize and increment invalid version (abc → 1.0 → 1.1)", () => {
			const result = incrementer.increment("abc");
			expect(result).toBe("1.1");
		});
	});

	describe("isValid()", () => {
		it("should accept valid format 1.0", () => {
			expect(incrementer.isValid("1.0")).toBe(true);
		});

		it("should accept valid format 2.5", () => {
			expect(incrementer.isValid("2.5")).toBe(true);
		});

		it("should accept valid format 10.9", () => {
			expect(incrementer.isValid("10.9")).toBe(true);
		});

		it("should reject double-digit minor (1.10)", () => {
			expect(incrementer.isValid("1.10")).toBe(false);
		});

		it("should reject version with prefix (v1.0)", () => {
			expect(incrementer.isValid("v1.0")).toBe(false);
		});

		it("should reject non-numeric version (abc)", () => {
			expect(incrementer.isValid("abc")).toBe(false);
		});

		it("should reject version with only major (1)", () => {
			expect(incrementer.isValid("1")).toBe(false);
		});

		it("should reject version with three parts (1.0.0)", () => {
			expect(incrementer.isValid("1.0.0")).toBe(false);
		});

		it("should reject empty string", () => {
			expect(incrementer.isValid("")).toBe(false);
		});
	});

	describe("normalize()", () => {
		it("should normalize overflow version (1.10 → 2.0)", () => {
			const result = incrementer.normalize("1.10");
			expect(result).toBe("2.0");
		});

		it("should normalize overflow version (1.15 → 2.5)", () => {
			const result = incrementer.normalize("1.15");
			expect(result).toBe("2.5");
		});

		it("should normalize overflow version (2.20 → 4.0)", () => {
			const result = incrementer.normalize("2.20");
			expect(result).toBe("4.0");
		});

		it("should remove version prefix (v1.0 → 1.0)", () => {
			const result = incrementer.normalize("v1.0");
			expect(result).toBe("1.0");
		});

		it("should remove version prefix (V2.5 → 2.5)", () => {
			const result = incrementer.normalize("V2.5");
			expect(result).toBe("2.5");
		});

		it("should default invalid version to 1.0 (abc → 1.0)", () => {
			const result = incrementer.normalize("abc");
			expect(result).toBe("1.0");
		});

		it("should default empty string to 1.0", () => {
			const result = incrementer.normalize("");
			expect(result).toBe("1.0");
		});

		it("should preserve valid version (1.5 → 1.5)", () => {
			const result = incrementer.normalize("1.5");
			expect(result).toBe("1.5");
		});

		it("should handle three-part version by taking first two (1.2.3 → 1.2)", () => {
			const result = incrementer.normalize("1.2.3");
			expect(result).toBe("1.2");
		});
	});
});
