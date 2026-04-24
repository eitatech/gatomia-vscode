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
});
