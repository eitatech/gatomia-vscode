/**
 * RetryAction — retry / open-in-provider / dispatch-again buttons shown
 * inside an ErrorChatMessage when the error is retryable (research §R9).
 */

import type { ErrorChatMessage } from "@/features/agent-chat/types";

interface RetryActionProps {
	readonly message: ErrorChatMessage;
	readonly session: {
		readonly source: "acp" | "cloud";
		readonly externalUrl?: string;
	};
	readonly onRetry: () => void;
	readonly onOpenExternal: () => void;
	readonly onRedispatch: () => void;
}

export function RetryAction({
	message,
	session,
	onRetry,
	onOpenExternal,
	onRedispatch,
}: RetryActionProps): JSX.Element | null {
	if (!message.retryable) {
		return null;
	}

	if (session.source === "cloud") {
		return (
			<div className="agent-chat-retry-action">
				{session.externalUrl ? (
					<button
						aria-label="Open in provider"
						onClick={onOpenExternal}
						type="button"
					>
						Open in provider
					</button>
				) : null}
				<button
					aria-label="Dispatch again"
					onClick={onRedispatch}
					type="button"
				>
					Dispatch again
				</button>
			</div>
		);
	}

	return (
		<div className="agent-chat-retry-action">
			<button aria-label="Retry" onClick={onRetry} type="button">
				Retry
			</button>
		</div>
	);
}
