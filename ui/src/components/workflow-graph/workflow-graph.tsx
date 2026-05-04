import {
	Background,
	Controls,
	ReactFlow,
	type Edge,
	type Node,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type React from "react";
import { workflowNodeTypes } from "./nodes";

interface WorkflowGraphProps {
	nodes: Node[];
	edges: Edge[];
	onNodesChange?: OnNodesChange;
	onEdgesChange?: OnEdgesChange;
	onConnect?: OnConnect;
	onNodeClick?: (event: React.MouseEvent, node: Node) => void;
	readonly?: boolean;
}

export function WorkflowGraph({
	nodes,
	edges,
	onNodesChange,
	onEdgesChange,
	onConnect,
	onNodeClick,
	readonly = false,
}: WorkflowGraphProps) {
	return (
		<div className="h-full w-full overflow-hidden rounded-[var(--workflow-panel-radius)] border border-[color:var(--workflow-panel-border-color)] bg-[color:var(--workflow-panel-muted-background)]">
			<ReactFlow
				edges={edges}
				elementsSelectable={!readonly}
				fitView
				nodes={nodes}
				nodesConnectable={!readonly}
				nodesDraggable={!readonly}
				nodeTypes={workflowNodeTypes}
				onConnect={onConnect}
				onEdgesChange={onEdgesChange}
				onNodeClick={onNodeClick}
				onNodesChange={onNodesChange}
			>
				<Background
					color="var(--vscode-descriptionForeground)"
					gap={16}
					size={1}
				/>
				<Controls className="!bg-[color:var(--vscode-editor-background)] !border-[color:var(--workflow-panel-border-color)] fill-[color:var(--vscode-foreground)]" />
			</ReactFlow>
		</div>
	);
}
