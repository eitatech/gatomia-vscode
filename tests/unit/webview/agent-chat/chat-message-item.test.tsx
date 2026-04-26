/**
 * ChatMessageItem tests (T021).
 *
 * TDD: red before T029.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatMessageItem } from "@/features/agent-chat/components/chat-message-item";
import type { ChatMessage } from "@/features/agent-chat/types";

const ENDED_SHUTDOWN_RE = /ended because VS Code closed/i;
const QUEUED_RE = /queued/i;
const REJECTED_RE = /rejected/i;
const READ_ONLY_SESSION_RE = /read-only session/i;

afterEach(() => {
	cleanup();
});

function userMessage(
	overrides: Partial<ChatMessage> & { id: string }
): ChatMessage {
	return {
		id: overrides.id,
		sessionId: "s-1",
		timestamp: 1000,
		sequence: 0,
		role: "user",
		content: "hello",
		isInitialPrompt: false,
		deliveryStatus: "delivered",
		...overrides,
	} as ChatMessage;
}

describe("ChatMessageItem", () => {
	it("renders user content", () => {
		render(
			<ChatMessageItem
				message={userMessage({ id: "u-1", content: "from user" })}
			/>
		);
		expect(screen.getByText("from user")).toBeInTheDocument();
	});

	it("renders agent content with the agent role", () => {
		render(
			<ChatMessageItem
				message={{
					id: "a-1",
					sessionId: "s-1",
					timestamp: 1000,
					sequence: 1,
					role: "agent",
					content: "agent reply",
					turnId: "t-1",
					isTurnComplete: true,
				}}
			/>
		);
		expect(screen.getByText("agent reply")).toBeInTheDocument();
	});

	it("renders system-message content", () => {
		render(
			<ChatMessageItem
				message={{
					id: "s-1",
					sessionId: "s-1",
					timestamp: 1000,
					sequence: 2,
					role: "system",
					kind: "ended-by-shutdown",
					content: "Session ended because VS Code closed.",
				}}
			/>
		);
		expect(screen.getByText(ENDED_SHUTDOWN_RE)).toBeInTheDocument();
	});

	it("renders error-message content with category", () => {
		render(
			<ChatMessageItem
				message={{
					id: "e-1",
					sessionId: "s-1",
					timestamp: 1000,
					sequence: 3,
					role: "error",
					content: "network dropped",
					category: "cloud-disconnected",
					retryable: true,
				}}
			/>
		);
		expect(screen.getByText("network dropped")).toBeInTheDocument();
	});

	it("renders deliveryStatus badge for user messages (queued)", () => {
		render(
			<ChatMessageItem
				message={userMessage({
					id: "u-queued",
					deliveryStatus: "queued",
				})}
			/>
		);
		expect(screen.getByText(QUEUED_RE)).toBeInTheDocument();
	});

	it("renders deliveryStatus badge for user messages (rejected) with reason", () => {
		render(
			<ChatMessageItem
				message={userMessage({
					id: "u-reject",
					deliveryStatus: "rejected",
					rejectionReason: "read-only session",
				})}
			/>
		);
		expect(screen.getByText(REJECTED_RE)).toBeInTheDocument();
		expect(screen.getByText(READ_ONLY_SESSION_RE)).toBeInTheDocument();
	});

	it("wraps user content in a dedicated bubble div for the new layout", () => {
		// Phase 2 redesign: user messages render inside a `__bubble`
		// element so we can apply the soft right-aligned pill from the
		// mockup. The test pins the structure so future refactors stay
		// honest.
		const { container } = render(
			<ChatMessageItem
				message={userMessage({ id: "u-bubble", content: "ping" })}
			/>
		);
		const bubble = container.querySelector(".agent-chat-message__bubble");
		expect(bubble).not.toBeNull();
		expect(bubble?.textContent).toContain("ping");
	});

	it("renders an avatar dot before agent content", () => {
		// The avatar is purely decorative (aria-hidden) but must be in
		// the DOM so CSS can colour it; the testid lets the test catch
		// regressions if it gets removed.
		render(
			<ChatMessageItem
				message={{
					id: "a-avatar",
					sessionId: "s-1",
					timestamp: 1000,
					sequence: 1,
					role: "agent",
					content: "with avatar",
					turnId: "t-1",
					isTurnComplete: true,
				}}
			/>
		);
		expect(screen.getByTestId("agent-avatar")).toBeInTheDocument();
	});

	it("uses the status modifier class on tool messages so the dot can be styled", () => {
		// Tool calls show a coloured dot keyed off the `status` modifier
		// (pending → blue pulse, succeeded → green, failed → red). The
		// CSS lives in `app.css`; the component's only job is to emit
		// the matching className.
		const { container } = render(
			<ChatMessageItem
				message={{
					id: "t-1",
					sessionId: "s-1",
					timestamp: 1000,
					sequence: 4,
					role: "tool",
					toolCallId: "tc-1",
					title: "Run lint",
					status: "succeeded",
				}}
			/>
		);
		const dot = container.querySelector(".agent-chat-message__tool-dot");
		expect(dot).not.toBeNull();
		expect(dot?.className).toContain("agent-chat-message__tool-dot--succeeded");
	});
});
