/**
 * ToolCallItem tests (T025a).
 * TDD: red before T030.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolCallItem } from "@/features/agent-chat/components/tool-call-item";
import type { ToolCallChatMessage } from "@/features/agent-chat/types";

const PENDING_RE = /pending/i;
const RUNNING_RE = /running/i;
const SUCCEEDED_RE = /succeeded/i;
const FAILED_RE = /failed/i;
const CANCELLED_RE = /cancelled/i;
const FALLBACK_ID_RE = /fallback-id/;

afterEach(() => {
	cleanup();
});

function toolCall(
	overrides: Partial<ToolCallChatMessage> = {}
): ToolCallChatMessage {
	return {
		id: "tc-msg-1",
		sessionId: "s-1",
		timestamp: 1000,
		sequence: 0,
		role: "tool",
		toolCallId: "tc-1",
		title: "Run tests",
		status: "pending",
		...overrides,
	};
}

describe("ToolCallItem", () => {
	it("renders pending status", () => {
		render(<ToolCallItem message={toolCall({ status: "pending" })} />);
		expect(screen.getByText(PENDING_RE)).toBeInTheDocument();
	});

	it("renders running status", () => {
		render(<ToolCallItem message={toolCall({ status: "running" })} />);
		expect(screen.getByText(RUNNING_RE)).toBeInTheDocument();
	});

	it("renders succeeded status", () => {
		render(<ToolCallItem message={toolCall({ status: "succeeded" })} />);
		expect(screen.getByText(SUCCEEDED_RE)).toBeInTheDocument();
	});

	it("renders failed status", () => {
		render(<ToolCallItem message={toolCall({ status: "failed" })} />);
		expect(screen.getByText(FAILED_RE)).toBeInTheDocument();
	});

	it("renders cancelled status", () => {
		render(<ToolCallItem message={toolCall({ status: "cancelled" })} />);
		expect(screen.getByText(CANCELLED_RE)).toBeInTheDocument();
	});

	it("truncates long titles", () => {
		const longTitle = "a".repeat(200);
		render(<ToolCallItem message={toolCall({ title: longTitle })} />);
		// The rendered title should be truncated (ellipsis after some length).
		const titleEl = screen.getByTestId("tool-call-title");
		expect(titleEl.textContent?.length).toBeLessThanOrEqual(120);
	});

	it("falls back to toolCallId when title is missing", () => {
		render(
			<ToolCallItem
				message={toolCall({ title: undefined, toolCallId: "fallback-id" })}
			/>
		);
		expect(screen.getByText(FALLBACK_ID_RE)).toBeInTheDocument();
	});
});
