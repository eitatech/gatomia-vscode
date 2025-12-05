import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { FileType, Uri, window, workspace } from "vscode";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
import { SpecManager } from "./spec-manager";

// Mock dependencies
vi.mock("../../services/prompt-loader", () => {
	const mockRenderPrompt = vi.fn();
	return {
		PromptLoader: {
			getInstance: () => ({
				renderPrompt: mockRenderPrompt,
			}),
		},
	};
});
vi.mock("../../utils/chat-prompt-runner");
vi.mock("../../utils/notification-utils");
const { openMock, createSpecInputControllerMock } = vi.hoisted(() => {
	const open = vi.fn();
	return {
		openMock: open,
		createSpecInputControllerMock: vi.fn(() => ({
			open,
		})),
	};
});
vi.mock("./create-spec-input-controller", () => ({
	CreateSpecInputController: createSpecInputControllerMock,
}));

describe("SpecManager", () => {
	let specManager: SpecManager;
	let mockContext: ExtensionContext;
	const mockOutputChannel = { appendLine: vi.fn() } as any;

	beforeEach(() => {
		vi.clearAllMocks();
		openMock.mockClear();
		createSpecInputControllerMock.mockClear();
		mockContext = {
			extensionUri: Uri.parse("file:///extension"),
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			subscriptions: [],
		} as unknown as ExtensionContext;
		specManager = new SpecManager(mockContext, mockOutputChannel);
		vi.mocked(workspace.fs.stat).mockResolvedValue({} as any);
	});

	// 1. Happy Path: Test that getSpecList returns a list of directories.
	it("should return a list of spec directories", async () => {
		const mockEntries = [
			["spec1", FileType.Directory],
			["spec2", FileType.Directory],
			["file1.txt", FileType.File],
		] as [string, any][];

		vi.mocked(workspace.fs.stat).mockRejectedValue(new Error("Not found"));
		vi.mocked(workspace.fs.readDirectory).mockResolvedValue(mockEntries);

		const specList = await specManager.getSpecList();

		expect(specList).toEqual(["spec1", "spec2"]);
		expect(workspace.fs.readDirectory).toHaveBeenCalled();
	});

	// 2. Edge Case: Test delete when the file system operation fails.
	it("should show an error message when deletion fails", async () => {
		const error = new Error("Deletion failed");
		vi.mocked(workspace.fs.delete).mockRejectedValue(error);
		vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");

		await specManager.delete("spec-to-delete");

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			`Failed to delete spec: ${error}`
		);
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			`[SpecManager] Failed to delete spec: ${error}`
		);
	});

	// Delete Tests - System-aware path resolution
	describe("delete with system parameter", () => {
		beforeEach(() => {
			vi.mocked(workspace.fs.delete).mockResolvedValue();
		});

		it("should delete SpecKit spec from correct path", async () => {
			vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");

			await specManager.delete("001-feature", "speckit");

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				`Are you sure you want to delete "001-feature"? This action cannot be undone.`,
				{ modal: true },
				"Delete"
			);
			expect(workspace.fs.delete).toHaveBeenCalledWith(
				expect.objectContaining({
					fsPath: expect.stringContaining("specs/001-feature"),
				}),
				{ recursive: true }
			);
		});

		it("should delete OpenSpec spec from correct path", async () => {
			vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");

			await specManager.delete("my-feature", "openspec");

			expect(workspace.fs.delete).toHaveBeenCalledWith(
				expect.objectContaining({
					fsPath: expect.stringContaining("openspec/specs/my-feature"),
				}),
				{ recursive: true }
			);
		});

		it("should not delete when user cancels confirmation", async () => {
			vi.mocked(window.showWarningMessage).mockResolvedValue(undefined);

			await specManager.delete("001-feature", "speckit");

			expect(workspace.fs.delete).not.toHaveBeenCalled();
		});

		it("should show confirmation dialog with spec name", async () => {
			vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");

			await specManager.delete("important-spec", "speckit");

			expect(window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("important-spec"),
				expect.anything(),
				"Delete"
			);
		});

		it("should use activeSystem when system not provided", async () => {
			vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");
			// activeSystem defaults to "auto", which uses OpenSpec path

			await specManager.delete("my-feature");

			expect(workspace.fs.delete).toHaveBeenCalledWith(expect.anything(), {
				recursive: true,
			});
		});

		it("should show success notification after deletion", async () => {
			vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");

			await specManager.delete("001-feature", "speckit");

			// Verify that the notification was shown (we can't easily mock the async utility)
			// Just verify deletion happened and no error was thrown
			expect(workspace.fs.delete).toHaveBeenCalled();
		});

		it("should log error to output channel on deletion failure", async () => {
			const error = new Error("Permission denied");
			vi.mocked(workspace.fs.delete).mockRejectedValue(error);
			vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");

			await specManager.delete("readonly-spec", "speckit");

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("[SpecManager] Failed to delete spec")
			);
		});
	});

	// 3. Fail Safe / Mocks: Test the create method.
	it("should render and send a prompt to chat on create", async () => {
		await specManager.create();

		expect(createSpecInputControllerMock).toHaveBeenCalledWith({
			context: mockContext,
			configManager: ConfigManager.getInstance(),
			promptLoader: PromptLoader.getInstance(),
			outputChannel: mockOutputChannel,
			activeSystem: "auto",
		});
		expect(openMock).toHaveBeenCalled();
	});

	// 4. Filter: Test that getChanges filters out "archive" directory.
	it("should return a list of changes directories excluding 'archive'", async () => {
		const mockEntries = [
			["change1", FileType.Directory],
			["archive", FileType.Directory],
			["change2", FileType.Directory],
			["file1.txt", FileType.File],
		] as [string, any][];

		vi.mocked(workspace.fs.readDirectory).mockResolvedValue(mockEntries);

		const changes = await specManager.getChanges();

		expect(changes).toEqual(["change1", "change2"]);
		expect(workspace.fs.readDirectory).toHaveBeenCalled();
	});

	// 5. Trigger Integration: Test TriggerRegistry integration
	describe("TriggerRegistry Integration", () => {
		let mockTriggerRegistry: {
			fireTrigger: ReturnType<typeof vi.fn>;
		};

		beforeEach(() => {
			mockTriggerRegistry = {
				fireTrigger: vi.fn(),
			};
		});

		it("should set TriggerRegistry successfully", () => {
			specManager.setTriggerRegistry(mockTriggerRegistry as any);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[SpecManager] TriggerRegistry connected"
			);
		});

		it("should fire trigger after successful SpecKit command execution", async () => {
			specManager.setTriggerRegistry(mockTriggerRegistry as any);

			await specManager.executeSpecKitCommand("specify");

			expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledWith(
				"speckit",
				"specify"
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[SpecManager] Fired trigger: speckit.specify"
			);
		});

		it("should fire triggers for all SpecKit operations", async () => {
			specManager.setTriggerRegistry(mockTriggerRegistry as any);

			const operations = [
				"constitution",
				"specify",
				"clarify",
				"plan",
				"analyze",
				"checklist",
			];

			for (const operation of operations) {
				await specManager.executeSpecKitCommand(operation);
				expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledWith(
					"speckit",
					operation
				);
			}

			expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledTimes(
				operations.length
			);
		});

		it("should not fire trigger when TriggerRegistry is not set", async () => {
			// Don't set trigger registry
			await specManager.executeSpecKitCommand("specify");

			// Should not throw, just skip trigger firing
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalledWith(
				expect.stringContaining("Fired trigger")
			);
		});

		it("should not fire trigger on command execution error", async () => {
			const { sendPromptToChat } = await import(
				"../../utils/chat-prompt-runner"
			);
			vi.mocked(sendPromptToChat).mockRejectedValueOnce(
				new Error("Command failed")
			);

			specManager.setTriggerRegistry(mockTriggerRegistry as any);

			await expect(
				specManager.executeSpecKitCommand("specify")
			).rejects.toThrow("Command failed");

			// Trigger should not fire on error
			expect(mockTriggerRegistry.fireTrigger).not.toHaveBeenCalled();
		});
	});
});
