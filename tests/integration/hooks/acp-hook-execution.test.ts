/**
 * Integration Test: ACP Hook End-to-End Execution (T050)
 *
 * TDD: tests written BEFORE implementation. All tests should FAIL initially.
 *
 * Tests that:
 * 1. ACPActionExecutor spawns the subprocess
 * 2. Completes the ACP JSON-RPC protocol handshake
 * 3. Captures agent output in the result
 * 4. Output is exposed as $acpAgentOutput via TemplateContext
 *
 * @see src/features/hooks/actions/acp-action.ts
 * @see src/features/hooks/template-variable-parser.ts
 * @feature 001-hooks-refactor Phase 6
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ACPActionParams } from "../../../src/features/hooks/types";
import type { TemplateContext } from "../../../src/features/hooks/template-variable-parser";

// ---------------------------------------------------------------------------
// Mock child_process.spawn for integration test
// ---------------------------------------------------------------------------

const { mockStdin, mockStdout, mockStderr, mockChildProcess } = vi.hoisted(
	() => {
		const mockStdinInner = { write: vi.fn(), end: vi.fn() };
		const mockStdoutInner = { on: vi.fn() };
		const mockStderrInner = { on: vi.fn() };
		const mockChildProcessInner = {
			stdin: mockStdinInner,
			stdout: mockStdoutInner,
			stderr: mockStderrInner,
			on: vi.fn(),
			pid: 99_999,
			kill: vi.fn(),
		};
		return {
			mockStdin: mockStdinInner,
			mockStdout: mockStdoutInner,
			mockStderr: mockStderrInner,
			mockChildProcess: mockChildProcessInner,
		};
	}
);

vi.mock("node:child_process", () => ({
	default: { spawn: vi.fn(() => mockChildProcess) },
	spawn: vi.fn(() => mockChildProcess),
}));

import { ACPActionExecutor } from "../../../src/features/hooks/actions/acp-action";
import { TemplateVariableParser } from "../../../src/features/hooks/template-variable-parser";

// ---------------------------------------------------------------------------
// Protocol simulation helpers
// ---------------------------------------------------------------------------

/** Flushes the microtask queue so pending promises can resolve. */
async function flushMicrotasks(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

/**
 * Drives the ACP JSON-RPC protocol by firing stdout events in order.
 * Must be awaited — interleaves microtask flushes between each protocol step
 * so ACPActionExecutor's async runProtocol() registers each pendingResolver
 * before the corresponding response is sent.
 */
async function driveProtocol(chunks: string[]): Promise<void> {
	const calls: unknown[][] = mockStdout.on.mock.calls;
	const entry = calls.find((c: unknown[]) => c[0] === "data");
	const listener = entry?.[1] as ((d: Buffer) => void) | undefined;
	if (!listener) {
		return;
	}

	// Flush so runProtocol() reaches sendRequest("initialize")
	await flushMicrotasks();

	// 1. initialize response
	listener(
		Buffer.from(
			`${JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				result: {
					protocolVersion: "0.14",
					serverInfo: { name: "integration-agent" },
				},
			})}\n`
		)
	);

	// Flush so runProtocol() proceeds to sendRequest("session/new")
	await flushMicrotasks();

	// 2. session/new response
	listener(
		Buffer.from(
			`${JSON.stringify({
				jsonrpc: "2.0",
				id: 2,
				result: { sessionId: "integration-sess" },
			})}\n`
		)
	);

	// Flush so runProtocol() proceeds to sendRequest("session/prompt")
	await flushMicrotasks();

	// 3. Output chunk notifications — BEFORE session/prompt response
	// (implementation checks outputChunks.length after prompt resolves)
	for (const chunk of chunks) {
		listener(
			Buffer.from(
				`${JSON.stringify({
					jsonrpc: "2.0",
					method: "session/update",
					params: { type: "agent_message_chunk", content: chunk },
				})}\n`
			)
		);
	}

	// 4. session/prompt response (end_turn)
	listener(
		Buffer.from(
			`${JSON.stringify({
				jsonrpc: "2.0",
				id: 3,
				result: { stopReason: "end_turn" },
			})}\n`
		)
	);

	await flushMicrotasks();
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("ACP Hook End-to-End (integration)", () => {
	let executor: ACPActionExecutor;
	let parser: TemplateVariableParser;

	const params: ACPActionParams = {
		mode: "local",
		agentCommand: "npx integration-agent --acp",
		agentDisplayName: "Integration Agent",
		taskInstruction: "Summarize the spec for branch $branch",
	};

	const baseContext: TemplateContext = {
		timestamp: "2026-02-18T10:00:00Z",
		triggerType: "specify",
		branch: "001-hooks-refactor",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockStdin.write.mockReset();
		mockStdout.on.mockReset();
		mockStderr.on.mockReset();
		mockChildProcess.on.mockReset();
		executor = new ACPActionExecutor();
		parser = new TemplateVariableParser();
	});

	// -----------------------------------------------------------------------
	// Core protocol flow
	// -----------------------------------------------------------------------

	describe("protocol handshake", () => {
		it("completes a full initialize → session/new → session/prompt flow", async () => {
			const promise = executor.execute(params, baseContext);
			await driveProtocol(["The spec is about hooks."]);
			const result = await promise;

			expect(result.output).toBe("The spec is about hooks.");
			expect(result.stopReason).toBe("end_turn");
		});

		it("accumulates multiple output chunks into single output string", async () => {
			const promise = executor.execute(params, baseContext);
			await driveProtocol(["Part 1. ", "Part 2. ", "Part 3."]);
			const result = await promise;

			expect(result.output).toBe("Part 1. Part 2. Part 3.");
		});

		it("sends taskInstruction with $branch expanded to context value", async () => {
			const promise = executor.execute(params, baseContext);
			await driveProtocol(["ok"]);
			await promise;

			const writeCalls: string[] = mockStdin.write.mock.calls.map(
				(c: unknown[]) => String(c[0])
			);
			const promptCall = writeCalls
				.map((s: string) => {
					try {
						return JSON.parse(s.trim());
					} catch {
						return null;
					}
				})
				.find(
					(m: { method?: string } | null) => m?.method === "session/prompt"
				);

			expect(JSON.stringify(promptCall)).toContain("001-hooks-refactor");
			expect(JSON.stringify(promptCall)).not.toContain("$branch");
		});
	});

	// -----------------------------------------------------------------------
	// $acpAgentOutput in TemplateContext
	// -----------------------------------------------------------------------

	describe("$acpAgentOutput template variable", () => {
		it("substitute() replaces $acpAgentOutput with agent output", () => {
			const contextWithOutput: TemplateContext = {
				...baseContext,
				acpAgentOutput: "Agent produced this summary",
			};

			const template = "Agent said: $acpAgentOutput";
			const result = parser.substitute(template, contextWithOutput);
			expect(result).toBe("Agent said: Agent produced this summary");
		});

		it("substitute() replaces $acpAgentOutput with empty string when absent", () => {
			const template = "Output: $acpAgentOutput";
			const result = parser.substitute(template, baseContext);
			expect(result).toBe("Output: ");
		});

		it("extractVariables() detects $acpAgentOutput in a template", () => {
			const template = "After ACP: $acpAgentOutput and branch $branch";
			const variables = parser.extractVariables(template);
			expect(variables).toContain("acpAgentOutput");
		});
	});

	// -----------------------------------------------------------------------
	// Result shape
	// -----------------------------------------------------------------------

	describe("execution result", () => {
		it("returns durationMs as a positive number", async () => {
			const promise = executor.execute(params, baseContext);
			await driveProtocol(["done"]);
			const result = await promise;
			expect(result.durationMs).toBeGreaterThanOrEqual(0);
		});

		it("returns stopReason matching what the agent returned", async () => {
			const customPromise = executor.execute(
				{ ...params, taskInstruction: "get answer" },
				baseContext
			);

			// Custom protocol drive: use max_tokens instead of end_turn
			const calls: unknown[][] = mockStdout.on.mock.calls;
			const entry = calls.find((c: unknown[]) => c[0] === "data");
			const listener = entry?.[1] as ((d: Buffer) => void) | undefined;

			if (listener) {
				await flushMicrotasks();
				listener(
					Buffer.from(
						`${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "0.14" } })}\n`
					)
				);
				await flushMicrotasks();
				listener(
					Buffer.from(
						`${JSON.stringify({ jsonrpc: "2.0", id: 2, result: { sessionId: "s1" } })}\n`
					)
				);
				await flushMicrotasks();
				// Send chunk BEFORE the session/prompt response
				listener(
					Buffer.from(
						`${JSON.stringify({ jsonrpc: "2.0", method: "session/update", params: { type: "agent_message_chunk", content: "truncated..." } })}\n`
					)
				);
				listener(
					Buffer.from(
						`${JSON.stringify({ jsonrpc: "2.0", id: 3, result: { stopReason: "max_tokens" } })}\n`
					)
				);
				await flushMicrotasks();
			}

			const result = await customPromise;
			expect(result.stopReason).toBe("max_tokens");
		});
	});
});
