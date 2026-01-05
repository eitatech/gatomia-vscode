import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { FileType, Uri, workspace } from "vscode";
import { ConfigManager } from "../utils/config-manager";
import { SPEC_SYSTEM_MODE } from "../constants";

vi.mock("os", () => ({
	default: {
		homedir: vi.fn(() => "/home/test"),
	},
	homedir: vi.fn(() => "/home/test"),
}));

vi.mock("fs", () => ({
	default: {
		existsSync: vi.fn(() => false),
	},
	existsSync: vi.fn(() => false),
}));

import { SteeringExplorerProvider } from "./steering-explorer-provider";

const INSTRUCTIONS_SUFFIX = ".instructions.md";

describe("SteeringExplorerProvider - instruction rules", () => {
	let provider: SteeringExplorerProvider;
	const context = {
		extensionUri: Uri.file("/fake/extension"),
	} as ExtensionContext;

	beforeEach(() => {
		vi.clearAllMocks();
		// biome-ignore lint/complexity/useLiteralKeys: accessing private test helper
		(ConfigManager as any)["instance"] = {
			getSettings: () => ({ specSystem: SPEC_SYSTEM_MODE.AUTO }),
		};

		vi.mocked(workspace.fs.readDirectory).mockReset();
		vi.mocked(workspace.fs.readDirectory).mockResolvedValue([] as any);

		provider = new SteeringExplorerProvider(context);
	});

	it("shows project + user instruction rules groups at the root", async () => {
		const rootItems = await provider.getChildren();
		const projectGroup = rootItems.find(
			(item) => item.contextValue === "project-instruction-rules-group"
		);
		const userGroup = rootItems.find(
			(item) => item.contextValue === "user-instructions-group"
		);

		expect(projectGroup?.label).toBe("Project Instructions");
		expect(userGroup?.label).toBe("User Instructions");
	});

	it("lists only *.instructions.md files for project rules", async () => {
		const projectRulesRoot = "/fake/workspace/.github/instructions";
		vi.mocked(workspace.fs.readDirectory).mockImplementation((uri) => {
			if (uri.fsPath === projectRulesRoot) {
				return Promise.resolve([
					["alpha.instructions.md", FileType.File],
					["beta.md", FileType.File],
					["nested", FileType.Directory],
				] as any);
			}
			return Promise.resolve([] as any);
		});

		const rootItems = await provider.getChildren();
		const projectGroup = rootItems.find(
			(item) => item.contextValue === "project-instruction-rules-group"
		);
		expect(projectGroup).toBeTruthy();

		const children = await provider.getChildren(projectGroup as any);
		expect(children.map((c) => c.label)).toEqual(["alpha"]);
		expect(children.every((c) => c.contextValue === "instruction-rule")).toBe(
			true
		);
	});

	it("lists only *.instructions.md files for user rules", async () => {
		const userRulesRoot = "/home/test/.github/instructions";
		vi.mocked(workspace.fs.readDirectory).mockImplementation((uri) => {
			if (uri.fsPath === userRulesRoot) {
				return Promise.resolve([
					["typescript.instructions.md", FileType.File],
					["readme.md", FileType.File],
				] as any);
			}
			return Promise.resolve([] as any);
		});

		const rootItems = await provider.getChildren();
		const userGroup = rootItems.find(
			(item) => item.contextValue === "user-instructions-group"
		);
		expect(userGroup).toBeTruthy();

		const children = await provider.getChildren(userGroup as any);
		const ruleItems = children.filter(
			(c) => c.contextValue === "instruction-rule"
		);
		expect(ruleItems.map((c) => c.label)).toEqual(["typescript"]);
	});

	it("instruction rule items open the underlying file", async () => {
		const projectRulesRoot = "/fake/workspace/.github/instructions";
		vi.mocked(workspace.fs.readDirectory).mockImplementation((uri) => {
			if (uri.fsPath === projectRulesRoot) {
				return Promise.resolve([
					["alpha.instructions.md", FileType.File],
				] as any);
			}
			return Promise.resolve([] as any);
		});

		const rootItems = await provider.getChildren();
		const projectGroup = rootItems.find(
			(item) => item.contextValue === "project-instruction-rules-group"
		);
		const children = await provider.getChildren(projectGroup as any);
		const childItem = children[0];

		expect(childItem.command?.command).toBe("vscode.open");
		expect((childItem.command?.arguments as any[])?.[0]?.fsPath).toBe(
			`${projectRulesRoot}/alpha${INSTRUCTIONS_SUFFIX}`
		);
	});
});
