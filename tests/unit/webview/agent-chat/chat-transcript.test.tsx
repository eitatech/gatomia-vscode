/**
 * ChatTranscript tests (T020).
 *
 * TDD: red before T028.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatTranscript } from "@/features/agent-chat/components/chat-transcript";
import type { ChatMessage } from "@/features/agent-chat/types";

afterEach(() => {
	cleanup();
});

function makeMessages(count: number): ChatMessage[] {
	const out: ChatMessage[] = [];
	for (let i = 0; i < count; i += 1) {
		out.push({
			id: `m-${i}`,
			sessionId: "s-1",
			timestamp: i,
			sequence: i,
			role: i % 2 === 0 ? "agent" : "user",
			content: `message ${i}`,
			...(i % 2 === 0
				? { turnId: `t-${i}`, isTurnComplete: true }
				: { isInitialPrompt: false, deliveryStatus: "delivered" as const }),
		} as ChatMessage);
	}
	return out;
}

describe("ChatTranscript", () => {
	it("renders each message in the list", () => {
		render(<ChatTranscript messages={makeMessages(3)} />);
		expect(screen.getByText("message 0")).toBeInTheDocument();
		expect(screen.getByText("message 1")).toBeInTheDocument();
		expect(screen.getByText("message 2")).toBeInTheDocument();
	});

	it("renders an empty state when messages is empty", () => {
		render(<ChatTranscript messages={[]} />);
		// No error thrown; the container renders without crashing.
		expect(
			document.querySelector(".agent-chat-transcript")
		).toBeInTheDocument();
	});

	it("does not lose messages during chunk bursts (200 messages)", () => {
		// Simulate a large burst — virtualized list should still accept the full
		// dataset without throwing and expose every message via getAllByText.
		const big = makeMessages(200);
		render(<ChatTranscript messages={big} />);
		// We just ensure a representative sampling is present.
		expect(screen.getByText("message 0")).toBeInTheDocument();
		expect(screen.getByText("message 199")).toBeInTheDocument();
	});
});
