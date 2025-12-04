import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync, readdirSync, statSync, type Stats } from "fs";
import {
	parseSpecKitDirectoryName,
	convertSlugToName,
	convertNameToSlug,
	formatFeatureNumber,
	createFeatureDirectoryName,
	isSpecKitFeatureDirectory,
	getConstitutionPath,
	getMemoryPath,
	getTemplatesPath,
	getScriptsPath,
	getSpecsPath,
	extractFeatureNameFromPath,
	extractFeatureNumberFromPath,
	isInSpecKitFeatureDirectory,
	detectAvailableSpecSystems,
	detectActiveSpecSystem,
	discoverSpecKitFeatures,
	generateNextFeatureNumber,
	validateSpecKitStructure,
} from "./spec-kit-utilities";
import { SPEC_SYSTEM_MODE } from "../constants";

// Mock fs module
vi.mock("fs", () => ({
	existsSync: vi.fn(),
	readdirSync: vi.fn(),
	statSync: vi.fn(),
}));

describe("spec-kit-utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("parseSpecKitDirectoryName", () => {
		it("should parse valid numbered directory names", () => {
			const result = parseSpecKitDirectoryName("001-user-auth");
			expect(result).toEqual({
				number: 1,
				name: "User Auth",
				slug: "001-user-auth",
				path: "001-user-auth",
			});
		});

		it("should parse directory with larger numbers", () => {
			const result = parseSpecKitDirectoryName("042-payment-integration");
			expect(result).toEqual({
				number: 42,
				name: "Payment Integration",
				slug: "042-payment-integration",
				path: "042-payment-integration",
			});
		});

		it("should return null for invalid directory names", () => {
			expect(parseSpecKitDirectoryName("user-auth")).toBeNull();
			expect(parseSpecKitDirectoryName("01-short")).toBeNull();
			expect(parseSpecKitDirectoryName("invalid")).toBeNull();
		});
	});

	describe("convertSlugToName", () => {
		it("should convert slug to human-readable name", () => {
			expect(convertSlugToName("user-auth")).toBe("User Auth");
			expect(convertSlugToName("payment-integration")).toBe(
				"Payment Integration"
			);
			expect(convertSlugToName("api")).toBe("Api");
		});
	});

	describe("convertNameToSlug", () => {
		it("should convert name to slug", () => {
			expect(convertNameToSlug("User Auth")).toBe("user-auth");
			expect(convertNameToSlug("Payment Integration")).toBe(
				"payment-integration"
			);
			expect(convertNameToSlug("API")).toBe("api");
		});

		it("should remove invalid characters", () => {
			expect(convertNameToSlug("User Auth!@#")).toBe("user-auth");
			expect(convertNameToSlug("Test (Feature)")).toBe("test-feature");
		});
	});

	describe("formatFeatureNumber", () => {
		it("should format numbers with leading zeros", () => {
			expect(formatFeatureNumber(1)).toBe("001");
			expect(formatFeatureNumber(42)).toBe("042");
			expect(formatFeatureNumber(100)).toBe("100");
			expect(formatFeatureNumber(1000)).toBe("1000");
		});

		it("should respect custom padding", () => {
			expect(formatFeatureNumber(1, 4)).toBe("0001");
			expect(formatFeatureNumber(42, 5)).toBe("00042");
		});
	});

	describe("createFeatureDirectoryName", () => {
		it("should create properly formatted directory names", () => {
			expect(createFeatureDirectoryName(1, "User Auth")).toBe("001-user-auth");
			expect(createFeatureDirectoryName(42, "Payment Integration")).toBe(
				"042-payment-integration"
			);
		});
	});

	describe("isSpecKitFeatureDirectory", () => {
		it("should return true for valid feature directories", () => {
			expect(isSpecKitFeatureDirectory("001-user-auth")).toBe(true);
			expect(isSpecKitFeatureDirectory("042-payment")).toBe(true);
			expect(isSpecKitFeatureDirectory("100-feature-name")).toBe(true);
		});

		it("should return false for invalid directory names", () => {
			expect(isSpecKitFeatureDirectory("user-auth")).toBe(false);
			expect(isSpecKitFeatureDirectory("01-short")).toBe(false);
			expect(isSpecKitFeatureDirectory("invalid")).toBe(false);
			expect(isSpecKitFeatureDirectory("001-")).toBe(false);
		});
	});

	describe("path utility functions", () => {
		it("should return correct constitution path", () => {
			expect(getConstitutionPath("/workspace")).toBe(
				"/workspace/.specify/memory/constitution.md"
			);
		});

		it("should return correct memory path", () => {
			expect(getMemoryPath("/workspace")).toBe("/workspace/.specify/memory");
		});

		it("should return correct templates path", () => {
			expect(getTemplatesPath("/workspace")).toBe(
				"/workspace/.specify/templates"
			);
		});

		it("should return correct scripts path", () => {
			expect(getScriptsPath("/workspace")).toBe("/workspace/.specify/scripts");
		});

		it("should return correct specs path", () => {
			expect(getSpecsPath("/workspace")).toBe("/workspace/specs");
		});
	});

	describe("extractFeatureNameFromPath", () => {
		it("should extract feature name from path", () => {
			expect(extractFeatureNameFromPath("/workspace/specs/001-user-auth")).toBe(
				"User Auth"
			);
			expect(
				extractFeatureNameFromPath("/workspace/specs/042-payment-integration")
			).toBe("Payment Integration");
		});

		it("should return directory name if not a valid feature directory", () => {
			expect(extractFeatureNameFromPath("/workspace/specs/invalid")).toBe(
				"invalid"
			);
		});
	});

	describe("extractFeatureNumberFromPath", () => {
		it("should extract feature number from path", () => {
			expect(
				extractFeatureNumberFromPath("/workspace/specs/001-user-auth")
			).toBe(1);
			expect(
				extractFeatureNumberFromPath("/workspace/specs/042-payment-integration")
			).toBe(42);
		});

		it("should return null for invalid paths", () => {
			expect(
				extractFeatureNumberFromPath("/workspace/specs/invalid")
			).toBeNull();
		});
	});

	describe("isInSpecKitFeatureDirectory", () => {
		it("should return true for files in feature directories", () => {
			expect(
				isInSpecKitFeatureDirectory(
					"/workspace/specs/001-user-auth/spec.md",
					"/workspace/specs"
				)
			).toBe(true);
		});

		it("should return false for files outside feature directories", () => {
			expect(
				isInSpecKitFeatureDirectory(
					"/workspace/other/file.md",
					"/workspace/specs"
				)
			).toBe(false);
		});

		it("should handle Windows-style paths", () => {
			expect(
				isInSpecKitFeatureDirectory(
					"C:\\workspace\\specs\\001-feature\\spec.md",
					"C:\\workspace\\specs"
				)
			).toBe(true);
		});
	});

	describe("detectAvailableSpecSystems", () => {
		it("should detect Spec Kit when .specify and specs exist", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const pathStr = path.toString();
				return pathStr.includes(".specify") || pathStr.includes("specs");
			});

			const systems = detectAvailableSpecSystems("/workspace");
			expect(systems).toContain(SPEC_SYSTEM_MODE.SPECKIT);
		});

		it("should detect OpenSpec when openspec directory exists", () => {
			vi.mocked(existsSync).mockImplementation((path) =>
				path.toString().includes("openspec")
			);

			const systems = detectAvailableSpecSystems("/workspace");
			expect(systems).toContain(SPEC_SYSTEM_MODE.OPENSPEC);
		});

		it("should return empty array when no systems detected", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const systems = detectAvailableSpecSystems("/workspace");
			expect(systems).toEqual([]);
		});
	});

	describe("detectActiveSpecSystem", () => {
		it("should return SPECKIT when only Spec Kit exists", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const pathStr = path.toString();
				return pathStr.includes(".specify") || pathStr.includes("specs");
			});

			const system = detectActiveSpecSystem("/workspace");
			expect(system).toBe(SPEC_SYSTEM_MODE.SPECKIT);
		});

		it("should return OPENSPEC when only OpenSpec exists", () => {
			vi.mocked(existsSync).mockImplementation((path) =>
				path.toString().includes("openspec")
			);

			const system = detectActiveSpecSystem("/workspace");
			expect(system).toBe(SPEC_SYSTEM_MODE.OPENSPEC);
		});

		it("should prefer SPECKIT when both systems exist", () => {
			vi.mocked(existsSync).mockReturnValue(true);

			const system = detectActiveSpecSystem("/workspace");
			expect(system).toBe(SPEC_SYSTEM_MODE.SPECKIT);
		});

		it("should return AUTO when no systems detected", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const system = detectActiveSpecSystem("/workspace");
			expect(system).toBe(SPEC_SYSTEM_MODE.AUTO);
		});
	});

	describe("discoverSpecKitFeatures", () => {
		it("should discover feature directories", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue([
				"001-user-auth",
				"002-payment",
				"invalid-dir",
			] as unknown as ReturnType<typeof readdirSync>);
			vi.mocked(statSync).mockReturnValue({
				isDirectory: () => true,
			} as Stats);

			const features = discoverSpecKitFeatures("/workspace/specs");

			expect(features).toHaveLength(2);
			expect(features[0].number).toBe(1);
			expect(features[1].number).toBe(2);
		});

		it("should return empty array when specs path doesn't exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const features = discoverSpecKitFeatures("/workspace/specs");
			expect(features).toEqual([]);
		});

		it("should sort features by number", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue([
				"003-third",
				"001-first",
				"002-second",
			] as unknown as ReturnType<typeof readdirSync>);
			vi.mocked(statSync).mockReturnValue({
				isDirectory: () => true,
			} as Stats);

			const features = discoverSpecKitFeatures("/workspace/specs");

			expect(features[0].number).toBe(1);
			expect(features[1].number).toBe(2);
			expect(features[2].number).toBe(3);
		});
	});

	describe("generateNextFeatureNumber", () => {
		it("should return 1 when no features exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const nextNumber = generateNextFeatureNumber("/workspace/specs");
			expect(nextNumber).toBe(1);
		});

		it("should return next sequential number", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue([
				"001-first",
				"002-second",
			] as unknown as ReturnType<typeof readdirSync>);
			vi.mocked(statSync).mockReturnValue({
				isDirectory: () => true,
			} as Stats);

			const nextNumber = generateNextFeatureNumber("/workspace/specs");
			expect(nextNumber).toBe(3);
		});
	});

	describe("validateSpecKitStructure", () => {
		it("should return valid when all required directories exist", () => {
			vi.mocked(existsSync).mockReturnValue(true);

			const result = validateSpecKitStructure("/workspace");

			expect(result.isValid).toBe(true);
			expect(result.missingDirectories).toEqual([]);
		});

		it("should report missing directories", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = validateSpecKitStructure("/workspace");

			expect(result.isValid).toBe(false);
			expect(result.missingDirectories).toContain("specs");
			expect(result.missingDirectories).toContain(".specify");
		});

		it("should warn about missing constitution.md", () => {
			vi.mocked(existsSync).mockImplementation(
				(path) => !path.toString().includes("constitution.md")
			);

			const result = validateSpecKitStructure("/workspace");

			expect(result.missingFiles).toContain(".specify/memory/constitution.md");
			expect(result.warnings.length).toBeGreaterThan(0);
		});
	});
});
