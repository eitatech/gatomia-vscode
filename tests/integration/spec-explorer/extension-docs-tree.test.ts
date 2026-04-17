/**
 * Integration tests for extension document display in the Spec Explorer tree.
 *
 * Verifies the full flow:
 * - Adapter discovers extra .md files and unknown subfolders
 * - Provider renders them as extension-document and extension-folder nodes
 * - Known files/folders are not duplicated
 * - Ordering: known docs -> extra docs (sorted) -> extra folders (sorted)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

vi.mock("vscode", async () => {
	const actual =
		await vi.importActual<typeof import("vscode")>("vscode");
	return {
		...actual,
		workspace: {
			...actual.workspace,
			workspaceFolders: [{ uri: { fsPath: "/fake/workspace" } }],
			asRelativePath: vi.fn((p: string) => p),
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(),
				onDidChange: vi.fn(),
				onDidDelete: vi.fn(),
				dispose: vi.fn(),
			})),
		},
	};
});

vi.mock("../../../src/features/spec/review-flow/state", () => ({
	getSpecState: vi.fn(),
	onReviewFlowStateChange: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("../../../src/utils/spec-kit-adapter", () => ({
	getSpecSystemAdapter: vi.fn(),
}));

vi.mock("../../../src/utils/task-parser", () => ({
	parseTasksFromFile: vi.fn(() => []),
	getTaskStatusIcon: vi.fn(() => "circle-outline"),
	getTaskStatusTooltip: vi.fn(() => "Not started"),
	getGroupStatusIcon: vi.fn(() => "circle-outline"),
	calculateGroupStatus: vi.fn(() => "not-started"),
	calculateOverallStatus: vi.fn(() => "not-started"),
}));

vi.mock("../../../src/utils/checklist-parser", () => ({
	getChecklistStatusFromFile: vi.fn(() => ({
		total: 0,
		completed: 0,
		status: "not-started",
	})),
}));

const { getSpecSystemAdapter } = vi.mocked(
	await import("../../../src/utils/spec-kit-adapter")
);

describe("extension docs tree - integration", () => {
	let tempFeatureDir: string;

	beforeEach(() => {
		vi.clearAllMocks();
		tempFeatureDir = mkdtempSync(join(tmpdir(), "ext-docs-integ-"));
	});

	afterEach(() => {
		rmSync(tempFeatureDir, { recursive: true, force: true });
	});

	async function buildTree(files: Record<string, string>) {
		const mockAdapter = {
			getSpecFiles: vi.fn().mockReturnValue(files),
		};
		getSpecSystemAdapter.mockReturnValue(mockAdapter as any);

		const { SpecExplorerProvider } = await import(
			"../../../src/providers/spec-explorer-provider"
		);

		const subscriptions: { dispose(): void }[] = [];
		const mockContext = {
			subscriptions,
			extensionUri: { fsPath: "/fake/extension" } as any,
		} as any;

		const provider = new SpecExplorerProvider(mockContext);

		const mockSpecManager = {
			getAllSpecsUnified: vi.fn().mockResolvedValue([
				{
					id: "001-test-feature",
					name: "test-feature",
					path: tempFeatureDir,
					system: "speckit",
					files,
				},
			]),
			getActiveChangeRequests: vi.fn().mockResolvedValue([]),
		} as any;

		provider.setSpecManager(mockSpecManager);

		const rootChildren = await provider.getChildren();
		const currentSpecsGroup = rootChildren.find(
			(c: any) => c.contextValue === "group-current-specs"
		);
		const specs = await provider.getChildren(currentSpecsGroup);
		return provider.getChildren(specs[0]);
	}

	it("renders known docs, extra files, and extension folders in correct order", async () => {
		const files: Record<string, string> = {
			spec: join(tempFeatureDir, "spec.md"),
			plan: join(tempFeatureDir, "plan.md"),
			"extra:retrospective.md": join(tempFeatureDir, "retrospective.md"),
			"extra:system-design.md": join(tempFeatureDir, "system-design.md"),
			"extra-folder:v-model": join(tempFeatureDir, "v-model"),
		};

		const children = await buildTree(files);

		const contextValues = children.map((c: any) => c.contextValue);
		const labels = children.map((c: any) => c.label);

		// Known docs first
		expect(contextValues[0]).toBe("spec-document");
		expect(contextValues[1]).toBe("spec-document");

		// Then extra docs sorted alphabetically
		const retroIdx = labels.indexOf("Retrospective");
		const sysIdx = labels.indexOf("System design");
		expect(retroIdx).toBeLessThan(sysIdx);
		expect(retroIdx).toBeGreaterThan(1); // after known docs

		// Then extension folders last
		const vModelIdx = labels.indexOf("V model");
		expect(vModelIdx).toBeGreaterThan(sysIdx);
		expect(contextValues[vModelIdx]).toBe("extension-folder");
	});

	it("extension-document nodes have correct icon and open command", async () => {
		const children = await buildTree({
			spec: join(tempFeatureDir, "spec.md"),
			"extra:retrospective.md": join(tempFeatureDir, "retrospective.md"),
		});

		const extDoc = children.find(
			(c: any) => c.contextValue === "extension-document"
		);

		expect(extDoc).toBeDefined();
		expect((extDoc as any).iconPath.id).toBe("extensions");
		expect((extDoc as any).command.command).toBe("gatomia.spec.open");
		expect((extDoc as any).label).toBe("Retrospective");
	});

	it("extension-folder nodes have correct icon and are collapsible", async () => {
		const children = await buildTree({
			spec: join(tempFeatureDir, "spec.md"),
			"extra-folder:v-model": join(tempFeatureDir, "v-model"),
		});

		const extFolder = children.find(
			(c: any) => c.contextValue === "extension-folder"
		);

		expect(extFolder).toBeDefined();
		expect((extFolder as any).iconPath.id).toBe("folder-library");
		expect((extFolder as any).collapsibleState).toBe(1); // Collapsed
		expect((extFolder as any).label).toBe("V model");
	});

	it("produces no extra nodes when spec contains only known files", async () => {
		const children = await buildTree({
			spec: join(tempFeatureDir, "spec.md"),
			plan: join(tempFeatureDir, "plan.md"),
		});

		const extraNodes = children.filter(
			(c: any) =>
				c.contextValue === "extension-document" ||
				c.contextValue === "extension-folder"
		);
		expect(extraNodes).toHaveLength(0);
	});
});
