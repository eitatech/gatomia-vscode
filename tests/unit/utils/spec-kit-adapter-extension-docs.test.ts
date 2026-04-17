import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const MARKDOWN_CONTENT = "# Test Document\n\nSome content.\n";

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/fake/workspace" } }],
	},
	window: {
		showQuickPick: vi.fn(),
		showInformationMessage: vi.fn(),
	},
}));

vi.mock("../../../src/utils/spec-kit-utilities", () => ({
	detectActiveSpecSystem: vi.fn(() => "speckit"),
	discoverSpecKitFeatures: vi.fn(),
	generateNextFeatureNumber: vi.fn(() => 1),
	createFeatureDirectoryName: vi.fn(),
	detectAvailableSpecSystems: vi.fn(() => ["speckit"]),
}));

vi.mock("../../../src/utils/config-manager", () => ({
	ConfigManager: {
		getInstance: vi.fn(() => ({
			loadSettings: vi.fn().mockResolvedValue({ specSystem: "speckit" }),
			getSettings: vi.fn().mockReturnValue({ specSystem: "speckit" }),
			saveSettings: vi.fn(),
		})),
	},
}));

const { discoverSpecKitFeatures } = vi.mocked(
	await import("../../../src/utils/spec-kit-utilities")
);

describe("getSpecKitFeatureFiles - extension docs discovery", () => {
	let tempFeatureDir: string;
	let adapter: import("../../../src/utils/spec-kit-adapter").SpecSystemAdapter;

	beforeEach(async () => {
		vi.clearAllMocks();

		tempFeatureDir = mkdtempSync(join(tmpdir(), "spec-test-"));

		discoverSpecKitFeatures.mockReturnValue([
			{
				slug: "001-test-feature",
				name: "test-feature",
				path: tempFeatureDir,
				number: 1,
			},
		]);

		const { SpecSystemAdapter } = await import(
			"../../../src/utils/spec-kit-adapter"
		);
		adapter = SpecSystemAdapter.getInstance();
		adapter.reset();

		// Manually set config to avoid full vscode initialization
		(adapter as unknown as { config: unknown }).config = {
			system: "speckit",
			workspacePath: "/fake/workspace",
			specsPath: join(tempFeatureDir, ".."),
			promptsPath: "/fake/prompts",
		};
	});

	afterEach(() => {
		rmSync(tempFeatureDir, { recursive: true, force: true });
	});

	it("returns only known files when no extra files exist", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "plan.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "tasks.md"), MARKDOWN_CONTENT);

		const files = adapter.getSpecFiles("001-test-feature");

		expect(files).toHaveProperty("spec");
		expect(files).toHaveProperty("plan");
		expect(files).toHaveProperty("tasks");

		const extraKeys = Object.keys(files).filter((k) => k.startsWith("extra:"));
		expect(extraKeys).toHaveLength(0);
	});

	it("includes extra .md files with extra: prefix key", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "retrospective.md"), MARKDOWN_CONTENT);

		const files = adapter.getSpecFiles("001-test-feature");

		expect(files).toHaveProperty("spec");
		expect(files["extra:retrospective.md"]).toBe(
			join(tempFeatureDir, "retrospective.md")
		);
	});

	it("ignores non-markdown files", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "config.yml"), "key: value");
		writeFileSync(join(tempFeatureDir, "notes.json"), "{}");
		writeFileSync(join(tempFeatureDir, "image.png"), "binary");

		const files = adapter.getSpecFiles("001-test-feature");

		const allKeys = Object.keys(files);
		expect(allKeys).not.toContain("extra:config.yml");
		expect(allKeys).not.toContain("extra:notes.json");
		expect(allKeys).not.toContain("extra:image.png");
	});

	it("does not duplicate known files as extra entries", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "plan.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "research.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "data-model.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "quickstart.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "tasks.md"), MARKDOWN_CONTENT);

		const files = adapter.getSpecFiles("001-test-feature");

		const extraKeys = Object.keys(files).filter((k) => k.startsWith("extra:"));
		expect(extraKeys).toHaveLength(0);

		expect(files).toHaveProperty("spec");
		expect(files).toHaveProperty("plan");
		expect(files).toHaveProperty("research");
		expect(files).toHaveProperty("data-model");
		expect(files).toHaveProperty("quickstart");
		expect(files).toHaveProperty("tasks");
	});

	it("includes multiple extra .md files", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		writeFileSync(join(tempFeatureDir, "retrospective.md"), MARKDOWN_CONTENT);
		writeFileSync(
			join(tempFeatureDir, "acceptance-test-plan.md"),
			MARKDOWN_CONTENT
		);
		writeFileSync(join(tempFeatureDir, "system-design.md"), MARKDOWN_CONTENT);

		const files = adapter.getSpecFiles("001-test-feature");

		expect(files["extra:retrospective.md"]).toBeDefined();
		expect(files["extra:acceptance-test-plan.md"]).toBeDefined();
		expect(files["extra:system-design.md"]).toBeDefined();
	});

	it("includes unknown subfolders with extra-folder: prefix key", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		const vModelDir = join(tempFeatureDir, "v-model");
		mkdirSync(vModelDir);
		writeFileSync(join(vModelDir, "requirements-spec.md"), MARKDOWN_CONTENT);

		const files = adapter.getSpecFiles("001-test-feature");

		expect(files["extra-folder:v-model"]).toBe(vModelDir);
	});

	it("excludes known folders from extra-folder entries", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		const checklistsDir = join(tempFeatureDir, "checklists");
		mkdirSync(checklistsDir);
		writeFileSync(join(checklistsDir, "requirements.md"), MARKDOWN_CONTENT);
		const contractsDir = join(tempFeatureDir, "contracts");
		mkdirSync(contractsDir);
		writeFileSync(join(contractsDir, "api.yaml"), "openapi: 3.0.0");

		const files = adapter.getSpecFiles("001-test-feature");

		expect(files).toHaveProperty("checklists");
		expect(files).toHaveProperty("contracts");
		const extraFolderKeys = Object.keys(files).filter((k) =>
			k.startsWith("extra-folder:")
		);
		expect(extraFolderKeys).toHaveLength(0);
	});

	it("excludes empty subfolders", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		const emptyDir = join(tempFeatureDir, "empty-folder");
		mkdirSync(emptyDir);

		const files = adapter.getSpecFiles("001-test-feature");

		const extraFolderKeys = Object.keys(files).filter((k) =>
			k.startsWith("extra-folder:")
		);
		expect(extraFolderKeys).toHaveLength(0);
	});

	it("includes nested subfolders within extension folders", () => {
		writeFileSync(join(tempFeatureDir, "spec.md"), MARKDOWN_CONTENT);
		const vModelDir = join(tempFeatureDir, "v-model");
		mkdirSync(vModelDir);
		writeFileSync(join(vModelDir, "requirements-spec.md"), MARKDOWN_CONTENT);
		const nestedDir = join(vModelDir, "reports");
		mkdirSync(nestedDir);
		writeFileSync(join(nestedDir, "trace.md"), MARKDOWN_CONTENT);

		const files = adapter.getSpecFiles("001-test-feature");

		expect(files["extra-folder:v-model"]).toBe(vModelDir);
	});
});
