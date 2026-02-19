/**
 * Unit Tests for KnownAgentDetector (T075)
 *
 * TDD: tests written BEFORE implementation. All tests should FAIL initially.
 *
 * @see src/features/hooks/services/known-agent-detector.ts
 * @feature 001-hooks-refactor Phase 8
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock node:child_process and node:os
// ---------------------------------------------------------------------------

const { mockExecFile } = vi.hoisted(() => ({
	mockExecFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	default: { execFile: mockExecFile },
	execFile: mockExecFile,
}));

// Keep the real platform() behaviour but allow tests to inspect $SHELL
// (process.env is not mocked globally — individual tests override as needed)

import { KnownAgentDetector } from "../../../../../src/features/hooks/services/known-agent-detector";
import type { InstallCheckStrategy } from "../../../../../src/features/hooks/services/known-agent-catalog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNpmListOutput(packageName: string, version = "1.0.0"): string {
	return JSON.stringify({
		dependencies: {
			[packageName]: { version },
		},
	});
}

function resolveWith(stdout: string): void {
	mockExecFile.mockImplementation(
		(
			_cmd: string,
			_args: string[],
			_opts: unknown,
			callback: (err: null, out: string, stderr: string) => void
		) => {
			callback(null, stdout, "");
		}
	);
}

function rejectWith(error: Error): void {
	mockExecFile.mockImplementation(
		(
			_cmd: string,
			_args: string[],
			_opts: unknown,
			callback: (err: Error, stdout: string, stderr: string) => void
		) => {
			callback(error, "", "");
		}
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KnownAgentDetector", () => {
	let detector: KnownAgentDetector;

	beforeEach(() => {
		detector = new KnownAgentDetector();
		vi.clearAllMocks();
	});

	describe("isInstalledAny()", () => {
		it("returns true when the first strategy succeeds", async () => {
			resolveWith("/usr/local/bin/opencode\n");
			const result = await detector.isInstalledAny([
				{ strategy: "path", target: "opencode" },
				{ strategy: "npm-global", target: "@google/gemini-cli" },
			]);
			expect(result).toBe(true);
			// Should stop after first success — only 1 execFile call
			expect(mockExecFile).toHaveBeenCalledTimes(1);
		});

		it("returns true when only the second strategy succeeds", async () => {
			let callCount = 0;
			mockExecFile.mockImplementation(
				(
					_cmd: string,
					_args: string[],
					_opts: unknown,
					callback: (err: Error | null, stdout: string, stderr: string) => void
				) => {
					callCount += 1;
					if (callCount === 1) {
						callback(new Error("not found"), "", "");
					} else {
						callback(null, "/home/user/.bun/bin/gemini\n", "");
					}
				}
			);
			const result = await detector.isInstalledAny([
				{ strategy: "path", target: "opencode" },
				{ strategy: "path", target: "gemini" },
			]);
			expect(result).toBe(true);
		});

		it("returns false when all strategies fail", async () => {
			rejectWith(new Error("not found"));
			const result = await detector.isInstalledAny([
				{ strategy: "path", target: "opencode" },
				{ strategy: "path", target: "gemini" },
			]);
			expect(result).toBe(false);
		});

		it("returns false for empty strategies array", async () => {
			const result = await detector.isInstalledAny([]);
			expect(result).toBe(false);
			expect(mockExecFile).not.toHaveBeenCalled();
		});

		it("never throws even when all strategies throw", async () => {
			mockExecFile.mockImplementation(() => {
				throw new Error("unexpected");
			});
			await expect(
				detector.isInstalledAny([{ strategy: "path", target: "opencode" }])
			).resolves.toBe(false);
		});
	});

	describe("isInstalled()", () => {
		describe("npm-global strategy", () => {
			const strategy: InstallCheckStrategy = {
				strategy: "npm-global",
				target: "@google/gemini-cli",
			};

			it("returns true when the package is listed in npm global", async () => {
				resolveWith(makeNpmListOutput("@google/gemini-cli"));
				const result = await detector.isInstalled(strategy);
				expect(result).toBe(true);
			});

			it("returns false when the package is not in npm global output", async () => {
				resolveWith(JSON.stringify({ dependencies: {} }));
				const result = await detector.isInstalled(strategy);
				expect(result).toBe(false);
			});

			it("returns false when npm list exits with error (package not installed)", async () => {
				rejectWith(new Error("npm error"));
				const result = await detector.isInstalled(strategy);
				expect(result).toBe(false);
			});

			it("returns false when npm list output is malformed JSON", async () => {
				resolveWith("not valid json {{{");
				const result = await detector.isInstalled(strategy);
				expect(result).toBe(false);
			});

			it("calls npm with correct arguments for global list", async () => {
				resolveWith(makeNpmListOutput("@google/gemini-cli"));
				await detector.isInstalled(strategy);
				expect(mockExecFile).toHaveBeenCalledWith(
					"npm",
					["list", "-g", "@google/gemini-cli", "--depth=0", "--json"],
					expect.anything(),
					expect.any(Function)
				);
			});
		});

		describe("path strategy", () => {
			const strategy: InstallCheckStrategy = {
				strategy: "path",
				target: "opencode",
			};

			it("returns true when which/where resolves successfully", async () => {
				resolveWith("/usr/local/bin/opencode\n");
				const result = await detector.isInstalled(strategy);
				expect(result).toBe(true);
			});

			it("returns false when which/where exits with error (not on PATH)", async () => {
				rejectWith(new Error("not found"));
				const result = await detector.isInstalled(strategy);
				expect(result).toBe(false);
			});

			it("returns false when which/where returns empty output", async () => {
				resolveWith("");
				const result = await detector.isInstalled(strategy);
				expect(result).toBe(false);
			});

			it("on Unix uses the user login shell (-l -c) with command -v to resolve the binary", async () => {
				// Skip on Windows — the shell-based path is only used on Unix
				if (process.platform === "win32") {
					return;
				}
				vi.stubEnv("SHELL", "/bin/zsh");
				resolveWith("/usr/local/bin/opencode");
				await detector.isInstalled(strategy);
				vi.unstubAllEnvs();

				const [cmd, args] = mockExecFile.mock.calls[0] as [string, string[]];
				expect(cmd).toBe("/bin/zsh");
				expect(args).toEqual(["-l", "-c", "command -v opencode"]);
			});

			it("falls back to /bin/sh when $SHELL is not set", async () => {
				if (process.platform === "win32") {
					return;
				}
				// vi.stubEnv properly removes the key (unlike assigning undefined)
				vi.stubEnv("SHELL", "");
				resolveWith("/usr/local/bin/opencode");
				await detector.isInstalled(strategy);
				vi.unstubAllEnvs();

				const [cmd] = mockExecFile.mock.calls[0] as [string, string[]];
				expect(cmd).toBe("/bin/sh");
			});
		});

		describe("never throws", () => {
			it("returns false instead of throwing for unexpected errors", async () => {
				mockExecFile.mockImplementation(() => {
					throw new Error("unexpected synchronous throw");
				});
				const strategy: InstallCheckStrategy = {
					strategy: "path",
					target: "opencode",
				};
				await expect(detector.isInstalled(strategy)).resolves.toBe(false);
			});
		});
	});

	describe("internal result cache", () => {
		it("returns cached result on second isInstalledAny call without re-running subprocess", async () => {
			resolveWith("/usr/local/bin/opencode\n");
			const strategies: InstallCheckStrategy[] = [
				{ strategy: "path", target: "opencode" },
			];

			const first = await detector.isInstalledAny(strategies);
			expect(first).toBe(true);
			expect(mockExecFile).toHaveBeenCalledTimes(1);

			// Second call must NOT spawn another subprocess
			vi.clearAllMocks();
			const second = await detector.isInstalledAny(strategies);
			expect(second).toBe(true);
			expect(mockExecFile).not.toHaveBeenCalled();
		});

		it("caches negative results (not-found) too", async () => {
			rejectWith(new Error("not found"));
			const strategies: InstallCheckStrategy[] = [
				{ strategy: "path", target: "nonexistent-tool" },
			];

			const first = await detector.isInstalledAny(strategies);
			expect(first).toBe(false);
			expect(mockExecFile).toHaveBeenCalledTimes(1);

			vi.clearAllMocks();
			const second = await detector.isInstalledAny(strategies);
			expect(second).toBe(false);
			expect(mockExecFile).not.toHaveBeenCalled();
		});

		it("uses the first strategy target as cache key so different targets get separate cache entries", async () => {
			resolveWith("/usr/local/bin/opencode\n");
			await detector.isInstalledAny([{ strategy: "path", target: "opencode" }]);

			rejectWith(new Error("not found"));
			const result = await detector.isInstalledAny([
				{ strategy: "path", target: "gemini" },
			]);
			// gemini was not cached — the mock returns false for this new call
			expect(result).toBe(false);
		});
	});

	describe("preloadAll()", () => {
		const catalogEntries: KnownAgentEntry[] = [
			{
				id: "opencode",
				displayName: "OpenCode",
				agentCommand: "opencode acp",
				installChecks: [{ strategy: "path", target: "opencode" }],
			},
			{
				id: "gemini",
				displayName: "Gemini CLI",
				agentCommand: "npx @google/gemini-cli --experimental-acp",
				installChecks: [
					{ strategy: "path", target: "gemini" },
					{ strategy: "npm-global", target: "@google/gemini-cli" },
				],
			},
		];

		it("runs isInstalledAny for every catalog entry and warms the cache", async () => {
			resolveWith("/usr/local/bin/opencode\n");
			await detector.preloadAll(catalogEntries);

			// Cache is warm — no further subprocess should fire
			vi.clearAllMocks();
			const result = await detector.isInstalledAny(
				catalogEntries[0].installChecks
			);
			expect(result).toBe(true);
			expect(mockExecFile).not.toHaveBeenCalled();
		});

		it("preloadAll resolves even when some agents are not installed", async () => {
			let callCount = 0;
			mockExecFile.mockImplementation(
				(
					_cmd: string,
					_args: string[],
					_opts: unknown,
					callback: (err: Error | null, stdout: string, stderr: string) => void
				) => {
					callCount += 1;
					if (callCount === 1) {
						// opencode found
						callback(null, "/usr/local/bin/opencode\n", "");
					} else {
						// gemini not found
						callback(new Error("not found"), "", "");
					}
				}
			);

			await expect(detector.preloadAll(catalogEntries)).resolves.not.toThrow();

			vi.clearAllMocks();
			const opencode = await detector.isInstalledAny(
				catalogEntries[0].installChecks
			);
			const gemini = await detector.isInstalledAny(
				catalogEntries[1].installChecks
			);
			expect(opencode).toBe(true);
			expect(gemini).toBe(false);
			// Both served from cache
			expect(mockExecFile).not.toHaveBeenCalled();
		});

		it("never throws even when all subprocess calls fail", async () => {
			mockExecFile.mockImplementation(() => {
				throw new Error("unexpected");
			});
			await expect(detector.preloadAll(catalogEntries)).resolves.not.toThrow();
		});
	});
});
