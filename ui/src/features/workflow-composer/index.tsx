import { Button } from "@/components/ui/button";
import { ActionToolbar, PanelSection } from "@/components/workflow";
import { WorkflowGraph } from "@/components/workflow-graph";
import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import { useCallback, useState } from "react";
import { vscode } from "../../bridge/vscode";

const INITIAL_NODES: Node[] = [
	{
		id: "source-1",
		type: "source",
		position: { x: 250, y: 50 },
		data: {
			label: "Github Webhook",
			status: "active",
			description: "Listens for push events",
		},
	},
	{
		id: "condition-1",
		type: "condition",
		position: { x: 250, y: 200 },
		data: { label: "Branch is main", description: "Only run on main branch" },
	},
	{
		id: "action-1",
		type: "action",
		position: { x: 250, y: 350 },
		data: {
			label: "Run Build",
			status: "success",
			description: "Executes npm run build",
		},
	},
];

const INITIAL_EDGES: Edge[] = [
	{ id: "e1-2", source: "source-1", target: "condition-1" },
	{ id: "e2-3", source: "condition-1", target: "action-1" },
];

export function WorkflowComposerFeature(): JSX.Element {
	const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
	const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);

	const onNodesChange = useCallback(
		(changes: NodeChange[]) =>
			setNodes((nds) => applyNodeChanges(changes, nds)),
		[]
	);
	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) =>
			setEdges((eds) => applyEdgeChanges(changes, eds)),
		[]
	);
	const onConnect = useCallback(
		(params: Connection) => setEdges((eds) => addEdge(params, eds)),
		[]
	);

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
						<Button
							onClick={() =>
								vscode.postMessage({ type: "workflow-composer/save" })
							}
							size="sm"
							type="button"
						>
							Save Workflow
						</Button>
					</ActionToolbar>
				</div>
			</PanelSection>

			<div className="flex-1 p-4">
				<WorkflowGraph
					edges={edges}
					nodes={nodes}
					onConnect={onConnect}
					onEdgesChange={onEdgesChange}
					onNodesChange={onNodesChange}
				/>
			</div>
		</div>
	);
}
