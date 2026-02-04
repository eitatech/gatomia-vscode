import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IFrontmatterProcessor } from "../../../src/features/documents/version-tracking/types";

// Dynamic import after implementation
let FileChangeDetector: any;

describe("FileChangeDetector", () => {
	let mockFrontmatterProcessor: IFrontmatterProcessor;
	let detector: any;
	const testDocPath = "/workspace/specs/feature-001/spec.md";

	beforeEach(async () => {
		// Dynamic import after implementation exists
		try {
			const module = await import("../../../src/utils/file-change-detector");
			FileChangeDetector = module.FileChangeDetector;
		} catch {
			// Implementation doesn't exist yet (RED phase)
		}

		mockFrontmatterProcessor = {
			extract: vi.fn(),
			update: vi.fn(),
			hasValidFrontmatter: vi.fn(),
			extractBodyContent: vi.fn(),
		};

		if (FileChangeDetector) {
			detector = new FileChangeDetector(mockFrontmatterProcessor);
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("hasBodyContentChanged", () => {
		test("should return true when no baseline exists (first check)", async () => {
			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				"# Feature\\n\\nBody content"
			);

			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(true);
		});

		test("should return false when content is identical", async () => {
			const bodyContent = "# Feature\\n\\nSame content";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				bodyContent
			);
			await detector.updateBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				bodyContent
			);
			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(false);
		});

		test("should return false when only whitespace changed", async () => {
			const original = "Content  with   spaces";
			const whitespace = "Content   with    spaces";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				original
			);
			await detector.updateBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				whitespace
			);
			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(false);
		});

		test("should return true when body content changed", async () => {
			const original = "Original content";
			const changed = "Modified content";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				original
			);
			await detector.updateBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				changed
			);
			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(true);
		});

		test("should handle different documents independently", async () => {
			const doc1 = "/workspace/spec1.md";
			const doc2 = "/workspace/spec2.md";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				"Doc 1"
			);
			await detector.updateBaseline(doc1);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				"Doc 2"
			);
			await detector.updateBaseline(doc2);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				"Doc 1"
			);
			const result1 = await detector.hasBodyContentChanged(doc1);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				"Doc 2 MODIFIED"
			);
			const result2 = await detector.hasBodyContentChanged(doc2);

			expect(result1).toBe(false);
			expect(result2).toBe(true);
		});
	});

	describe("updateBaseline", () => {
		test("should store current body content as baseline", async () => {
			const bodyContent = "Current content";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				bodyContent
			);
			await detector.updateBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				bodyContent
			);
			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(false);
		});

		test("should update existing baseline", async () => {
			const initial = "Initial";
			const updated = "Updated";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				initial
			);
			await detector.updateBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				updated
			);
			await detector.updateBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				updated
			);
			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(false);
		});
	});

	describe("clearBaseline", () => {
		test("should clear baseline for a document", async () => {
			const content = "Content";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				content
			);
			await detector.updateBaseline(testDocPath);

			await detector.clearBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				content
			);
			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(true);
		});

		test("should work even if document has no baseline", () => {
			expect(() =>
				detector.clearBaseline("/workspace/never-tracked.md")
			).not.toThrow();
		});
	});

	describe("whitespace normalization", () => {
		test("should normalize multiple spaces", async () => {
			const original = "Multiple   spaces";
			const normalized = "Multiple spaces";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				original
			);
			await detector.updateBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				normalized
			);
			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(false);
		});

		test("should normalize line endings", async () => {
			const crlf = "Line 1\r\nLine 2";
			const lf = "Line 1\nLine 2";

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				crlf
			);
			await detector.updateBaseline(testDocPath);

			vi.mocked(mockFrontmatterProcessor.extractBodyContent).mockResolvedValue(
				lf
			);
			const result = await detector.hasBodyContentChanged(testDocPath);

			expect(result).toBe(false);
		});
	});
});
