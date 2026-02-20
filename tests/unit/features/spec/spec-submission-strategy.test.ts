// biome-ignore-all lint/suspicious/noExplicitAny: test helpers need any
import { describe, it, expect, vi, beforeEach } from "vitest";
import { workspace, Uri } from "vscode";

vi.mock("../../../../src/utils/chat-prompt-runner", () => ({
	sendPromptToChat: vi.fn().mockResolvedValue(undefined),
}));

const setupWorkspaceMock = () => {
	(workspace.fs as any).readFile = vi
		.fn()
		.mockResolvedValue(new TextEncoder().encode("Prompt template"));
	(workspace as any).workspaceFolders = [
		{ uri: Uri.parse("file:///fake/workspace") },
	];
};

describe("SpecKitSubmissionStrategy (US1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends /speckit.specify with description directly", async () => {
		const { sendPromptToChat } = await import(
			"../../../../src/utils/chat-prompt-runner"
		);
		const { SpecKitSubmissionStrategy } = await import(
			"../../../../src/features/spec/spec-submission-strategy"
		);

		const spy = vi.mocked(sendPromptToChat);
		const strategy = new SpecKitSubmissionStrategy();

		await strategy.submit({
			description: "Build a login form",
			imageUris: [],
		});

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Build a login form"),
			expect.any(Object),
			undefined
		);
	});

	it("passes imageUris as files when non-empty", async () => {
		const { sendPromptToChat } = await import(
			"../../../../src/utils/chat-prompt-runner"
		);
		const { SpecKitSubmissionStrategy } = await import(
			"../../../../src/features/spec/spec-submission-strategy"
		);

		const spy = vi.mocked(sendPromptToChat);
		const strategy = new SpecKitSubmissionStrategy();

		await strategy.submit({
			description: "My spec",
			imageUris: ["file:///tmp/image1.png", "file:///tmp/image2.png"],
		});

		expect(spy).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(Object),
			expect.arrayContaining([
				expect.objectContaining({ toString: expect.any(Function) }),
			])
		);
	});

	it("does not pass files when imageUris is empty", async () => {
		const { sendPromptToChat } = await import(
			"../../../../src/utils/chat-prompt-runner"
		);
		const { SpecKitSubmissionStrategy } = await import(
			"../../../../src/features/spec/spec-submission-strategy"
		);

		const spy = vi.mocked(sendPromptToChat);
		const strategy = new SpecKitSubmissionStrategy();

		await strategy.submit({
			description: "Spec with no images",
			imageUris: [],
		});

		const lastCall = spy.mock.calls.at(-1);
		// Third argument (files) should be undefined
		expect(lastCall).toBeDefined();
		expect(lastCall?.[2]).toBeUndefined();
	});
});

describe("OpenSpecSubmissionStrategy (US1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupWorkspaceMock();
	});

	it("sends prompt with description trimmed", async () => {
		const { sendPromptToChat } = await import(
			"../../../../src/utils/chat-prompt-runner"
		);
		const { OpenSpecSubmissionStrategy } = await import(
			"../../../../src/features/spec/spec-submission-strategy"
		);

		const spy = vi.mocked(sendPromptToChat);
		const strategy = new OpenSpecSubmissionStrategy();

		await strategy.submit({
			description: "  Build a dashboard  ",
			imageUris: [],
		});

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Build a dashboard"),
			expect.any(Object),
			undefined
		);
	});
});

describe("SpecSubmissionStrategyFactory", () => {
	it("returns SpecKitSubmissionStrategy for speckit mode", async () => {
		const { SpecSubmissionStrategyFactory, SpecKitSubmissionStrategy } =
			await import("../../../../src/features/spec/spec-submission-strategy");

		const strategy = SpecSubmissionStrategyFactory.create("speckit");
		expect(strategy).toBeInstanceOf(SpecKitSubmissionStrategy);
	});

	it("returns OpenSpecSubmissionStrategy for openspec mode", async () => {
		const { SpecSubmissionStrategyFactory, OpenSpecSubmissionStrategy } =
			await import("../../../../src/features/spec/spec-submission-strategy");

		const strategy = SpecSubmissionStrategyFactory.create("openspec");
		expect(strategy).toBeInstanceOf(OpenSpecSubmissionStrategy);
	});
});
