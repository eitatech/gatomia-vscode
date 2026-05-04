import type { NodeTypes } from "@xyflow/react";
import {
	ActionNode,
	ConditionNode,
	ScheduleNode,
	SourceNode,
} from "./base-nodes";

export const workflowNodeTypes: NodeTypes = {
	action: ActionNode,
	source: SourceNode,
	condition: ConditionNode,
	schedule: ScheduleNode,
};
