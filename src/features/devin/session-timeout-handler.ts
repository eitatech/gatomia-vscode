/**
 * Session Timeout Handler
 *
 * Detects sessions that have been stuck in a non-terminal state
 * for too long and provides user notifications.
 *
 * @see specs/001-devin-integration/spec.md (Edge Case: Session stuck)
 */

import { window } from "vscode";
import type { DevinSession } from "./entities";
import { SessionStatus } from "./types";
import { logWarn } from "./logging";

/**
 * Default timeout for sessions in non-terminal states (4 hours in ms).
 */
const DEFAULT_SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;

/**
 * Check a session for timeout and notify the user if needed.
 *
 * @returns true if the session has timed out
 */
export function isSessionTimedOut(
	session: DevinSession,
	timeoutMs = DEFAULT_SESSION_TIMEOUT_MS
): boolean {
	const terminalStates: string[] = [
		SessionStatus.COMPLETED,
		SessionStatus.FAILED,
		SessionStatus.CANCELLED,
	];

	if (terminalStates.includes(session.status)) {
		return false;
	}

	const elapsed = Date.now() - session.updatedAt;
	return elapsed > timeoutMs;
}

/**
 * Check all sessions for timeouts and notify for any stuck sessions.
 */
export async function checkSessionTimeouts(
	sessions: DevinSession[]
): Promise<string[]> {
	const timedOut: string[] = [];

	for (const session of sessions) {
		if (isSessionTimedOut(session)) {
			timedOut.push(session.localId);
			logWarn(
				`Session ${session.localId} appears stuck in '${session.status}' state`
			);
		}
	}

	if (timedOut.length > 0) {
		await window.showWarningMessage(
			`${timedOut.length} Devin session(s) may be stuck. Check the progress panel.`
		);
	}

	return timedOut;
}
