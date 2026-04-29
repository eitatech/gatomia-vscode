/**
 * Unit tests for the Welcome Screen requirement profile module.
 *
 * The profile is the single source of truth for which dependencies are
 * required/optional/hidden on each IDE host, and which ones are still
 * missing given a dependency snapshot.
 */

import { describe, it, expect } from "vitest";
import { computeRequirementProfile } from "../../../../src/services/welcome/requirements";
import type { DependencyStatus } from "../../../../src/types/welcome";
import type { IdeHost } from "../../../../src/utils/ide-host-detector";

const baseDeps = (
	overrides: Partial<DependencyStatus> = {}
): DependencyStatus => ({
	copilotChat: { installed: false, active: false, version: null },
	copilotCli: { installed: false, version: null },
	speckit: { installed: false, version: null },
	openspec: { installed: false, version: null },
	gatomiaCli: { installed: false, version: null },
	devinCli: {
		installed: false,
		version: null,
		authenticated: false,
		acpSupported: false,
	},
	geminiCli: {
		installed: false,
		version: null,
		authenticated: false,
		acpSupported: false,
	},
	lastChecked: 0,
	...overrides,
});

describe("computeRequirementProfile", () => {
	describe("required/optional/hidden per IDE host", () => {
		it("marks Devin required, Copilot CLI optional, and Copilot Chat + Gemini hidden on Windsurf", () => {
			const profile = computeRequirementProfile("windsurf", baseDeps());

			expect(profile.required).toEqual([
				"devin-cli",
				"speckit",
				"openspec",
				"gatomia-cli",
			]);
			expect(profile.optional).toEqual(["copilot-cli"]);
			expect(profile.hidden).toEqual(["copilot-chat", "gemini-cli"]);
		});

		it("marks Gemini required, Copilot CLI optional, and Copilot Chat + Devin hidden on Antigravity", () => {
			const profile = computeRequirementProfile("antigravity", baseDeps());

			expect(profile.required).toEqual([
				"gemini-cli",
				"speckit",
				"openspec",
				"gatomia-cli",
			]);
			expect(profile.optional).toEqual(["copilot-cli"]);
			expect(profile.hidden).toEqual(["copilot-chat", "devin-cli"]);
		});

		it.each<IdeHost>([
			"vscode",
			"vscode-insiders",
			"cursor",
			"vscodium",
			"positron",
			"unknown",
		])("requires Copilot Chat + CLI and hides Devin/Gemini on %s", (host) => {
			const profile = computeRequirementProfile(host, baseDeps());

			expect(profile.required).toEqual([
				"copilot-chat",
				"copilot-cli",
				"speckit",
				"openspec",
				"gatomia-cli",
			]);
			expect(profile.optional).toEqual([]);
			expect(profile.hidden).toEqual(["devin-cli", "gemini-cli"]);
		});
	});

	describe("specSystemReady", () => {
		it("is false when neither SpecKit nor OpenSpec is installed", () => {
			const profile = computeRequirementProfile("vscode", baseDeps());
			expect(profile.specSystemReady).toBe(false);
		});

		it("is true when only SpecKit is installed", () => {
			const profile = computeRequirementProfile(
				"vscode",
				baseDeps({ speckit: { installed: true, version: "0.1.0" } })
			);
			expect(profile.specSystemReady).toBe(true);
		});

		it("is true when only OpenSpec is installed", () => {
			const profile = computeRequirementProfile(
				"vscode",
				baseDeps({ openspec: { installed: true, version: "0.1.0" } })
			);
			expect(profile.specSystemReady).toBe(true);
		});
	});

	describe("missing ordering on VS Code", () => {
		it("returns all required deps with Copilot first and gatomia-cli last", () => {
			const profile = computeRequirementProfile("vscode", baseDeps());

			expect(profile.missing).toEqual([
				"copilot-chat",
				"copilot-cli",
				"speckit",
				"gatomia-cli",
			]);
		});

		it("omits SpecKit from missing when OpenSpec is installed", () => {
			const profile = computeRequirementProfile(
				"vscode",
				baseDeps({ openspec: { installed: true, version: "1.0.0" } })
			);

			expect(profile.missing).toEqual([
				"copilot-chat",
				"copilot-cli",
				"gatomia-cli",
			]);
		});

		it("omits Copilot entries when already installed", () => {
			const profile = computeRequirementProfile(
				"vscode",
				baseDeps({
					copilotChat: { installed: true, active: true, version: "1.0.0" },
					copilotCli: { installed: true, version: "1.0.0" },
				})
			);

			expect(profile.missing).toEqual(["speckit", "gatomia-cli"]);
		});

		it("returns empty missing when everything required is installed", () => {
			const profile = computeRequirementProfile(
				"vscode",
				baseDeps({
					copilotChat: { installed: true, active: true, version: "1.0.0" },
					copilotCli: { installed: true, version: "1.0.0" },
					speckit: { installed: true, version: "1.0.0" },
					gatomiaCli: { installed: true, version: "1.0.0" },
				})
			);

			expect(profile.missing).toEqual([]);
			expect(profile.specSystemReady).toBe(true);
		});
	});

	describe("missing ordering on Windsurf", () => {
		it("puts Devin CLI before the spec system and gatomia-cli", () => {
			const profile = computeRequirementProfile("windsurf", baseDeps());

			expect(profile.missing).toEqual(["devin-cli", "speckit", "gatomia-cli"]);
		});

		it("omits Devin CLI from missing when already installed", () => {
			const profile = computeRequirementProfile(
				"windsurf",
				baseDeps({
					devinCli: {
						installed: true,
						version: "1.0.0",
						authenticated: true,
						acpSupported: true,
					},
				})
			);

			expect(profile.missing).toEqual(["speckit", "gatomia-cli"]);
		});

		it("does not include the optional Copilot CLI dep in missing even when not installed", () => {
			const profile = computeRequirementProfile("windsurf", baseDeps());
			expect(profile.missing).not.toContain("copilot-cli");
		});

		it("never includes hidden Copilot Chat in missing or optional on Windsurf", () => {
			const profile = computeRequirementProfile("windsurf", baseDeps());
			expect(profile.hidden).toContain("copilot-chat");
			expect(profile.optional).not.toContain("copilot-chat");
			expect(profile.required).not.toContain("copilot-chat");
			expect(profile.missing).not.toContain("copilot-chat");
		});
	});

	describe("missing ordering on Antigravity", () => {
		it("puts Gemini CLI before the spec system and gatomia-cli", () => {
			const profile = computeRequirementProfile("antigravity", baseDeps());

			expect(profile.missing).toEqual(["gemini-cli", "speckit", "gatomia-cli"]);
		});

		it("omits Gemini CLI from missing when already installed", () => {
			const profile = computeRequirementProfile(
				"antigravity",
				baseDeps({
					geminiCli: {
						installed: true,
						version: "1.0.0",
						authenticated: true,
						acpSupported: true,
					},
				})
			);

			expect(profile.missing).toEqual(["speckit", "gatomia-cli"]);
		});

		it("never includes hidden Copilot Chat in missing or optional on Antigravity", () => {
			const profile = computeRequirementProfile("antigravity", baseDeps());
			expect(profile.hidden).toContain("copilot-chat");
			expect(profile.optional).not.toContain("copilot-chat");
			expect(profile.required).not.toContain("copilot-chat");
			expect(profile.missing).not.toContain("copilot-chat");
		});
	});

	describe("missing never includes hidden dependencies", () => {
		it("never returns Gemini CLI or Copilot Chat as missing on Windsurf", () => {
			const profile = computeRequirementProfile("windsurf", baseDeps());
			expect(profile.missing).not.toContain("gemini-cli");
			expect(profile.missing).not.toContain("copilot-chat");
		});

		it("never returns Devin CLI or Copilot Chat as missing on Antigravity", () => {
			const profile = computeRequirementProfile("antigravity", baseDeps());
			expect(profile.missing).not.toContain("devin-cli");
			expect(profile.missing).not.toContain("copilot-chat");
		});

		it("never returns Devin or Gemini as missing on vanilla VS Code", () => {
			const profile = computeRequirementProfile("vscode", baseDeps());
			expect(profile.missing).not.toContain("devin-cli");
			expect(profile.missing).not.toContain("gemini-cli");
		});
	});
});
