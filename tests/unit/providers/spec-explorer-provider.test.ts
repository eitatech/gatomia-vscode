import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { SpecExplorerProvider } from "../../../src/providers/spec-explorer-provider";

vi.mock("../../../src/features/spec/review-flow/state", () => ({
	getSpecState: vi.fn(),
	onReviewFlowStateChange: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("../../../src/utils/spec-kit-adapter", () => ({
	getSpecSystemAdapter: vi.fn(),
}));

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
});
