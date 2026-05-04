import type { Edge, Node } from "@xyflow/react";
import type { Hook, EventSource } from "../../hooks-view/types";

const X_SPACING = 300;
const Y_SPACING = 150;

interface MapperContext {
	startY: number;
	currentX: number;
	nodes: Node[];
	edges: Edge[];
	previousNodeIds: string[];
}

function getEvents(hook: Hook): EventSource[] {
	if (hook.events && hook.events.length > 0) {
		return hook.events;
	}
	if (hook.trigger) {
		return [
			{
				type: "agent-operation" as const,
				agent: hook.trigger.agent,
				operation: hook.trigger.operation,
				timing: hook.trigger.timing,
			},
		];
	}
	return [];
}

function connectEdges(edges: Edge[], sourceIds: string[], targetId: string) {
	for (const prevId of sourceIds) {
		edges.push({
			id: `edge-${prevId}-${targetId}`,
			source: prevId,
			target: targetId,
		});
	}
}

function processEvents(hook: Hook, ctx: MapperContext) {
	const events = getEvents(hook);
	for (const [i, event] of events.entries()) {
		const id = `hook-${hook.id}-event-${i}`;
		ctx.previousNodeIds.push(id);
		ctx.nodes.push({
			id,
			type: "source",
			position: { x: ctx.currentX, y: ctx.startY + i * Y_SPACING },
			data: {
				label:
					event.type === "agent-operation"
						? `${event.agent} ${event.operation}`
						: event.type,
				description: `Event source for ${hook.name}`,
				hookId: hook.id,
				nodeType: "event",
				eventIndex: i,
				raw: event,
			},
		});
	}
}

function processConditions(hook: Hook, ctx: MapperContext) {
	if (!hook.conditions || hook.conditions.length === 0) {
		return;
	}

	const conditionIds: string[] = [];
	for (const [i, condition] of hook.conditions.entries()) {
		const id = `hook-${hook.id}-condition-${i}`;
		conditionIds.push(id);
		ctx.nodes.push({
			id,
			type: "condition",
			position: { x: ctx.currentX, y: ctx.startY + i * Y_SPACING },
			data: {
				label: condition.type,
				description:
					condition.pattern ||
					condition.expression ||
					condition.filePath ||
					`Condition ${i + 1}`,
				hookId: hook.id,
				nodeType: "condition",
				conditionIndex: i,
				raw: condition,
			},
		});
		connectEdges(ctx.edges, ctx.previousNodeIds, id);
	}
	ctx.previousNodeIds.length = 0;
	ctx.previousNodeIds.push(...conditionIds);
}

function processSchedule(hook: Hook, ctx: MapperContext) {
	if (!hook.schedule || hook.schedule.type === "immediate") {
		return;
	}

	const id = `hook-${hook.id}-schedule`;
	ctx.nodes.push({
		id,
		type: "schedule",
		position: { x: ctx.currentX, y: ctx.startY },
		data: {
			label: hook.schedule.type,
			description:
				hook.schedule.type === "delayed"
					? `${hook.schedule.delayMs}ms`
					: hook.schedule.cronExpression,
			hookId: hook.id,
			nodeType: "schedule",
			raw: hook.schedule,
		},
	});
	connectEdges(ctx.edges, ctx.previousNodeIds, id);
	ctx.previousNodeIds.length = 0;
	ctx.previousNodeIds.push(id);
}

function processHook(
	hook: Hook,
	hookIndex: number,
	nodes: Node[],
	edges: Edge[]
) {
	const ctx: MapperContext = {
		startY: hookIndex * Y_SPACING * 3,
		currentX: 100,
		nodes,
		edges,
		previousNodeIds: [],
	};

	processEvents(hook, ctx);
	ctx.currentX += X_SPACING;

	processConditions(hook, ctx);
	if (hook.conditions && hook.conditions.length > 0) {
		ctx.currentX += X_SPACING;
	}

	processSchedule(hook, ctx);
	if (hook.schedule && hook.schedule.type !== "immediate") {
		ctx.currentX += X_SPACING;
	}

	const actionId = `hook-${hook.id}-action`;
	ctx.nodes.push({
		id: actionId,
		type: "action",
		position: { x: ctx.currentX, y: ctx.startY },
		data: {
			label: hook.action.type,
			description: hook.name,
			status: hook.enabled ? "active" : "draft",
			hookId: hook.id,
			nodeType: "action",
			raw: hook.action,
		},
	});
	connectEdges(ctx.edges, ctx.previousNodeIds, actionId);
}

export function mapHooksToGraph(hooks: Hook[]): {
	nodes: Node[];
	edges: Edge[];
} {
	const nodes: Node[] = [];
	const edges: Edge[] = [];

	for (const [hookIndex, hook] of hooks.entries()) {
		processHook(hook, hookIndex, nodes, edges);
	}

	return { nodes, edges };
}
