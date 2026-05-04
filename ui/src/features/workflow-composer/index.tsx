import { Button } from "@/components/ui/button";
import { ActionToolbar, PanelSection } from "@/components/workflow";
import { WorkflowGraph } from "@/components/workflow-graph";
import {
	applyEdgeChanges,
	applyNodeChanges,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import { vscode } from "../../bridge/vscode";
import type {
	Hook,
	HooksExtensionMessage,
	HooksWebviewMessage,
} from "../hooks-view/types";
import { mapHooksToGraph } from "./utils/mapper";
import { HookForm } from "../hooks-view/components/hook-form";

export function WorkflowComposerFeature(): JSX.Element {
	const [hooks, setHooks] = useState<Hook[]>([]);
	const [nodes, setNodes] = useState<Node[]>([]);
	const [edges, setEdges] = useState<Edge[]>([]);

	const [selectedHookId, setSelectedHookId] = useState<string | undefined>();
	const selectedHook = hooks.find((h) => h.id === selectedHookId);

	const sendMessage = useCallback((message: HooksWebviewMessage) => {
		const command =
			message.command ?? (message.type?.replace(/\//g, ".") as string);
		vscode.postMessage({ ...message, command });
	}, []);

	useEffect(() => {
		const handleMessage = (event: MessageEvent<HooksExtensionMessage>) => {
			const payload = event.data;
			if (!payload || typeof payload !== "object") {
				return;
			}
			const messageType = payload.type ?? payload.command;
			const body = (payload as any).payload ?? (payload as any).data;

			if (messageType === "hooks/sync" || messageType === "hooks.sync") {
				const syncedHooks = Array.isArray(body?.hooks) ? body.hooks : [];
				setHooks(syncedHooks);
				const graph = mapHooksToGraph(syncedHooks);
				setNodes(graph.nodes);
				setEdges(graph.edges);
			}
		};

		window.addEventListener("message", handleMessage);
		sendMessage({ type: "hooks/ready" });
		sendMessage({ type: "hooks/list" });
		return () => window.removeEventListener("message", handleMessage);
	}, [sendMessage]);

	const onNodesChange = useCallback((changes: NodeChange[]) => {
		setNodes((nds) => applyNodeChanges(changes, nds));
	}, []);

	const onEdgesChange = useCallback((changes: EdgeChange[]) => {
		setEdges((eds) => applyEdgeChanges(changes, eds));
	}, []);

	const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
		const hookId = node.data?.hookId as string;
		if (hookId) {
			setSelectedHookId(hookId);
		}
	}, []);

	const handleFormSubmit = useCallback(
		(
			hookData: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount" | "lastExecutedAt"
			>
		) => {
			if (selectedHookId) {
				sendMessage({
					type: "hooks/update",
					payload: { id: selectedHookId, updates: hookData },
				});
				// We don't automatically close, maybe we can if desired, but hooks/sync will refresh the graph
			} else {
				sendMessage({
					type: "hooks/create",
					payload: hookData,
				});
				setSelectedHookId(undefined);
			}
		},
		[selectedHookId, sendMessage]
	);

	const handleFormCancel = useCallback(() => {
		setSelectedHookId(undefined);
	}, []);

	const handleCreateNew = useCallback(() => {
		setSelectedHookId("new");
	}, []);

	return (
		<div className="flex h-screen flex-col bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)]">
			<PanelSection
				as="header"
				className="shrink-0"
				padding="relaxed"
				variant="elevated"
			>
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-semibold text-xl">Workflow Composer</h1>
						<p className="mt-1 text-[color:var(--vscode-descriptionForeground)] text-sm">
							Visually edit your orchestration hooks and triggers.
						</p>
					</div>
					<ActionToolbar align="end">
						<Button onClick={handleCreateNew} size="sm" type="button">
							New Hook
						</Button>
					</ActionToolbar>
				</div>
			</PanelSection>

			<div className="flex flex-1 overflow-hidden">
				<div className="flex-1 p-4">
					<WorkflowGraph
						edges={edges}
						nodes={nodes}
						onEdgesChange={onEdgesChange}
						onNodeClick={onNodeClick}
						onNodesChange={onNodesChange}
					/>
				</div>

				{selectedHookId && (
					<div className="w-[400px] overflow-y-auto border-[color:var(--workflow-panel-border-color)] border-l bg-[color:var(--workflow-panel-background)] p-4">
						<HookForm
							initialData={selectedHook}
							mode={selectedHook ? "edit" : "create"}
							onCancel={handleFormCancel}
							onSubmit={handleFormSubmit}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
