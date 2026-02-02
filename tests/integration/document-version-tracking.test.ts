import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ExtensionContext, TextDocument, OutputChannel } from "vscode";
import { Uri } from "vscode";
import { createDocumentVersionService } from "../../src/features/documents/version-tracking/document-version-service";
import type { IDocumentVersionService } from "../../src/features/documents/version-tracking/types";
import matter from "gray-matter";

// Regex patterns for testing
const EMAIL_PATTERN = /<.+@.+>/;
const VERSION_1_0_PATTERN = /version:\s+['"]1\.0['"]/;

// Mock output channel helper
function createMockOutputChannel(): OutputChannel {
	return {
		name: "Test Output",
		append: vi.fn(),
		appendLine: vi.fn(),
		replace: vi.fn(),
		clear: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
	} as unknown as OutputChannel;
}

/**
 * Integration test for Document Version Tracking feature (User Story 1).
 *
 * Tests the complete initialization flow:
 * 1. Create new SpecKit document
 * 2. Initialize version tracking
 * 3. Verify version "1.0" and owner are set in frontmatter
 * 4. Verify history entry is created
 *
 * Feature: 012-spec-version-tracking (Phase 3: User Story 1)
 */
describe("Document Version Tracking - Initialization Flow", () => {
	let testDir: string;
	let testDocumentPath: string;
	let service: IDocumentVersionService;
	let mockContext: ExtensionContext;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = join(tmpdir(), `vscode-version-tracking-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		testDocumentPath = join(testDir, "spec.md");

		// Create mock ExtensionContext with workspace state
		const storage = new Map<string, unknown>();

		mockContext = {
			extensionUri: Uri.parse("file:///mock-extension"),
			subscriptions: [],
			workspaceState: {
				get: vi.fn((key: string, defaultValue?: unknown) =>
					storage.has(key) ? storage.get(key) : defaultValue
				),
				update: vi.fn((key: string, value: unknown) => {
					storage.set(key, value);
					return Promise.resolve();
				}),
				keys: vi.fn(() => Array.from(storage.keys())),
			},
			globalState: {} as any,
			secrets: {} as any,
			asAbsolutePath: vi.fn(),
			extensionPath: "",
			environmentVariableCollection: {} as any,
			extensionMode: 2,
			globalStoragePath: "",
			globalStorageUri: Uri.parse("file:///global"),
			logPath: "",
			logUri: Uri.parse("file:///log"),
			storagePath: "",
			storageUri: Uri.parse("file:///storage"),
		} as unknown as ExtensionContext;

		// Initialize service
		const mockOutputChannel = createMockOutputChannel();
		service = createDocumentVersionService(mockContext, mockOutputChannel);
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should initialize version tracking for a new document", async () => {
		// Arrange: Create a new document with minimal frontmatter
		const initialContent = `---
title: "Test Specification"
status: "draft"
---

# Test Specification

This is a test document.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");

		// Act: Initialize version tracking
		const metadata = await service.initializeVersionTracking(testDocumentPath);

		// Assert: Metadata has version "1.0" and owner
		expect(metadata.version).toBe("1.0");
		expect(metadata.owner).toMatch(EMAIL_PATTERN); // Format: "Name <email>"
		expect(metadata.lastModified).toBeDefined();
		expect(metadata.createdBy).toBe(metadata.owner);

		// Assert: Document frontmatter was updated
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		expect(updatedContent).toMatch(VERSION_1_0_PATTERN);
		expect(updatedContent).toContain("owner:");

		// Assert: Body content was preserved
		expect(updatedContent).toContain("This is a test document.");
	});

	it("should create version history entry on initialization", async () => {
		// Arrange: Create a new document
		const initialContent = `---
title: "Test Specification"
---

# Content
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");

		// Act: Initialize version tracking
		await service.initializeVersionTracking(testDocumentPath);

		// Assert: History entry was created
		const history = await service.getVersionHistory(testDocumentPath);

		expect(history).toHaveLength(1);
		expect(history[0].previousVersion).toBe("");
		expect(history[0].newVersion).toBe("1.0");
		expect(history[0].changeType).toBe("initialization");
		expect(history[0].documentPath).toBe(testDocumentPath);
		expect(history[0].author).toMatch(EMAIL_PATTERN);
	});

	it("should retrieve metadata after initialization", async () => {
		// Arrange: Create and initialize document
		const initialContent = `---
title: "Test Specification"
---

# Content
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");
		await service.initializeVersionTracking(testDocumentPath);

		// Act: Retrieve metadata
		const metadata = await service.getDocumentMetadata(testDocumentPath);

		// Assert: Metadata was stored and can be retrieved
		expect(metadata).toBeDefined();
		expect(metadata?.version).toBe("1.0");
		expect(metadata?.owner).toMatch(EMAIL_PATTERN);
		expect(metadata?.createdBy).toBe(metadata?.owner);
	});

	it("should preserve existing frontmatter fields during initialization", async () => {
		// Arrange: Create document with multiple frontmatter fields
		const initialContent = `---
title: "Complex Spec"
status: "draft"
author: "Original Author"
tags:
  - feature
  - important
priority: "high"
---

# Complex Spec

Content here.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");

		// Act: Initialize version tracking
		await service.initializeVersionTracking(testDocumentPath);

		// Assert: All original fields are preserved
		const updatedContent = await readFile(testDocumentPath, "utf-8");

		expect(updatedContent).toContain("title: Complex Spec");
		expect(updatedContent).toContain("status: draft");
		expect(updatedContent).toContain("author: Original Author");
		expect(updatedContent).toContain("- feature");
		expect(updatedContent).toContain("- important");
		expect(updatedContent).toContain("priority: high");

		// And new version/owner fields are added
		expect(updatedContent).toMatch(VERSION_1_0_PATTERN);
		expect(updatedContent).toContain("owner:");
	});

	it("should handle documents without frontmatter", async () => {
		// Arrange: Create document without frontmatter
		const initialContent = `# Test Specification

This document has no frontmatter.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");

		// Act: Initialize version tracking
		const metadata = await service.initializeVersionTracking(testDocumentPath);

		// Assert: Version tracking was initialized
		expect(metadata.version).toBe("1.0");
		expect(metadata.owner).toMatch(EMAIL_PATTERN);

		// Assert: Frontmatter was created
		const updatedContent = await readFile(testDocumentPath, "utf-8");

		expect(updatedContent).toContain("---");
		expect(updatedContent).toMatch(VERSION_1_0_PATTERN);
		expect(updatedContent).toContain("owner:");

		// Body content preserved
		expect(updatedContent).toContain("This document has no frontmatter.");
	});
});

/**
 * Integration tests for Document Version Tracking feature (User Story 2).
 *
 * Tests the automatic version increment flow:
 * 1. Edit existing document → save → version increments
 * 2. Rapid saves are blocked by debounce (30s)
 * 3. Version overflow: 1.9 → 2.0
 * 4. Manual version changes are respected
 *
 * Feature: 012-spec-version-tracking (Phase 4: User Story 2)
 */
describe("Document Version Tracking - Auto Increment Flow", () => {
	let testDir: string;
	let testDocumentPath: string;
	let service: IDocumentVersionService;
	let mockContext: ExtensionContext;

	// Helper function to create a mock TextDocument for processDocumentSave
	const createMockTextDocument = async (
		fsPath: string
	): Promise<TextDocument> => {
		const content = await readFile(fsPath, "utf-8");
		return {
			uri: Uri.file(fsPath),
			fileName: fsPath,
			isUntitled: false,
			languageId: "markdown",
			version: 1,
			isDirty: false,
			isClosed: false,
			save: vi.fn().mockResolvedValue(true) as any,
			eol: 1,
			lineCount: content.split("\n").length,
			lineAt: vi.fn() as any,
			offsetAt: vi.fn() as any,
			positionAt: vi.fn() as any,
			getText: vi.fn(() => content),
			getWordRangeAtPosition: vi.fn() as any,
			validateRange: vi.fn() as any,
			validatePosition: vi.fn() as any,
		} as unknown as TextDocument;
	};

	beforeEach(async () => {
		// Create temporary test directory
		testDir = join(tmpdir(), `vscode-version-tracking-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		testDocumentPath = join(testDir, "spec.md");

		// Create mock ExtensionContext with workspace state
		const storage = new Map<string, unknown>();

		mockContext = {
			extensionUri: Uri.parse("file:///mock-extension"),
			subscriptions: [],
			workspaceState: {
				get: vi.fn((key: string, defaultValue?: unknown) =>
					storage.has(key) ? storage.get(key) : defaultValue
				),
				update: vi.fn((key: string, value: unknown) => {
					storage.set(key, value);
					return Promise.resolve();
				}),
				keys: vi.fn(() => Array.from(storage.keys())),
			},
			globalState: {} as any,
			secrets: {} as any,
			asAbsolutePath: vi.fn(),
			extensionPath: "",
			environmentVariableCollection: {} as any,
			extensionMode: 2,
			globalStoragePath: "",
			globalStorageUri: Uri.parse("file:///global"),
			logPath: "",
			logUri: Uri.parse("file:///log"),
			storagePath: "",
			storageUri: Uri.parse("file:///storage"),
		} as unknown as ExtensionContext;

		// Initialize service
		const mockOutputChannel = createMockOutputChannel();
		service = createDocumentVersionService(mockContext, mockOutputChannel);
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	// T025: Integration test for save flow
	it("should increment version when document is saved with body content change", async () => {
		// Arrange: Create and initialize document with version "1.0"
		const initialContent = `---
version: "1.0"
owner: "Test User <test@example.com>"
title: "Test Specification"
---

# Test Specification

Initial content.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");

		// Initialize version tracking to establish baseline
		await service.initializeVersionTracking(testDocumentPath);

		// Act: Modify body content and trigger save event
		const modifiedContent = `---
version: "1.0"
owner: "Test User <test@example.com>"
title: "Test Specification"
---

# Test Specification

Modified content with new information.
`;

		await writeFile(testDocumentPath, modifiedContent, "utf-8");
		const mockDocument = await createMockTextDocument(testDocumentPath);
		await service.processDocumentSave(mockDocument);

		// Assert: Version should be incremented to "1.1"
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("1.1");
		expect(parsed.data.owner).toMatch(EMAIL_PATTERN);

		// Assert: History entry was created
		const history = await service.getVersionHistory(testDocumentPath);
		const lastEntry = history.at(-1);

		expect(lastEntry.previousVersion).toBe("1.0");
		expect(lastEntry.newVersion).toBe("1.1");
		expect(lastEntry.changeType).toBe("auto-increment");
	});

	it("should block rapid saves with debounce (30s)", async () => {
		// Arrange: Create and initialize document
		const initialContent = `---
version: "1.5"
owner: "Test User <test@example.com>"
title: "Test Specification"
---

# Test

Content version 1.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");
		// Initialize version tracking to establish baseline
		await service.initializeVersionTracking(testDocumentPath);
		// Act: First save (should increment)
		let modifiedContent = `---
version: "1.5"
owner: "Test User <test@example.com>"
title: "Test Specification"
---

# Test

Content version 2.
`;
		await writeFile(testDocumentPath, modifiedContent, "utf-8");
		let mockDocument = await createMockTextDocument(testDocumentPath);
		await service.processDocumentSave(mockDocument);

		// Assert: First save incremented version
		let updatedContent = await readFile(testDocumentPath, "utf-8");
		let parsed = matter(updatedContent);
		expect(parsed.data.version).toBe("1.6");

		// Act: Second save immediately after (should be blocked by debounce)
		modifiedContent = `---
version: "1.6"
owner: "Test User <test@example.com>"
title: "Test Specification"
---

# Test

Content version 3.
`;
		await writeFile(testDocumentPath, modifiedContent, "utf-8");
		mockDocument = await createMockTextDocument(testDocumentPath);
		await service.processDocumentSave(mockDocument);

		// Assert: Version should still be "1.6" (blocked by debounce)
		updatedContent = await readFile(testDocumentPath, "utf-8");
		parsed = matter(updatedContent);
		expect(parsed.data.version).toBe("1.6");

		// Assert: History should have only one entry for this test
		const history = await service.getVersionHistory(testDocumentPath);
		const autoIncrementEntries = history.filter(
			(entry) => entry.changeType === "auto-increment"
		);
		expect(autoIncrementEntries.length).toBe(1);
	});

	it("should not increment version for frontmatter-only changes", async () => {
		// Arrange: Create and initialize document
		const initialContent = `---
version: "2.0"
owner: "Test User <test@example.com>"
title: "Test Specification"
status: "draft"
---

# Test

Body content unchanged.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");

		// Initialize version tracking to establish baseline
		await service.initializeVersionTracking(testDocumentPath);

		// Act: Modify only frontmatter (change status)
		const modifiedContent = `---
version: "2.0"
owner: "Test User <test@example.com>"
title: "Test Specification"
status: "review"
---

# Test

Body content unchanged.
`;

		await writeFile(testDocumentPath, modifiedContent, "utf-8");
		const mockDocument = await createMockTextDocument(testDocumentPath);
		await service.processDocumentSave(mockDocument);

		// Assert: Version should remain "2.0" (no body content change)
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);
		expect(parsed.data.version).toBe("2.0");
	});

	// T026: Integration test for version overflow
	it("should transition from 1.9 to 2.0 on version overflow", async () => {
		// Arrange: Create document with version "1.9"
		const initialContent = `---
version: "1.9"
owner: "Test User <test@example.com>"
title: "Version Overflow Test"
---

# Version Overflow Test

Content before overflow.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");

		// Initialize version tracking to establish baseline
		await service.initializeVersionTracking(testDocumentPath);

		// Act: Modify content and trigger save (should trigger overflow: 1.9 → 2.0)
		const modifiedContent = `---
version: "1.9"
owner: "Test User <test@example.com>"
title: "Version Overflow Test"
---

# Version Overflow Test

Content after overflow.
`;

		await writeFile(testDocumentPath, modifiedContent, "utf-8");
		const mockDocument = await createMockTextDocument(testDocumentPath);
		await service.processDocumentSave(mockDocument);

		// Assert: Version should be "2.0"
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("2.0");

		// Assert: History entry shows overflow transition
		const history = await service.getVersionHistory(testDocumentPath);
		const lastEntry = history.at(-1);

		expect(lastEntry.previousVersion).toBe("1.9");
		expect(lastEntry.newVersion).toBe("2.0");
	});

	it("should continue incrementing after version overflow", async () => {
		// Arrange: Create document with version "2.0" (just after overflow)
		const initialContent = `---
version: "2.0"
owner: "Test User <test@example.com>"
title: "Post-Overflow Test"
---

# Post-Overflow Test

Content at 2.0.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");
		// Initialize version tracking to establish baseline
		await service.initializeVersionTracking(testDocumentPath);
		// Act: Modify and save (should increment to 2.1)
		const modifiedContent = `---
version: "2.0"
owner: "Test User <test@example.com>"
title: "Post-Overflow Test"
---

# Post-Overflow Test

Content at 2.1.
`;

		await writeFile(testDocumentPath, modifiedContent, "utf-8");
		const mockDocument = await createMockTextDocument(testDocumentPath);
		await service.processDocumentSave(mockDocument);

		// Assert: Version should be "2.1"
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("2.1");
	});

	// T027: Integration test for manual version changes
	it("should respect manual version changes and continue incrementing from new base", async () => {
		// Arrange: Create document with version "1.2"
		const initialContent = `---
version: "1.2"
owner: "Test User <test@example.com>"
title: "Manual Version Test"
---

# Manual Version Test

Content at 1.2.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");
		// Initialize version tracking to establish baseline
		await service.initializeVersionTracking(testDocumentPath);
		// Act: User manually changes version to "5.7" in frontmatter
		const manuallyChangedContent = `---
version: "5.7"
owner: "Test User <test@example.com>"
title: "Manual Version Test"
---

# Manual Version Test

Content at 5.7 (manually set).
`;

		await writeFile(testDocumentPath, manuallyChangedContent, "utf-8");

		// Wait briefly to ensure manual change is registered
		// (In real usage, this would be a separate user action)
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Act: Modify body content and trigger save (should increment from 5.7 to 5.8)
		const modifiedContent = `---
version: "5.7"
owner: "Test User <test@example.com>"
title: "Manual Version Test"
---

# Manual Version Test

Content at 5.8 (auto-incremented from manual base).
`;

		await writeFile(testDocumentPath, modifiedContent, "utf-8");
		const mockDocument = await createMockTextDocument(testDocumentPath);
		await service.processDocumentSave(mockDocument);

		// Assert: Version should be "5.8" (incremented from manual 5.7)
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("5.8");

		// Assert: History entry shows increment from manual base
		const history = await service.getVersionHistory(testDocumentPath);
		const lastEntry = history.at(-1);

		expect(lastEntry.previousVersion).toBe("5.7");
		expect(lastEntry.newVersion).toBe("5.8");
		expect(lastEntry.changeType).toBe("auto-increment");
	});

	it("should normalize malformed manual versions before incrementing", async () => {
		// Arrange: Create document with version "1.5"
		const initialContent = `---
version: "1.5"
owner: "Test User <test@example.com>"
title: "Malformed Version Test"
---

# Malformed Version Test

Content before malformation.
`;

		await writeFile(testDocumentPath, initialContent, "utf-8");

		// Act: User manually sets malformed version "2.10" (should normalize to "3.0")
		const malformedContent = `---
version: "2.10"
owner: "Test User <test@example.com>"
title: "Malformed Version Test"
---

# Malformed Version Test

Content with malformed version.
`;

		await writeFile(testDocumentPath, malformedContent, "utf-8");

		// Wait briefly
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Act: Modify and save (should normalize 2.10 → 3.0, then increment to 3.1)
		const modifiedContent = `---
version: "2.10"
owner: "Test User <test@example.com>"
title: "Malformed Version Test"
---

# Malformed Version Test

Content after normalization and increment.
`;

		await writeFile(testDocumentPath, modifiedContent, "utf-8");
		const mockDocument = await createMockTextDocument(testDocumentPath);
		await service.processDocumentSave(mockDocument);

		// Assert: Version should be normalized + incremented
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		// 2.10 normalizes to 3.0, then increments to 3.1
		expect(parsed.data.version).toBe("3.1");
	});
});

/**
 * Integration tests for Document Version Tracking feature (User Story 3).
 *
 * Tests the post-processing architecture and template updateability:
 * 1. Simulate SpecKit template changes
 * 2. Create new spec from updated template
 * 3. Verify version tracking still works without template modifications
 *
 * Feature: 012-spec-version-tracking (Phase 5: User Story 3)
 */
describe("Document Version Tracking - Template Updateability", () => {
	let testDir: string;
	let templateDir: string;
	let testDocumentPath: string;
	let service: IDocumentVersionService;
	let mockContext: ExtensionContext;

	// Helper function to create a mock TextDocument
	const createMockTextDocument = async (
		fsPath: string
	): Promise<TextDocument> => {
		const content = await readFile(fsPath, "utf-8");
		return {
			uri: Uri.file(fsPath),
			fileName: fsPath,
			isUntitled: false,
			languageId: "markdown",
			version: 1,
			isDirty: false,
			isClosed: false,
			save: vi.fn().mockResolvedValue(true) as any,
			eol: 1,
			lineCount: content.split("\n").length,
			lineAt: vi.fn() as any,
			offsetAt: vi.fn() as any,
			positionAt: vi.fn() as any,
			getText: vi.fn(() => content),
			getWordRangeAtPosition: vi.fn() as any,
			validateRange: vi.fn() as any,
			validatePosition: vi.fn() as any,
		} as unknown as TextDocument;
	};

	beforeEach(async () => {
		// Create temporary test directory
		testDir = join(tmpdir(), `vscode-version-tracking-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		// Create mock template directory
		templateDir = join(testDir, ".specify", "templates");
		await mkdir(templateDir, { recursive: true });

		testDocumentPath = join(testDir, "specs", "001-test", "spec.md");
		await mkdir(join(testDir, "specs", "001-test"), { recursive: true });

		// Create mock ExtensionContext with workspace state
		const storage = new Map<string, unknown>();

		mockContext = {
			extensionUri: Uri.parse("file:///mock-extension"),
			subscriptions: [],
			workspaceState: {
				get: vi.fn((key: string, defaultValue?: unknown) =>
					storage.has(key) ? storage.get(key) : defaultValue
				),
				update: vi.fn((key: string, value: unknown) => {
					storage.set(key, value);
					return Promise.resolve();
				}),
				keys: vi.fn(() => Array.from(storage.keys())),
			},
			globalState: {} as any,
			secrets: {} as any,
			asAbsolutePath: vi.fn(),
			extensionPath: "",
			environmentVariableCollection: {} as any,
			extensionMode: 2,
			globalStoragePath: "",
			globalStorageUri: Uri.parse("file:///global"),
			logPath: "",
			logUri: Uri.parse("file:///log"),
			storagePath: "",
			storageUri: Uri.parse("file:///storage"),
		} as unknown as ExtensionContext;

		// Initialize service
		const mockOutputChannel = createMockOutputChannel();
		service = createDocumentVersionService(mockContext, mockOutputChannel);
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	// T031: Integration test for template updateability
	it("should work with updated SpecKit templates without modifying them", async () => {
		// Arrange: Create initial template (Version 1)
		const templateV1 = `---
title: "[Feature Title]"
status: "draft"
---

# [Feature Title]

## Description

Describe your feature here.
`;

		const templatePath = join(templateDir, "spec-template.md");
		await writeFile(templatePath, templateV1, "utf-8");

		// Act: Create a new spec from template V1
		const specFromV1 = `---
title: "Test Feature A"
status: "draft"
---

# Test Feature A

## Description

This is test feature A created from template V1.
`;

		await writeFile(testDocumentPath, specFromV1, "utf-8");

		// Initialize version tracking for spec created from V1
		await service.initializeVersionTracking(testDocumentPath);

		// Assert: Version tracking works with V1 template
		let metadata = await service.getDocumentMetadata(testDocumentPath);
		expect(metadata?.version).toBe("1.0");
		expect(metadata?.owner).toMatch(EMAIL_PATTERN);

		// Assert: Template file was NOT modified
		const templateV1AfterInit = await readFile(templatePath, "utf-8");
		expect(templateV1AfterInit).toBe(templateV1); // Template unchanged

		// Act: Simulate SpecKit template update (Version 2 with new fields)
		const templateV2 = `---
title: "[Feature Title]"
status: "draft"
priority: "medium"
tags: []
---

# [Feature Title]

## Description

Describe your feature here.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
`;

		await writeFile(templatePath, templateV2, "utf-8");

		// Act: Create a new spec from updated template V2
		const specFromV2Path = join(testDir, "specs", "002-test", "spec.md");
		await mkdir(join(testDir, "specs", "002-test"), { recursive: true });

		const specFromV2 = `---
title: "Test Feature B"
status: "draft"
priority: "high"
tags:
  - important
---

# Test Feature B

## Description

This is test feature B created from template V2.

## Acceptance Criteria

- [ ] Implement feature B
- [ ] Add tests for feature B
`;

		await writeFile(specFromV2Path, specFromV2, "utf-8");

		// Initialize version tracking for spec created from V2
		await service.initializeVersionTracking(specFromV2Path);

		// Assert: Version tracking works with V2 template (new fields)
		metadata = await service.getDocumentMetadata(specFromV2Path);
		expect(metadata?.version).toBe("1.0");
		expect(metadata?.owner).toMatch(EMAIL_PATTERN);

		// Assert: Spec has version/owner fields
		const specV2Content = await readFile(specFromV2Path, "utf-8");
		expect(specV2Content).toMatch(VERSION_1_0_PATTERN);
		expect(specV2Content).toContain("owner:");

		// Assert: Original spec fields from V2 template are preserved
		expect(specV2Content).toContain("priority: high");
		expect(specV2Content).toContain("- important");

		// Assert: Template V2 file was NOT modified
		const templateV2AfterInit = await readFile(templatePath, "utf-8");
		expect(templateV2AfterInit).toBe(templateV2); // Template unchanged

		// Act: Test auto-increment still works after template update
		const modifiedSpecV2 = `---
title: "Test Feature B"
status: "draft"
priority: "high"
tags:
  - important
version: "1.0"
owner: "Test User <test@example.com>"
---

# Test Feature B

## Description

This is test feature B with modified content.

## Acceptance Criteria

- [ ] Implement feature B
- [ ] Add tests for feature B
- [ ] Deploy to production
`;

		await writeFile(specFromV2Path, modifiedSpecV2, "utf-8");
		const mockDocument = await createMockTextDocument(specFromV2Path);
		await service.processDocumentSave(mockDocument);

		// Assert: Auto-increment works (version should be 1.1)
		const incrementedContent = await readFile(specFromV2Path, "utf-8");
		const parsed = matter(incrementedContent);

		expect(parsed.data.version).toBe("1.1");
	});

	it("should initialize version tracking regardless of template structure changes", async () => {
		// Arrange: Create template with minimal frontmatter (just title)
		const minimalTemplate = `---
title: "[Minimal Template]"
---

# Content
`;

		const templatePath = join(templateDir, "spec-template.md");
		await writeFile(templatePath, minimalTemplate, "utf-8");

		// Act: Create spec from minimal template
		const specContent = `---
title: "Minimal Spec"
---

# Minimal Spec Content
`;

		await writeFile(testDocumentPath, specContent, "utf-8");

		// Initialize version tracking
		await service.initializeVersionTracking(testDocumentPath);

		// Assert: Version tracking initialized successfully
		const metadata = await service.getDocumentMetadata(testDocumentPath);
		expect(metadata?.version).toBe("1.0");
		expect(metadata?.owner).toMatch(EMAIL_PATTERN);

		// Assert: Spec has version/owner added
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		expect(updatedContent).toMatch(VERSION_1_0_PATTERN);
		expect(updatedContent).toContain("owner:");

		// Assert: Template remains unchanged
		const templateAfter = await readFile(templatePath, "utf-8");
		expect(templateAfter).toBe(minimalTemplate);
	});

	it("should handle templates with complex YAML structures", async () => {
		// Arrange: Create template with complex frontmatter
		const complexTemplate = `---
title: "[Complex Feature]"
metadata:
  created: "2026-01-29"
  team: "Platform"
  stakeholders:
    - name: "Alice"
      role: "PM"
    - name: "Bob"
      role: "Engineer"
dependencies:
  - feature-001
  - feature-002
---

# Complex Feature
`;

		const templatePath = join(templateDir, "spec-template.md");
		await writeFile(templatePath, complexTemplate, "utf-8");

		// Act: Create spec from complex template
		const specContent = `---
title: "Complex Feature Implementation"
metadata:
  created: "2026-01-29"
  team: "Platform"
  stakeholders:
    - name: "Alice"
      role: "PM"
    - name: "Bob"
      role: "Engineer"
dependencies:
  - feature-001
  - feature-002
---

# Complex Feature Implementation
`;

		await writeFile(testDocumentPath, specContent, "utf-8");

		// Initialize version tracking
		await service.initializeVersionTracking(testDocumentPath);

		// Assert: Version tracking works with complex YAML
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("1.0");
		expect(parsed.data.owner).toMatch(EMAIL_PATTERN);

		// Assert: Complex YAML structure preserved
		expect(parsed.data.metadata.team).toBe("Platform");
		expect(parsed.data.metadata.stakeholders).toHaveLength(2);
		expect(parsed.data.dependencies).toEqual(["feature-001", "feature-002"]);

		// Assert: Template unchanged
		const templateAfter = await readFile(templatePath, "utf-8");
		expect(templateAfter).toBe(complexTemplate);
	});
});

/**
 * Integration test for Reset Document Version Command (Phase 7).
 *
 * Tests the complete reset flow:
 * 1. Document has version >1.0 with history
 * 2. Reset command resets version to 1.0
 * 3. Verify history entry with changeType = "reset"
 * 4. Verify frontmatter updated correctly
 *
 * Feature: 012-spec-version-tracking (Phase 7: T037-T040)
 */
describe("Document Version Tracking - Reset Command", () => {
	let testDir: string;
	let testDocumentPath: string;
	let service: IDocumentVersionService;
	let mockContext: ExtensionContext;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = join(tmpdir(), `vscode-version-reset-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		testDocumentPath = join(testDir, "spec.md");

		// Create mock ExtensionContext with workspace state
		const storage = new Map<string, unknown>();

		mockContext = {
			extensionUri: Uri.parse("file:///mock-extension"),
			subscriptions: [],
			workspaceState: {
				get: vi.fn((key: string, defaultValue?: unknown) =>
					storage.has(key) ? storage.get(key) : defaultValue
				),
				update: vi.fn((key: string, value: unknown) => {
					storage.set(key, value);
					return Promise.resolve();
				}),
				keys: vi.fn(() => Array.from(storage.keys())),
			},
			globalState: {} as any,
			secrets: {} as any,
			asAbsolutePath: vi.fn(),
			extensionPath: "",
			environmentVariableCollection: {} as any,
			extensionMode: 2,
			globalStoragePath: "",
			globalStorageUri: Uri.parse("file:///global"),
			logPath: "",
			logUri: Uri.parse("file:///log"),
			storagePath: "",
			storageUri: Uri.parse("file:///storage"),
		} as unknown as ExtensionContext;

		// Initialize service
		const mockOutputChannel = createMockOutputChannel();
		service = createDocumentVersionService(mockContext, mockOutputChannel);
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should reset document version from 2.5 to 1.0", async () => {
		// Arrange: Create document with version 2.5
		const content = `---
title: "Test Specification"
status: "active"
version: "2.5"
owner: "Test User <test@example.com>"
---

# Test Specification

This document has version 2.5.
`;

		await writeFile(testDocumentPath, content, "utf-8");

		// Act: Reset version to 1.0
		await service.resetDocumentVersion(testDocumentPath);

		// Assert: Version is now 1.0
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("1.0");
		expect(parsed.data.owner).toMatch(EMAIL_PATTERN);

		// Assert: History entry created with changeType = "reset"
		const history = await service.getVersionHistory(testDocumentPath);
		expect(history).toHaveLength(1);
		expect(history[0].previousVersion).toBe("2.5");
		expect(history[0].newVersion).toBe("1.0");
		expect(history[0].changeType).toBe("reset");
		expect(history[0].author).toMatch(EMAIL_PATTERN);
	});

	it("should reset document version from 1.5 to 1.0", async () => {
		// Arrange: Create document with version 1.5
		const content = `---
title: "Another Test"
version: "1.5"
owner: "Original Owner <original@example.com>"
---

# Another Test
`;

		await writeFile(testDocumentPath, content, "utf-8");

		// Act: Reset
		await service.resetDocumentVersion(testDocumentPath);

		// Assert: Version is now 1.0
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("1.0");

		// Assert: History shows reset from 1.5 → 1.0
		const history = await service.getVersionHistory(testDocumentPath);
		expect(history[0].previousVersion).toBe("1.5");
		expect(history[0].newVersion).toBe("1.0");
		expect(history[0].changeType).toBe("reset");
	});

	it("should handle reset when document already at version 1.0", async () => {
		// Arrange: Document already at 1.0
		const content = `---
version: "1.0"
owner: "Test User <test@example.com>"
---

# Test
`;

		await writeFile(testDocumentPath, content, "utf-8");

		// Act: Reset (should be idempotent)
		await service.resetDocumentVersion(testDocumentPath);

		// Assert: Still version 1.0
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("1.0");

		// Assert: History entry created even when version unchanged
		const history = await service.getVersionHistory(testDocumentPath);
		expect(history).toHaveLength(1);
		expect(history[0].previousVersion).toBe("1.0");
		expect(history[0].newVersion).toBe("1.0");
		expect(history[0].changeType).toBe("reset");
	});

	it("should preserve other frontmatter fields when resetting", async () => {
		// Arrange: Document with complex frontmatter
		const content = `---
title: "Important Spec"
status: "review"
version: "3.2"
owner: "Old Owner <old@example.com>"
tags:
  - critical
  - security
metadata:
  priority: high
  reviewers: ["Alice", "Bob"]
---

# Important Spec
`;

		await writeFile(testDocumentPath, content, "utf-8");

		// Act: Reset version
		await service.resetDocumentVersion(testDocumentPath);

		// Assert: Version reset but other fields preserved
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("1.0");
		expect(parsed.data.title).toBe("Important Spec");
		expect(parsed.data.status).toBe("review");
		expect(parsed.data.tags).toEqual(["critical", "security"]);
		expect(parsed.data.metadata.priority).toBe("high");
		expect(parsed.data.metadata.reviewers).toEqual(["Alice", "Bob"]);
	});

	it("should update owner to current Git user when resetting", async () => {
		// Arrange: Document with old owner
		const content = `---
version: "2.0"
owner: "Previous Developer <prev@example.com>"
---

# Test
`;

		await writeFile(testDocumentPath, content, "utf-8");

		// Act: Reset
		await service.resetDocumentVersion(testDocumentPath);

		// Assert: Owner updated to current Git user
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("1.0");
		expect(parsed.data.owner).toMatch(EMAIL_PATTERN);
		expect(parsed.data.owner).not.toBe("Previous Developer <prev@example.com>");
	});

	it("should handle reset for document without version field", async () => {
		// Arrange: Document missing version field
		const content = `---
title: "Uninitialized Document"
---

# Test
`;

		await writeFile(testDocumentPath, content, "utf-8");

		// Act: Reset (should initialize if no version present)
		await service.resetDocumentVersion(testDocumentPath);

		// Assert: Version set to 1.0
		const updatedContent = await readFile(testDocumentPath, "utf-8");
		const parsed = matter(updatedContent);

		expect(parsed.data.version).toBe("1.0");
		expect(parsed.data.owner).toMatch(EMAIL_PATTERN);

		// Assert: History shows initialization (previous version empty or "0.0")
		const history = await service.getVersionHistory(testDocumentPath);
		expect(history).toHaveLength(1);
		expect(history[0].newVersion).toBe("1.0");
		expect(history[0].changeType).toBe("reset");
	});
});
