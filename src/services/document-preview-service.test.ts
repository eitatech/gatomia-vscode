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
			"Repository Wiki",
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

	describe("code file detection", () => {
		it("loads JSON files with renderStandard 'code' and language 'json'", async () => {
			const content = '{"openapi": "3.0.0", "info": {"title": "API"}}';
			readFileMock.mockResolvedValue(Buffer.from(content));

			const service = new DocumentPreviewService({
				appendLine: vi.fn(),
			} as any);

			const artifact = await service.loadDocument({
				fsPath: "/workspace/contracts/api.json",
				toString: () => "file:///workspace/contracts/api.json",
			} as any);

			expect(artifact.renderStandard).toBe("code");
			expect(artifact.metadata).toEqual({ language: "json" });
			expect(artifact.rawContent).toBe(content);
			expect(artifact.title).toBe("api.json");
		});

		it("loads YAML files with renderStandard 'code' and language 'yaml'", async () => {
			const content = "openapi: 3.0.0\ninfo:\n  title: API";
			readFileMock.mockResolvedValue(Buffer.from(content));

			const service = new DocumentPreviewService({
				appendLine: vi.fn(),
			} as any);

			const artifact = await service.loadDocument({
				fsPath: "/workspace/contracts/schema.yaml",
				toString: () => "file:///workspace/contracts/schema.yaml",
			} as any);

			expect(artifact.renderStandard).toBe("code");
			expect(artifact.metadata).toEqual({ language: "yaml" });
		});

		it("loads TypeScript files with renderStandard 'code' and language 'typescript'", async () => {
			const content = 'export interface User { name: string; }';
			readFileMock.mockResolvedValue(Buffer.from(content));

			const service = new DocumentPreviewService({
				appendLine: vi.fn(),
			} as any);

			const artifact = await service.loadDocument({
				fsPath: "/workspace/contracts/types.ts",
				toString: () => "file:///workspace/contracts/types.ts",
			} as any);

			expect(artifact.renderStandard).toBe("code");
			expect(artifact.metadata).toEqual({ language: "typescript" });
		});

		it("loads TOML files with renderStandard 'code' and language 'toml'", async () => {
			const content = '[package]\nname = "my-app"\nversion = "0.1.0"';
			readFileMock.mockResolvedValue(Buffer.from(content));

			const service = new DocumentPreviewService({
				appendLine: vi.fn(),
			} as any);

			const artifact = await service.loadDocument({
				fsPath: "/workspace/config.toml",
				toString: () => "file:///workspace/config.toml",
			} as any);

			expect(artifact.renderStandard).toBe("code");
			expect(artifact.metadata).toEqual({ language: "toml" });
		});

		it("continues to load .md files as markdown with renderStandard 'markdown'", async () => {
			const content = "# My Doc\n\n## Section\nContent";
			readFileMock.mockResolvedValue(Buffer.from(content));

			const service = new DocumentPreviewService({
				appendLine: vi.fn(),
			} as any);

			const artifact = await service.loadDocument({
				fsPath: "/workspace/specs/001-feature/spec.md",
				toString: () => "file:///workspace/specs/001-feature/spec.md",
			} as any);

			expect(artifact.renderStandard).toBe("markdown");
			expect(artifact.sections.length).toBeGreaterThan(0);
		});

		it("uses plaintext for unknown file extensions", async () => {
			const content = "Some random content";
			readFileMock.mockResolvedValue(Buffer.from(content));

			const service = new DocumentPreviewService({
				appendLine: vi.fn(),
			} as any);

			const artifact = await service.loadDocument({
				fsPath: "/workspace/data.xyz",
				toString: () => "file:///workspace/data.xyz",
			} as any);

			expect(artifact.renderStandard).toBe("code");
			expect(artifact.metadata).toEqual({ language: "plaintext" });
		});
	});
});
