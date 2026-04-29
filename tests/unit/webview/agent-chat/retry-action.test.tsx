/**
 * RetryAction tests (T025b).
 * TDD: red before T033.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetryAction } from "@/features/agent-chat/components/retry-action";
import type { ErrorChatMessage } from "@/features/agent-chat/types";

const RETRY_BUTTON_RE = /retry/i;
const OPEN_IN_PROVIDER_RE = /open in provider/i;
const DISPATCH_AGAIN_RE = /dispatch again/i;

afterEach(() => {
	cleanup();
});

function errorMessage(
	overrides: Partial<ErrorChatMessage> = {}
): ErrorChatMessage {
	return {
		id: "err-1",
		sessionId: "s-1",
		timestamp: 1000,
		sequence: 0,
		role: "error",
		content: "Something failed",
		category: "unknown",
		retryable: true,
		...overrides,
	};
}

describe("RetryAction", () => {
	it("does not render when retryable is false", () => {
		const onRetry = vi.fn();
		render(
			<RetryAction
				message={errorMessage({ retryable: false })}
				onOpenExternal={vi.fn()}
				onRedispatch={vi.fn()}
				onRetry={onRetry}
				session={{ source: "acp" }}
			/>
		);
		expect(screen.queryByRole("button", { name: RETRY_BUTTON_RE })).toBeNull();
	});

	it("renders a Retry button for ACP sessions that calls onRetry", () => {
		const onRetry = vi.fn();
		render(
			<RetryAction
				message={errorMessage()}
				onOpenExternal={vi.fn()}
				onRedispatch={vi.fn()}
				onRetry={onRetry}
				session={{ source: "acp" }}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: RETRY_BUTTON_RE }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("renders Open in provider + Dispatch again for cloud sessions with externalUrl", () => {
		const onOpenExternal = vi.fn();
		const onRedispatch = vi.fn();
		render(
			<RetryAction
				message={errorMessage({ category: "cloud-disconnected" })}
				onOpenExternal={onOpenExternal}
				onRedispatch={onRedispatch}
				onRetry={vi.fn()}
				session={{ source: "cloud", externalUrl: "https://example.dev" }}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: OPEN_IN_PROVIDER_RE }));
		fireEvent.click(screen.getByRole("button", { name: DISPATCH_AGAIN_RE }));
		expect(onOpenExternal).toHaveBeenCalledTimes(1);
		expect(onRedispatch).toHaveBeenCalledTimes(1);
	});
});
