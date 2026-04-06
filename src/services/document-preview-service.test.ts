import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentPreviewService } from "./document-preview-service";

const { readFileMock } = vi.hoisted(() => ({
	readFileMock: vi.fn(),
}));

vi.mock("vscode", () => {
	class EventEmitter<T> {
		readonly event = vi.fn();
		fire = vi.fn<(value: T) => void>();
		dispose = vi.fn();
	}

	return {
		workspace: {
			fs: {
				readFile: readFileMock,
			},
			workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
		},
		EventEmitter,
	};
});

describe("DocumentPreviewService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not inject a synthetic Overview section when document already has one", async () => {
		const content = [
			"# Repository Wiki",
			"",
			"Intro paragraph.",
			"",
			"## Overview",
			"Real overview content.",
			"",
			"## Details",
			"More details.",
		].join("\n");

		readFileMock.mockResolvedValue(Buffer.from(content));

		const service = new DocumentPreviewService({
			appendLine: vi.fn(),
		} as any);

		const artifact = await service.loadDocument({
			fsPath: "/workspace/docs/overview.md",
			toString: () => "file:///workspace/docs/overview.md",
		} as any);

		expect(artifact.sections.map((section) => section.title)).toEqual([
			"Overview",
			"Details",
		]);
		expect(
			artifact.sections.filter((section) => section.title === "Overview")
		).toHaveLength(1);
	});

	it("derives fallback section title from document content when no H2 headings exist", async () => {
		const content = ["# Standalone Doc", "", "Single section body."].join("\n");

		readFileMock.mockResolvedValue(Buffer.from(content));

		const service = new DocumentPreviewService({
			appendLine: vi.fn(),
		} as any);

		const artifact = await service.loadDocument({
			fsPath: "/workspace/docs/standalone.md",
			toString: () => "file:///workspace/docs/standalone.md",
		} as any);

		expect(artifact.sections).toHaveLength(1);
		expect(artifact.sections[0]?.title).toBe("Standalone Doc");
		expect(artifact.sections[0]?.title).not.toBe("Overview");
	});
});
