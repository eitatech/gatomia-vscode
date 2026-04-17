import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { SpecExplorerProvider } from "../../../src/providers/spec-explorer-provider";

const mockWatcherDispose = vi.fn();
const mockWatcher = {
	onDidCreate: vi.fn(),
	onDidChange: vi.fn(),
	onDidDelete: vi.fn(),
	dispose: mockWatcherDispose,
};

vi.mock("vscode", async () => {
	const actual = await vi.importActual<typeof import("vscode")>("vscode");
	return {
		...actual,
		workspace: {
			...actual.workspace,
			workspaceFolders: [{ uri: { fsPath: "/fake/workspace" } }],
			asRelativePath: vi.fn((p: string) => p),
			createFileSystemWatcher: vi.fn(() => mockWatcher),
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

describe("SpecExplorerProvider", () => {
	let provider: SpecExplorerProvider;
	let mockContext: ExtensionContext;

	beforeEach(() => {
		vi.clearAllMocks();

		const subscriptions: { dispose(): void }[] = [];
		mockContext = {
			subscriptions,
			extensionUri: { fsPath: "/fake/extension" } as any,
		} as unknown as ExtensionContext;

		provider = new SpecExplorerProvider(mockContext);
	});

	describe("getChildren()", () => {
		it("returns empty array when specManager is not set", async () => {
			const children = await provider.getChildren();
			expect(children).toEqual([]);
		});
	});

	describe("refresh()", () => {
		it("fires onDidChangeTreeData event", () => {
			let fired = false;
			provider.onDidChangeTreeData(() => {
				fired = true;
			});
			provider.refresh();
			expect(fired).toBe(true);
		});
	});

	describe("setSpecManager()", () => {
		it("does not throw when called with a valid specManager", () => {
			const mockSpecManager = {
				getAllSpecsUnified: vi.fn().mockResolvedValue([]),
			} as any;

			expect(() => provider.setSpecManager(mockSpecManager)).not.toThrow();
		});
	});

	describe("extension-document rendering", () => {
		function setupSpecWithFiles(files: Record<string, string>) {
			const mockAdapter = {
				getSpecFiles: vi.fn().mockReturnValue(files),
			};
			getSpecSystemAdapter.mockReturnValue(mockAdapter as any);

			const mockSpecManager = {
				getAllSpecsUnified: vi.fn().mockResolvedValue([
					{
						id: "001-test-feature",
						name: "test-feature",
						path: "/fake/specs/001-test-feature",
						system: "speckit",
						files,
					},
				]),
				getActiveChangeRequests: vi.fn().mockResolvedValue([]),
			} as any;

			provider.setSpecManager(mockSpecManager);
			return mockSpecManager;
		}

		async function getSpecChildren(
			files: Record<string, string>
		): Promise<any[]> {
			setupSpecWithFiles(files);

			// Get root groups
			const rootChildren = await provider.getChildren();
			// Find "Current Specs" group
			const currentSpecsGroup = rootChildren.find(
				(c: any) => c.contextValue === "group-current-specs"
			);
			// Get specs under "Current Specs"
			const specs = await provider.getChildren(currentSpecsGroup);
			// Get children of first spec
			return provider.getChildren(specs[0]);
		}

		it("renders extra .md files with extension-document contextValue", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				"extra:retrospective.md":
					"/fake/specs/001-test-feature/retrospective.md",
			});

			const extDoc = children.find(
				(c: any) => c.contextValue === "extension-document"
			);
			expect(extDoc).toBeDefined();
			expect(extDoc.label).toBe("Retrospective");
		});

		it("uses extensions ThemeIcon for extension documents", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				"extra:retrospective.md":
					"/fake/specs/001-test-feature/retrospective.md",
			});

			const extDoc = children.find(
				(c: any) => c.contextValue === "extension-document"
			);
			expect(extDoc.iconPath.id).toBe("extensions");
		});

		it("sorts extra files alphabetically after known documents", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				plan: "/fake/specs/001-test-feature/plan.md",
				"extra:system-design.md":
					"/fake/specs/001-test-feature/system-design.md",
				"extra:acceptance-test-plan.md":
					"/fake/specs/001-test-feature/acceptance-test-plan.md",
			});

			// Known docs first (spec, plan), then extras sorted alphabetically
			const labels = children.map((c: any) => c.label);
			const specIdx = labels.indexOf("Spec");
			const planIdx = labels.indexOf("Plan");
			const acceptIdx = labels.indexOf("Acceptance test plan");
			const sysIdx = labels.indexOf("System design");

			expect(specIdx).toBeLessThan(acceptIdx);
			expect(planIdx).toBeLessThan(acceptIdx);
			expect(acceptIdx).toBeLessThan(sysIdx);
		});

		it("derives sentence-case labels from kebab-case filenames", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				"extra:acceptance-test-plan.md":
					"/fake/specs/001-test-feature/acceptance-test-plan.md",
			});

			const extDoc = children.find(
				(c: any) => c.contextValue === "extension-document"
			);
			expect(extDoc.label).toBe("Acceptance test plan");
		});

		it("does not show extension-document nodes when no extra files exist", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				plan: "/fake/specs/001-test-feature/plan.md",
			});

			const extDocs = children.filter(
				(c: any) => c.contextValue === "extension-document"
			);
			expect(extDocs).toHaveLength(0);
		});

		it("assigns open command to extension documents", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				"extra:retrospective.md":
					"/fake/specs/001-test-feature/retrospective.md",
			});

			const extDoc = children.find(
				(c: any) => c.contextValue === "extension-document"
			);
			expect(extDoc.command).toBeDefined();
			expect(extDoc.command.command).toBe("gatomia.spec.open");
		});
	});

	describe("extension-folder rendering", () => {
		function setupSpecWithFiles(files: Record<string, string>) {
			const mockAdapter = {
				getSpecFiles: vi.fn().mockReturnValue(files),
			};
			getSpecSystemAdapter.mockReturnValue(mockAdapter as any);

			const mockSpecManager = {
				getAllSpecsUnified: vi.fn().mockResolvedValue([
					{
						id: "001-test-feature",
						name: "test-feature",
						path: "/fake/specs/001-test-feature",
						system: "speckit",
						files,
					},
				]),
				getActiveChangeRequests: vi.fn().mockResolvedValue([]),
			} as any;

			provider.setSpecManager(mockSpecManager);
		}

		async function getSpecChildren(
			files: Record<string, string>
		): Promise<any[]> {
			setupSpecWithFiles(files);
			const rootChildren = await provider.getChildren();
			const currentSpecsGroup = rootChildren.find(
				(c: any) => c.contextValue === "group-current-specs"
			);
			const specs = await provider.getChildren(currentSpecsGroup);
			return provider.getChildren(specs[0]);
		}

		it("renders unknown subfolders with extension-folder contextValue", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				"extra-folder:v-model": "/fake/specs/001-test-feature/v-model",
			});

			const extFolder = children.find(
				(c: any) => c.contextValue === "extension-folder"
			);
			expect(extFolder).toBeDefined();
			expect(extFolder.label).toBe("V model");
		});

		it("uses folder-library ThemeIcon for extension folders", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				"extra-folder:v-model": "/fake/specs/001-test-feature/v-model",
			});

			const extFolder = children.find(
				(c: any) => c.contextValue === "extension-folder"
			);
			expect(extFolder.iconPath.id).toBe("folder-library");
		});

		it("creates collapsible extension-folder nodes", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				"extra-folder:v-model": "/fake/specs/001-test-feature/v-model",
			});

			const extFolder = children.find(
				(c: any) => c.contextValue === "extension-folder"
			);
			expect(extFolder.collapsibleState).toBe(1); // TreeItemCollapsibleState.Collapsed
		});

		it("sorts extension folders alphabetically after extra documents", async () => {
			const children = await getSpecChildren({
				spec: "/fake/specs/001-test-feature/spec.md",
				"extra:retrospective.md":
					"/fake/specs/001-test-feature/retrospective.md",
				"extra-folder:v-model": "/fake/specs/001-test-feature/v-model",
				"extra-folder:audit": "/fake/specs/001-test-feature/audit",
			});

			const labels = children.map((c: any) => c.label);
			const retroIdx = labels.indexOf("Retrospective");
			const auditIdx = labels.indexOf("Audit");
			const vModelIdx = labels.indexOf("V model");

			// Extra docs before folders, folders sorted alphabetically
			expect(retroIdx).toBeLessThan(auditIdx);
			expect(auditIdx).toBeLessThan(vModelIdx);
		});
	});

	describe("file system watcher", () => {
		it("creates a FileSystemWatcher for specs markdown files", async () => {
			const { workspace } = await import("vscode");
			expect(workspace.createFileSystemWatcher).toHaveBeenCalledWith(
				"**/specs/**/*.md"
			);
		});

		it("registers watcher event handlers", () => {
			expect(mockWatcher.onDidCreate).toHaveBeenCalled();
			expect(mockWatcher.onDidChange).toHaveBeenCalled();
			expect(mockWatcher.onDidDelete).toHaveBeenCalled();
		});

		it("adds watcher disposal to context subscriptions", () => {
			const subscriptions = mockContext.subscriptions;
			expect(subscriptions.length).toBeGreaterThan(0);
		});

		it("calls refresh when a file event fires (debounced)", () => {
			vi.useFakeTimers();

			let refreshFired = false;
			provider.onDidChangeTreeData(() => {
				refreshFired = true;
			});

			// Get the callback that was passed to onDidCreate
			const createCallback = mockWatcher.onDidCreate.mock.calls[0]?.[0];
			expect(createCallback).toBeDefined();

			// Fire the event
			createCallback({});

			// Should not fire immediately (debounced)
			expect(refreshFired).toBe(false);

			// Advance timers past debounce
			vi.advanceTimersByTime(2100);

			expect(refreshFired).toBe(true);

			vi.useRealTimers();
		});
	});
});
