import { vscode } from "@/bridge/vscode";
import { useCallback, useEffect, useState } from "react";
import type { KnownAgentStatus } from "../types";

const IS_KNOWN_AGENTS_STATUS = (type: string | undefined): boolean =>
	type === "hooks/acp-known-agents-status" ||
	type === "hooks.acp-known-agents-status";

/**
 * Custom hook for managing the known-agent checklist.
 *
 * On mount, sends `hooks/acp-known-agents-request` to the extension and
 * listens for `hooks/acp-known-agents-status` responses.
 *
 * Exposes a `toggle` callback that:
 * 1. Updates the local `agents` state **immediately** (optimistic update) so
 *    the checkbox reflects the new value without waiting for the extension
 *    round-trip (which includes shell-based binary detection).
 * 2. Sends `hooks/acp-known-agents-toggle` to the extension so the pref is
 *    persisted and a confirmed status message is sent back.
 */
export const useKnownAcpAgents = (): {
	agents: KnownAgentStatus[];
	toggle: (agentId: string, enabled: boolean) => void;
} => {
	const [agents, setAgents] = useState<KnownAgentStatus[]>([]);

	const request = useCallback(() => {
		vscode.postMessage({
			type: "hooks/acp-known-agents-request",
			command: "hooks.acp-known-agents-request",
		});
	}, []);

	const toggle = useCallback((agentId: string, enabled: boolean) => {
		// Optimistic update: flip the enabled flag locally right away so the
		// checkbox does not appear to freeze while waiting for the extension.
		setAgents((prev) =>
			prev.map((a) => (a.id === agentId ? { ...a, enabled } : a))
		);

		vscode.postMessage({
			type: "hooks/acp-known-agents-toggle",
			command: "hooks.acp-known-agents-toggle",
			agentId,
			enabled,
		});
	}, []);

	useEffect(() => {
		const handleMessage = (event: MessageEvent<Record<string, unknown>>) => {
			const payload = event.data;
			if (!payload || typeof payload !== "object") {
				return;
			}

			const messageType =
				(payload as Record<string, unknown>).type ??
				(payload as Record<string, unknown>).command;

			if (!IS_KNOWN_AGENTS_STATUS(messageType as string | undefined)) {
				return;
			}

			const incoming = (payload as Record<string, unknown>).agents;
			if (Array.isArray(incoming)) {
				setAgents(incoming as KnownAgentStatus[]);
			}
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, []);

	useEffect(() => {
		request();
	}, [request]);

	return { agents, toggle };
};
