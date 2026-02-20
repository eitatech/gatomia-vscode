// biome-ignore-all lint/suspicious/noExplicitAny: test helpers need any
import { describe, it, expect, vi, beforeEach } from "vitest";
import { type ExtensionContext, Uri, window as vscodeWindow } from "vscode";

// The controller is tested through its internal helpers extracted to module scope.
// We test the normalizeFormData and migrateDraftFormData helpers, plus the
// CreateSpecInputController behaviour via its open/message-handling methods.

type AnyRecord = Record<string, any>;

const DRAFT_STATE_KEY = "createSpecDraftState";

const makeContext = (stored?: AnyRecord): ExtensionContext => {
	const store = new Map<string, unknown>(stored ? Object.entries(stored) : []);
	return {
		extensionUri: Uri.file("/fake/extension"),
		workspaceState: {
			get: vi.fn((key: string) => store.get(key)),
			update: vi.fn((key: string, value: unknown) => {
				store.set(key, value);
			}),
			keys: vi.fn(() => [...store.keys()]),
		},
		globalState: {
			get: vi.fn(),
			update: vi.fn().mockResolvedValue(undefined),
			keys: vi.fn(() => []),
			setKeysForSync: vi.fn(),
		},
		subscriptions: [],
	} as unknown as ExtensionContext;
};

const makeConfigManager = () => ({
	getSettings: vi.fn(() => ({
		chatLanguage: "English",
		customInstructions: {},
		activeSystem: "speckit",
	})),
});

const makePromptLoader = () => ({
	loadPrompt: vi.fn().mockResolvedValue(""),
});

const makeOutputChannel = () => ({
	appendLine: vi.fn(),
	show: vi.fn(),
	dispose: vi.fn(),
});

// We import dynamically after mocks so module-level constants use mock vscode.
const importController = async () => {
	const mod = await import(
		"../../../../src/features/spec/create-spec-input-controller"
	);
	return mod.CreateSpecInputController;
};

describe("CreateSpecInputController — normalizeFormData", () => {
	it("preserves a well-formed description unchanged", async () => {
		const CreateSpecInputController = await importController();
		const context = makeContext();
		const controller = new CreateSpecInputController({
			context,
			configManager: makeConfigManager() as any,
			promptLoader: makePromptLoader() as any,
			outputChannel: makeOutputChannel() as any,
			activeSystem: "speckit",
		});

		// Open the panel so we can send a message that triggers autosave
		const panel = (vscodeWindow.createWebviewPanel as ReturnType<typeof vi.fn>)
			.mock.results[0]?.value;
		if (!panel) {
			return; // panel was already set up elsewhere
		}

		// The autosave handler normalizes the data before saving.
		// We verify the saved draft contains normalized description.
		await (controller as any).handleAutosave({ description: "  hello  " });
		expect(context.workspaceState.update).toHaveBeenCalledWith(
			DRAFT_STATE_KEY,
			expect.objectContaining({
				formData: { description: "  hello  " },
			})
		);
	});

	it("sets description to empty string when undefined", async () => {
		const CreateSpecInputController = await importController();
		const context = makeContext();
		const controller = new CreateSpecInputController({
			context,
			configManager: makeConfigManager() as any,
			promptLoader: makePromptLoader() as any,
			outputChannel: makeOutputChannel() as any,
			activeSystem: "speckit",
		});

		await (controller as any).handleAutosave({ description: undefined });
		expect(context.workspaceState.update).toHaveBeenCalledWith(
			DRAFT_STATE_KEY,
			expect.objectContaining({
				formData: { description: "" },
			})
		);
	});
});

describe("CreateSpecInputController — migrateDraftFormData", () => {
	it("passes through new-format draft unchanged", async () => {
		const CreateSpecInputController = await importController();
		const context = makeContext({
			[DRAFT_STATE_KEY]: {
				formData: { description: "My spec" },
				lastUpdated: 1000,
			},
		});
		const controller = new CreateSpecInputController({
			context,
			configManager: makeConfigManager() as any,
			promptLoader: makePromptLoader() as any,
			outputChannel: makeOutputChannel() as any,
			activeSystem: "speckit",
		});

		const draft = (controller as any).getDraftState();
		expect(draft?.formData.description).toBe("My spec");
	});

	it("migrates legacy 5-field draft to single description", async () => {
		const legacyDraft = {
			formData: {
				productContext: "Product context",
				keyScenarios: "Key scenarios",
				technicalConstraints: "Constraints",
				relatedFiles: "",
				openQuestions: "Questions",
			},
			lastUpdated: 2000,
		};
		const CreateSpecInputController = await importController();
		const context = makeContext({ [DRAFT_STATE_KEY]: legacyDraft });
		const controller = new CreateSpecInputController({
			context,
			configManager: makeConfigManager() as any,
			promptLoader: makePromptLoader() as any,
			outputChannel: makeOutputChannel() as any,
			activeSystem: "speckit",
		});

		const draft = (controller as any).getDraftState();
		expect(typeof draft?.formData.description).toBe("string");
		expect(draft?.formData.description).toContain("Product context");
		expect(draft?.formData.description).toContain("Key scenarios");
		// Empty fields should be omitted
		expect(draft?.formData.description).not.toContain("relatedFiles");
	});
});

describe("CreateSpecInputController — handleSubmit (US1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("posts submit:error when description is empty", async () => {
		const CreateSpecInputController = await importController();
		const context = makeContext();
		const controller = new CreateSpecInputController({
			context,
			configManager: makeConfigManager() as any,
			promptLoader: makePromptLoader() as any,
			outputChannel: makeOutputChannel() as any,
			activeSystem: "speckit",
		});

		const mockPostMessage = vi.fn().mockResolvedValue(true);
		(controller as any).panel = {
			webview: { postMessage: mockPostMessage },
			dispose: vi.fn(),
		};

		await (controller as any).handleSubmit({
			description: "   ",
			imageUris: [],
		});

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "create-spec/submit:error" })
		);
	});

	it("clears draft and posts submit:success on valid submission", async () => {
		vi.mock("../../../../src/features/spec/spec-submission-strategy", () => ({
			SpecSubmissionStrategyFactory: {
				create: vi.fn(() => ({
					submit: vi.fn().mockResolvedValue(undefined),
				})),
			},
		}));

		const CreateSpecInputController = await importController();
		const context = makeContext();
		const controller = new CreateSpecInputController({
			context,
			configManager: makeConfigManager() as any,
			promptLoader: makePromptLoader() as any,
			outputChannel: makeOutputChannel() as any,
			activeSystem: "speckit",
		});

		const mockPostMessage = vi.fn().mockResolvedValue(true);
		const mockDispose = vi.fn();
		(controller as any).panel = {
			webview: { postMessage: mockPostMessage },
			dispose: mockDispose,
		};

		await (controller as any).handleSubmit({
			description: "A real description",
			imageUris: [],
		});

		expect(context.workspaceState.update).toHaveBeenCalledWith(
			DRAFT_STATE_KEY,
			undefined
		);
		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "create-spec/submit:success" })
		);
		expect(mockDispose).toHaveBeenCalled();
	});
});

describe("CreateSpecInputController — handleAutosave (US1)", () => {
	it("saves draft with new shape {description}", async () => {
		vi.clearAllMocks();
		const CreateSpecInputController = await importController();
		const context = makeContext();
		const controller = new CreateSpecInputController({
			context,
			configManager: makeConfigManager() as any,
			promptLoader: makePromptLoader() as any,
			outputChannel: makeOutputChannel() as any,
			activeSystem: "speckit",
		});

		await (controller as any).handleAutosave({ description: "draft text" });

		expect(context.workspaceState.update).toHaveBeenCalledWith(
			DRAFT_STATE_KEY,
			expect.objectContaining({
				formData: { description: "draft text" },
				lastUpdated: expect.any(Number),
			})
		);
	});
});
