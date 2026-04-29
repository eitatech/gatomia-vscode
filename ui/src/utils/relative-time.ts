/**
 * Render a unix-millis timestamp as a short relative-time label
 * (`just now`, `5m ago`, `3h ago`, `2d ago`, `1 wk ago`).
 *
 * Originally lived in `welcome/components/status-section.tsx`. Promoted to a
 * shared util so the agent-chat sidebar history list can render the same
 * format without duplicating the formula.
 *
 * The string format is intentionally compact (`5m ago` rather than
 * `5 minutes ago`) so it stays readable inside narrow sidebar rows.
 */
export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60_000) {
		return "just now";
	}

	const minutes = Math.floor(diff / 60_000);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}

	const hours = Math.floor(diff / 3_600_000);
	if (hours < 24) {
		return `${hours}h ago`;
	}

	const days = Math.floor(diff / 86_400_000);
	if (days < 7) {
		return `${days}d ago`;
	}

	const weeks = Math.floor(days / 7);
	return `${weeks} wk ago`;
}
