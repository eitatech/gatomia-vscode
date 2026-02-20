import { vscode } from "@/bridge/vscode";
import { useCallback, useEffect, useState } from "react";
import type { ACPAgentDescriptor } from "../types";

const IS_ACP_AGENTS_MESSAGE = (type: string | undefined): boolean =>
	type === "hooks/acp-agents-available" ||
	type === "hooks.acp-agents-available";

/**
 * Custom hook for fetching discoverable local ACP agents from the extension.
 *
 * Sends a `hooks/acp-agents-request` message on mount and listens for the
 * `hooks/acp-agents-available` response. Returns an empty list on error.
 */
export const useAcpAgents = (): ACPAgentDescriptor[] => {
	const [agents, setAgents] = useState<ACPAgentDescriptor[]>([]);

	const request = useCallback(() => {
		vscode.postMessage({
			type: "hooks/acp-agents-request",
			command: "hooks.acp-agents-request",
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

			if (!IS_ACP_AGENTS_MESSAGE(messageType as string | undefined)) {
				return;
			}

			const discovered = (payload as Record<string, unknown>).agents;
			if (Array.isArray(discovered)) {
				setAgents(discovered as ACPAgentDescriptor[]);
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

	return agents;
};
