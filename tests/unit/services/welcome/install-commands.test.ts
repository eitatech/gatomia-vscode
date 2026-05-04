/**
 * Unit tests for the Welcome Screen install-commands module.
 *
 * The module is responsible for producing the ordered, platform-aware
 * install queue used by the "Install Missing Dependencies" button. These
 * tests lock down the contract so that:
 *
 * - Each dependency produces the expected canonical install step.
 * - Transitive prerequisites (Node.js, Python, UV) are prepended as needed.
 * - Prerequisite and dependency steps are deduplicated by `id`.
 * - The order of the input `missing` list is preserved.
 * - Platform-specific fallbacks (e.g. Devin on Windows) are honoured.
 */

import { describe, it, expect } from "vitest";
import {
	getInstallPlan,
	getPrerequisiteInstallStep,
	resolveMissingWithPrereqs,
	type Platform,
} from "../../../../src/services/welcome/install-commands";
import type {
	InstallableDependency,
	SystemPrerequisiteKey,
} from "../../../../src/types/welcome";

const stepIds = (steps: ReadonlyArray<{ id: string }>): string[] =>
	steps.map((step) => step.id);

describe("getInstallPlan", () => {
	it("returns a vscode-command step for Copilot Chat", () => {
		const steps = getInstallPlan("copilot-chat", "darwin");

		expect(steps).toHaveLength(1);
		const [first] = steps;
		expect(first.id).toBe("copilot-chat");
		expect(first.kind).toBe("vscode-command");
		expect(first.vscodeCommand).toBe("workbench.extensions.installExtension");
		expect(first.vscodeArgs).toEqual(["github.copilot-chat"]);
	});

	it("returns an npm install for Copilot CLI", () => {
		const steps = getInstallPlan("copilot-cli", "darwin");

		expect(steps).toHaveLength(1);
		const [first] = steps;
		expect(first.id).toBe("copilot-cli");
		expect(first.kind).toBe("terminal");
		expect(first.command).toBe("npm install -g @github/copilot");
	});

	it("returns a uv tool install for SpecKit", () => {
		const steps = getInstallPlan("speckit", "darwin");

		expect(steps).toHaveLength(1);
		const [first] = steps;
		expect(first.id).toBe("speckit");
		expect(first.kind).toBe("terminal");
		expect(first.command).toContain("uv tool install specify-cli");
		expect(first.command).toContain("spec-kit.git");
	});

	it("returns an npm install for OpenSpec", () => {
		const steps = getInstallPlan("openspec", "darwin");

		expect(steps).toHaveLength(1);
		const [first] = steps;
		expect(first.id).toBe("openspec");
		expect(first.kind).toBe("terminal");
		expect(first.command).toBe("npm install -g @fission-ai/openspec@latest");
	});

	it("returns a uv tool install for GatomIA CLI", () => {
		const steps = getInstallPlan("gatomia-cli", "darwin");

		expect(steps).toHaveLength(1);
		const [first] = steps;
		expect(first.id).toBe("gatomia-cli");
		expect(first.kind).toBe("terminal");
		expect(first.command).toContain("uv tool install gatomia");
		expect(first.command).toContain("gatomia-cli.git");
	});

	it("returns an npm install for Gemini CLI", () => {
		const steps = getInstallPlan("gemini-cli", "darwin");

		expect(steps).toHaveLength(1);
		const [first] = steps;
		expect(first.id).toBe("gemini-cli");
		expect(first.kind).toBe("terminal");
		expect(first.command).toBe("npm install -g @google/gemini-cli");
	});

	describe("Devin CLI", () => {
		it("returns the canonical shell installer on macOS", () => {
			const steps = getInstallPlan("devin-cli", "darwin");

			expect(steps).toHaveLength(1);
			const [first] = steps;
			expect(first.id).toBe("devin-cli");
			expect(first.kind).toBe("terminal");
			expect(first.command).toContain("install.devin.ai");
		});

		it("returns the canonical shell installer on Linux", () => {
			const steps = getInstallPlan("devin-cli", "linux");

			expect(steps).toHaveLength(1);
			const [first] = steps;
			expect(first.kind).toBe("terminal");
			expect(first.command).toContain("install.devin.ai");
		});

		it("falls back to opening the install URL on Windows", () => {
			const steps = getInstallPlan("devin-cli", "win32");

			expect(steps).toHaveLength(1);
			const [first] = steps;
			expect(first.id).toBe("devin-cli");
			expect(first.kind).toBe("open-url");
			expect(first.url).toBe("https://cli.devin.ai/docs/installation");
		});
	});
});

describe("getPrerequisiteInstallStep", () => {
	it.each<SystemPrerequisiteKey>([
		"node",
		"python",
		"uv",
	])("returns a terminal install step for %s", (key) => {
		const step = getPrerequisiteInstallStep(key, "darwin");

		expect(step.id).toBe(key);
		expect(step.kind).toBe("terminal");
		expect(step.command).toBeTruthy();
	});

	it.each<Platform>([
		"darwin",
		"linux",
		"win32",
	])("returns platform-specific commands for Node on %s", (platform) => {
		const step = getPrerequisiteInstallStep("node", platform);
		expect(step.command).toBeTruthy();
	});

	it("returns different commands per platform for uv", () => {
		const darwin = getPrerequisiteInstallStep("uv", "darwin");
		const win32 = getPrerequisiteInstallStep("uv", "win32");

		expect(darwin.command).not.toBe(win32.command);
	});
});

describe("resolveMissingWithPrereqs", () => {
	it("returns an empty queue when no dependencies are missing", () => {
		expect(resolveMissingWithPrereqs([], "darwin")).toEqual([]);
	});

	it("prepends Python and UV before a SpecKit install", () => {
		const steps = resolveMissingWithPrereqs(["speckit"], "darwin");
		expect(stepIds(steps)).toEqual(["python", "uv", "speckit"]);
	});

	it("prepends Node before an OpenSpec install", () => {
		const steps = resolveMissingWithPrereqs(["openspec"], "darwin");
		expect(stepIds(steps)).toEqual(["node", "openspec"]);
	});

	it("prepends Node before a Copilot CLI install", () => {
		const steps = resolveMissingWithPrereqs(["copilot-cli"], "darwin");
		expect(stepIds(steps)).toEqual(["node", "copilot-cli"]);
	});

	it("prepends Node before a Gemini CLI install", () => {
		const steps = resolveMissingWithPrereqs(["gemini-cli"], "darwin");
		expect(stepIds(steps)).toEqual(["node", "gemini-cli"]);
	});

	it("does not prepend prerequisites for Copilot Chat (vscode-command)", () => {
		const steps = resolveMissingWithPrereqs(["copilot-chat"], "darwin");
		expect(steps).toHaveLength(1);
		expect(stepIds(steps)).toEqual(["copilot-chat"]);
	});

	it("does not prepend prerequisites for Devin CLI", () => {
		const steps = resolveMissingWithPrereqs(["devin-cli"], "darwin");
		expect(steps).toHaveLength(1);
		expect(stepIds(steps)).toEqual(["devin-cli"]);
	});

	it("deduplicates shared prerequisites across multiple deps", () => {
		// openspec + copilot-cli both need Node; it must only appear once.
		const steps = resolveMissingWithPrereqs(
			["openspec", "copilot-cli"],
			"darwin"
		);
		const ids = stepIds(steps);

		expect(ids.filter((id) => id === "node")).toHaveLength(1);
		expect(ids).toEqual(["node", "openspec", "copilot-cli"]);
	});

	it("deduplicates shared prerequisites across SpecKit and GatomIA CLI", () => {
		const steps = resolveMissingWithPrereqs(
			["speckit", "gatomia-cli"],
			"darwin"
		);
		const ids = stepIds(steps);

		expect(ids.filter((id) => id === "python")).toHaveLength(1);
		expect(ids.filter((id) => id === "uv")).toHaveLength(1);
		expect(ids).toEqual(["python", "uv", "speckit", "gatomia-cli"]);
	});

	it("preserves the relative order of the input missing list", () => {
		const order: InstallableDependency[] = [
			"copilot-chat",
			"copilot-cli",
			"speckit",
			"gatomia-cli",
		];
		const steps = resolveMissingWithPrereqs(order, "darwin");
		const ids = stepIds(steps);

		// copilot-chat first (no prereqs), then node + copilot-cli,
		// then python + uv + speckit, then gatomia-cli (prereqs dedup'd).
		expect(ids).toEqual([
			"copilot-chat",
			"node",
			"copilot-cli",
			"python",
			"uv",
			"speckit",
			"gatomia-cli",
		]);
	});

	it("handles a Windsurf install queue (devin + speckit + gatomia-cli)", () => {
		const steps = resolveMissingWithPrereqs(
			["devin-cli", "speckit", "gatomia-cli"],
			"darwin"
		);

		expect(stepIds(steps)).toEqual([
			"devin-cli",
			"python",
			"uv",
			"speckit",
			"gatomia-cli",
		]);
	});

	it("handles an Antigravity install queue (gemini + speckit + gatomia-cli)", () => {
		const steps = resolveMissingWithPrereqs(
			["gemini-cli", "speckit", "gatomia-cli"],
			"linux"
		);

		expect(stepIds(steps)).toEqual([
			"node",
			"gemini-cli",
			"python",
			"uv",
			"speckit",
			"gatomia-cli",
		]);
	});

	it("returns platform-specific prerequisite commands", () => {
		const platforms: Platform[] = ["darwin", "linux", "win32"];

		for (const platform of platforms) {
			const steps = resolveMissingWithPrereqs(["speckit"], platform);
			const pythonStep = steps.find((step) => step.id === "python");
			const uvStep = steps.find((step) => step.id === "uv");

			expect(pythonStep).toBeDefined();
			expect(pythonStep?.command).toBeTruthy();
			expect(uvStep).toBeDefined();
			expect(uvStep?.command).toBeTruthy();
		}
	});
});
