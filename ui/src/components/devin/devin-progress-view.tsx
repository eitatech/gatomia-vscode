/**
 * DevinProgressView Component
 *
 * Main webview component that displays Devin session progress.
 * Connects to the devin-store and sends messages to the extension host.
 */

import { useDevinStore } from "../../stores/devin-store";
import { SessionList } from "./session-list";

declare function acquireVsCodeApi(): {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | undefined;
function getVsCodeApi() {
	if (!vscodeApi) {
		vscodeApi = acquireVsCodeApi();
	}
	return vscodeApi;
}

function postMessage(type: string, payload?: Record<string, unknown>) {
	getVsCodeApi().postMessage({ type, payload });
}

export function DevinProgressView() {
	const { sessions, isLoading } = useDevinStore();

	const handleCancelSession = (localId: string) => {
		postMessage("cancel-session", { localId });
	};

	const handleOpenDevin = (url: string) => {
		postMessage("open-devin", { url });
	};

	const handleOpenPr = (prUrl: string) => {
		postMessage("open-pr", { prUrl });
	};

	const handleRefresh = () => {
		postMessage("refresh-status", {});
	};

	if (isLoading) {
		return (
			<div style={{ padding: "16px", textAlign: "center" }}>
				Loading Devin sessions...
			</div>
		);
	}

	return (
		<div style={{ padding: "8px 16px" }}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "12px",
				}}
			>
				<h2 style={{ margin: 0 }}>Devin Progress</h2>
				<button onClick={handleRefresh} type="button">
					Refresh
				</button>
			</div>
			<SessionList
				onCancelSession={handleCancelSession}
				onOpenDevin={handleOpenDevin}
				onOpenPr={handleOpenPr}
				sessions={sessions}
			/>
		</div>
	);
}
