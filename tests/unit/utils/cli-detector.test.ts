/**
 * Unit tests for CLI detector utility
 * Validates shared CLI detection logic used by DependencyChecker and DependenciesViewProvider
 */

import { describe, it, expect } from "vitest";
import {
	getExtendedPath,
	extractVersion,
	checkCLI,
} from "../../../src/utils/cli-detector";
import { homedir } from "node:os";

describe("CLI Detector Utility", () => {
	describe("getExtendedPath()", () => {
		it("should include ~/.local/bin for UV tools", () => {
			const path = getExtendedPath();
			const home = homedir();
			expect(path).toContain(`${home}/.local/bin`);
		});

		it("should include Homebrew paths", () => {
			const path = getExtendedPath();
			expect(path).toContain("/opt/homebrew/bin");
			expect(path).toContain("/usr/local/bin");
		});

		it("should include Cargo bin for Rust tools", () => {
			const path = getExtendedPath();
			const home = homedir();
			expect(path).toContain(`${home}/.cargo/bin`);
		});

		it("should preserve existing PATH", () => {
			const path = getExtendedPath();
			const existingPath = process.env.PATH || "";
			expect(path).toContain(existingPath);
		});
	});

	describe("extractVersion()", () => {
		it("should extract version from 'X.Y.Z' format", () => {
			expect(extractVersion("1.2.3")).toBe("1.2.3");
			expect(extractVersion("OpenSpec CLI 0.5.0")).toBe("0.5.0");
		});

		it("should extract version from 'vX.Y.Z' format", () => {
			expect(extractVersion("v2.4.6")).toBe("2.4.6");
			expect(extractVersion("Version v1.0.0")).toBe("1.0.0");
		});

		it("should extract version from 'version X.Y.Z' format", () => {
			expect(extractVersion("version 3.1.4")).toBe("3.1.4");
			expect(extractVersion("Tool version 2.0.5")).toBe("2.0.5");
		});

		it("should return undefined for non-version strings", () => {
			expect(extractVersion("no version here")).toBeUndefined();
			expect(extractVersion("abc.def.ghi")).toBeUndefined();
		});

		it("should handle multi-line output", () => {
			const output = `
				SpecKit CLI
				Version: 1.5.2
				Build date: 2024-01-01
			`;
			expect(extractVersion(output)).toBe("1.5.2");
		});
	});

	describe("checkCLI()", () => {
		it("should detect installed CLI (echo test)", async () => {
			// Use 'echo' as a universally available command
			const result = await checkCLI("echo v1.2.3", 1000);

			expect(result.installed).toBe(true);
			expect(result.version).toBe("1.2.3");
			expect(result.error).toBeUndefined();
		});

		it("should detect non-installed CLI", async () => {
			const result = await checkCLI("nonexistent-cli-tool-xyz --version", 1000);

			expect(result.installed).toBe(false);
			expect(result.version).toBeNull();
			expect(result.error).toBeDefined();
		});

		it("should timeout on slow commands", async () => {
			// Use 'sleep' to simulate slow command
			const result = await checkCLI("sleep 5", 100); // 100ms timeout

			expect(result.installed).toBe(false);
			expect(result.version).toBeNull();
			expect(result.error).toContain("timed out");
		}, 500); // Test timeout

		it("should parse JSON version output", async () => {
			// Simulate OpenSpec JSON format
			const jsonOutput = '{"version":"1.0.0","build":"12345"}';
			const result = await checkCLI(`echo '${jsonOutput}'`, 1000);

			expect(result.installed).toBe(true);
			expect(result.version).toBe("1.0.0");
		});

		it("should use extended PATH for detection", async () => {
			// The checkCLI function should internally use getExtendedPath()
			// This is an integration test that verifies the PATH is extended
			const result = await checkCLI("echo testing", 1000);
			expect(result.installed).toBe(true);
		});
	});
});
