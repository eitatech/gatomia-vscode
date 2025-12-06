import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	workspace,
	window,
	type Uri,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";

// Auto-mock fs modules
vi.mock("fs");
vi.mock("node:fs");

// Mock os module
vi.mock("os", () => ({
	default: {
		homedir: vi.fn(() => "/home/testuser"),
	},
	homedir: vi.fn(() => "/home/testuser"),
}));

// Mock chat-prompt-runner
vi.mock("../../utils/chat-prompt-runner", () => ({
	sendPromptToChat: vi.fn(),
}));

// biome-ignore lint/performance/noNamespaceImport: Required for vitest mocking with vi.mocked()
import * as fs from "fs";
import { SteeringManager } from "./steering-manager";
import type { CopilotProvider } from "../../providers/copilot-provider";
import { ConfigManager } from "../../utils/config-manager";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";

// Mock spec-kit-adapter
vi.mock("../../utils/spec-kit-adapter", () => ({
	getSpecSystemAdapter: vi.fn(() => ({
		getActiveSystem: vi.fn(() => "speckit"),
		initialize: vi.fn(),
	})),
}));

describe("SteeringManager", () => {
	let steeringManager: SteeringManager;
	let mockContext: ExtensionContext;
	let mockCopilotProvider: CopilotProvider;
	let mockOutputChannel: OutputChannel;
	const mockWorkspaceRoot = "/test/workspace";

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock context
		mockContext = {
			subscriptions: [],
			extensionPath: "/test/extension",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
			},
		} as unknown as ExtensionContext;

		// Setup mock copilot provider
		mockCopilotProvider = {} as CopilotProvider;

		// Setup mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			show: vi.fn(),
		} as unknown as OutputChannel;

		// Setup workspace folders
		Object.defineProperty(workspace, "workspaceFolders", {
			value: [{ uri: { fsPath: mockWorkspaceRoot } }],
			configurable: true,
		});

		// Reset ConfigManager singleton
		const configManager = ConfigManager.getInstance();
		configManager.loadSettings();

		steeringManager = new SteeringManager(
			mockContext,
			mockCopilotProvider,
			mockOutputChannel
		);
	});

	describe("createUserConfiguration", () => {
		it("should create global copilot-instructions.md file", async () => {
			vi.mocked(workspace.fs.stat).mockRejectedValue(new Error("Not found"));
			vi.mocked(workspace.fs.createDirectory).mockResolvedValue(undefined);
			vi.mocked(workspace.fs.writeFile).mockResolvedValue(undefined);
			vi.mocked(workspace.openTextDocument).mockResolvedValue({} as any);
			vi.mocked(window.showTextDocument).mockResolvedValue({} as any);

			await steeringManager.createUserConfiguration();

			expect(workspace.fs.createDirectory).toHaveBeenCalled();
			expect(workspace.fs.writeFile).toHaveBeenCalled();

			const writeCall = vi.mocked(workspace.fs.writeFile).mock.calls[0];
			const uri = writeCall[0] as Uri;
			expect(uri.fsPath).toContain("copilot-instructions.md");
			expect(uri.fsPath).toContain(".github");
		});

		it("should ask for confirmation if file already exists", async () => {
			vi.mocked(workspace.fs.stat).mockResolvedValue({} as any);
			vi.mocked(window.showWarningMessage).mockResolvedValue(undefined);

			await steeringManager.createUserConfiguration();

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("already exists"),
				"Overwrite",
				"Cancel"
			);
		});

		it("should overwrite file when user confirms", async () => {
			vi.mocked(workspace.fs.stat).mockResolvedValue({} as any);
			vi.mocked(window.showWarningMessage).mockResolvedValue(
				"Overwrite" as any
			);
			vi.mocked(workspace.fs.writeFile).mockResolvedValue(undefined);
			vi.mocked(workspace.openTextDocument).mockResolvedValue({} as any);
			vi.mocked(window.showTextDocument).mockResolvedValue({} as any);

			await steeringManager.createUserConfiguration();

			expect(workspace.fs.writeFile).toHaveBeenCalled();
		});

		it("should not overwrite file when user cancels", async () => {
			vi.mocked(workspace.fs.stat).mockResolvedValue({} as any);
			vi.mocked(window.showWarningMessage).mockResolvedValue("Cancel" as any);

			await steeringManager.createUserConfiguration();

			expect(workspace.fs.writeFile).not.toHaveBeenCalled();
		});
	});

	describe("createProjectDocumentation", () => {
		it("should show error when no workspace is open", async () => {
			Object.defineProperty(workspace, "workspaceFolders", {
				value: undefined,
				configurable: true,
			});

			await steeringManager.createProjectDocumentation();

			expect(window.showErrorMessage).toHaveBeenCalledWith(
				"No workspace folder open."
			);
		});

		it("should ask for system choice when no system is detected", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(window.showQuickPick).mockResolvedValue(undefined);

			await steeringManager.createProjectDocumentation();

			expect(window.showQuickPick).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ label: "SpecKit" }),
					expect.objectContaining({ label: "OpenSpec" }),
				]),
				expect.anything()
			);
		});

		it("should create SpecKit constitution when selected", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(window.showQuickPick).mockResolvedValue({
				label: "SpecKit",
				value: "speckit",
			} as any);
			vi.mocked(window.showInputBox).mockResolvedValue("Test directives");

			await steeringManager.createProjectDocumentation();

			expect(sendPromptToChat).toHaveBeenCalledWith(
				"/speckit.constitution Test directives"
			);
		});

		it("should create OpenSpec AGENTS.md when selected", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(window.showQuickPick).mockResolvedValue({
				label: "OpenSpec",
				value: "openspec",
			} as any);
			vi.mocked(workspace.fs.stat).mockRejectedValue(new Error("Not found"));
			vi.mocked(workspace.fs.createDirectory).mockResolvedValue(undefined);
			vi.mocked(workspace.fs.writeFile).mockResolvedValue(undefined);
			vi.mocked(workspace.openTextDocument).mockResolvedValue({} as any);
			vi.mocked(window.showTextDocument).mockResolvedValue({} as any);

			// We need to mock the adapter to return openspec after user selection
			const mockAdapter = {
				getActiveSystem: vi.fn(() => "openspec"),
				initialize: vi.fn(),
			};
			vi.mocked(
				await import("../../utils/spec-kit-adapter")
			).getSpecSystemAdapter = vi.fn(() => mockAdapter) as any;

			await steeringManager.createProjectDocumentation();

			// Re-initialize manager after mocking
			steeringManager = new SteeringManager(
				mockContext,
				mockCopilotProvider,
				mockOutputChannel
			);

			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(window.showQuickPick).mockResolvedValue({
				label: "OpenSpec",
				value: "openspec",
			} as any);

			await steeringManager.createProjectDocumentation();
		});
	});
});
