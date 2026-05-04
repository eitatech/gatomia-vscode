import { describe, expect, it } from "vitest";
import { mapHooksToGraph } from "../../../src/features/workflow-composer/utils/mapper";
import type { Hook } from "../../../src/features/hooks-view/types";

describe("Workflow Composer Mapper", () => {
	it("maps an empty array of hooks to empty nodes and edges", () => {
		const { nodes, edges } = mapHooksToGraph([]);
		expect(nodes).toEqual([]);
		expect(edges).toEqual([]);
	});

	it("maps a standard hook with trigger and action to source and action nodes", () => {
		const hooks: Hook[] = [
			{
				id: "hook-1",
				name: "Test Hook",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "git",
					parameters: {
						operation: "commit",
						messageTemplate: "test",
					},
				},
				createdAt: 0,
				modifiedAt: 0,
				executionCount: 0,
			},
		];

		const { nodes, edges } = mapHooksToGraph(hooks);

		expect(nodes).toHaveLength(2); // 1 source, 1 action
		expect(nodes[0].type).toBe("source");
		expect(nodes[0].data.hookId).toBe("hook-1");
		expect(nodes[1].type).toBe("action");
		expect(nodes[1].data.hookId).toBe("hook-1");

		expect(edges).toHaveLength(1);
		expect(edges[0].source).toBe(nodes[0].id);
		expect(edges[0].target).toBe(nodes[1].id);
	});

	it("maps a complex hook with multiple events, conditions, schedule, and action", () => {
		const hooks: Hook[] = [
			{
				id: "hook-2",
				name: "Complex Hook",
				enabled: true,
				events: [
					{ type: "repository", pattern: "main" },
					{ type: "file-change", pattern: "*.ts" },
				],
				conditions: [{ type: "branch", pattern: "main" }],
				schedule: { type: "delayed", delayMs: 1000 },
				action: {
					type: "agent",
					parameters: { command: "test" },
				},
				createdAt: 0,
				modifiedAt: 0,
				executionCount: 0,
			},
		];

		const { nodes, edges } = mapHooksToGraph(hooks);

		// 2 events + 1 condition + 1 schedule + 1 action = 5 nodes
		expect(nodes).toHaveLength(5);
		expect(nodes.filter((n) => n.type === "source")).toHaveLength(2);
		expect(nodes.filter((n) => n.type === "condition")).toHaveLength(1);
		expect(nodes.filter((n) => n.type === "schedule")).toHaveLength(1);
		expect(nodes.filter((n) => n.type === "action")).toHaveLength(1);

		// Edges: 2 events -> 1 condition (2 edges) -> 1 schedule (1 edge) -> 1 action (1 edge) = 4 edges
		expect(edges).toHaveLength(4);
	});
});
