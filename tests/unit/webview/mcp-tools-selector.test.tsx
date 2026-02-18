import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPToolsSelector } from "../../../ui/src/features/hooks-view/components/mcp-tools-selector";
import { groupToolsByProvider } from "../../../ui/src/features/hooks-view/hooks/use-mcp-servers";
import type { MCPServer } from "../../../ui/src/features/hooks-view/hooks/use-mcp-servers";
import type { SelectedMCPTool } from "../../../ui/src/features/hooks-view/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = vi.fn();
const ALPHA_1_DISPLAY_RE = /alpha-1 Display/i;

function makeTool(
	name: string,
	displayName: string,
	serverId: string
): import("../../../ui/src/features/hooks-view/hooks/use-mcp-servers").MCPTool {
	return {
		name,
		displayName,
		description: `${displayName} description`,
		inputSchema: { type: "object" },
		serverId,
	};
}

function makeServer(id: string, name: string, toolNames: string[]): MCPServer {
	return {
		id,
		name,
		description: `${name} description`,
		status: "available",
		tools: toolNames.map((n) => makeTool(n, `${n} Display`, id)),
		lastDiscovered: 0,
	};
}

// ---------------------------------------------------------------------------
// T026: Unit tests for groupToolsByProvider
// ---------------------------------------------------------------------------

describe("groupToolsByProvider", () => {
	it("returns an empty array when no servers are provided", () => {
		const result = groupToolsByProvider([], []);
		expect(result).toEqual([]);
	});

	it("returns a single group for a single server", () => {
		const servers = [makeServer("srv1", "Alpha Server", ["tool-a", "tool-b"])];
		const result = groupToolsByProvider(servers, []);

		expect(result).toHaveLength(1);
		expect(result[0].serverName).toBe("Alpha Server");
		expect(result[0].serverId).toBe("srv1");
		expect(result[0].tools).toHaveLength(2);
	});

	it("sorts groups alphabetically by serverName", () => {
		const servers = [
			makeServer("srv-z", "Zebra Tools", ["z1"]),
			makeServer("srv-a", "Alpha Tools", ["a1"]),
			makeServer("srv-m", "Mango Tools", ["m1"]),
		];
		const result = groupToolsByProvider(servers, []);

		expect(result.map((g) => g.serverName)).toEqual([
			"Alpha Tools",
			"Mango Tools",
			"Zebra Tools",
		]);
	});

	it("sorts tools alphabetically by toolDisplayName within each group", () => {
		const server: MCPServer = {
			id: "srv1",
			name: "Server",
			description: "",
			status: "available",
			tools: [
				makeTool("z-tool", "Zebra Tool", "srv1"),
				makeTool("a-tool", "Apple Tool", "srv1"),
				makeTool("m-tool", "Mango Tool", "srv1"),
			],
			lastDiscovered: 0,
		};
		const result = groupToolsByProvider([server], []);

		expect(result[0].tools.map((t) => t.toolDisplayName)).toEqual([
			"Apple Tool",
			"Mango Tool",
			"Zebra Tool",
		]);
	});

	it("marks tools as selected when they appear in selectedTools", () => {
		const servers = [makeServer("srv1", "Alpha", ["tool-a", "tool-b"])];
		const selectedTools: SelectedMCPTool[] = [
			{
				serverId: "srv1",
				serverName: "Alpha",
				toolName: "tool-a",
				toolDisplayName: "tool-a Display",
			},
		];
		const result = groupToolsByProvider(servers, selectedTools);

		const toolA = result[0].tools.find((t) => t.toolName === "tool-a");
		const toolB = result[0].tools.find((t) => t.toolName === "tool-b");
		expect(toolA?.isSelected).toBe(true);
		expect(toolB?.isSelected).toBe(false);
	});

	it("places orphaned tools (no matching server) into an 'Other' group at the end", () => {
		const servers = [makeServer("srv1", "Alpha", ["tool-a"])];
		const selectedTools: SelectedMCPTool[] = [
			{
				serverId: "unknown-srv",
				serverName: "Unknown Server",
				toolName: "orphan-tool",
				toolDisplayName: "Orphan Tool",
			},
		];
		const result = groupToolsByProvider(servers, selectedTools);

		// Last group should be "Other"
		const lastGroup = result.at(-1);
		expect(lastGroup?.isOther).toBe(true);
		expect(lastGroup?.serverName).toBe("Other");
		expect(lastGroup?.tools.some((t) => t.toolName === "orphan-tool")).toBe(
			true
		);
	});

	it("does not produce an 'Other' group when all selected tools belong to known servers", () => {
		const servers = [makeServer("srv1", "Alpha", ["tool-a"])];
		const selectedTools: SelectedMCPTool[] = [
			{
				serverId: "srv1",
				serverName: "Alpha",
				toolName: "tool-a",
				toolDisplayName: "tool-a Display",
			},
		];
		const result = groupToolsByProvider(servers, selectedTools);

		expect(result.every((g) => !g.isOther)).toBe(true);
	});

	it("handles multiple servers with some tools selected across servers", () => {
		const servers = [
			makeServer("srv1", "Alpha", ["a1", "a2"]),
			makeServer("srv2", "Beta", ["b1", "b2"]),
		];
		const selectedTools: SelectedMCPTool[] = [
			{
				serverId: "srv1",
				serverName: "Alpha",
				toolName: "a1",
				toolDisplayName: "a1 Display",
			},
			{
				serverId: "srv2",
				serverName: "Beta",
				toolName: "b2",
				toolDisplayName: "b2 Display",
			},
		];
		const result = groupToolsByProvider(servers, selectedTools);

		expect(result).toHaveLength(2);
		const alpha = result.find((g) => g.serverName === "Alpha");
		const beta = result.find((g) => g.serverName === "Beta");

		expect(alpha?.tools.find((t) => t.toolName === "a1")?.isSelected).toBe(
			true
		);
		expect(alpha?.tools.find((t) => t.toolName === "a2")?.isSelected).toBe(
			false
		);
		expect(beta?.tools.find((t) => t.toolName === "b1")?.isSelected).toBe(
			false
		);
		expect(beta?.tools.find((t) => t.toolName === "b2")?.isSelected).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// T027: Snapshot test for MCPToolsSelector grouped rendering with 3 servers
// ---------------------------------------------------------------------------

describe("MCPToolsSelector (grouped rendering)", () => {
	beforeEach(() => {
		(window as { acquireVsCodeApi?: unknown }).acquireVsCodeApi = () => ({
			postMessage: noop,
			getState: noop,
			setState: noop,
		});
	});

	afterEach(() => {
		(window as { acquireVsCodeApi?: unknown }).acquireVsCodeApi = undefined;
	});

	const THREE_SERVERS: MCPServer[] = [
		makeServer("srv-c", "Charlie MCP", ["charlie-1", "charlie-2"]),
		makeServer("srv-a", "Alpha MCP", ["alpha-1"]),
		makeServer("srv-b", "Beta MCP", ["beta-1", "beta-2", "beta-3"]),
	];

	it("renders a group header for each server sorted alphabetically", () => {
		render(
			<MCPToolsSelector
				onSelectionChange={noop}
				selectedTools={[]}
				servers={THREE_SERVERS}
			/>
		);

		// Each server name should appear as a group header
		expect(screen.getByText("Alpha MCP")).toBeInTheDocument();
		expect(screen.getByText("Beta MCP")).toBeInTheDocument();
		expect(screen.getByText("Charlie MCP")).toBeInTheDocument();
	});

	it("renders tool checkboxes for an expanded group", async () => {
		const user = userEvent.setup();

		render(
			<MCPToolsSelector
				onSelectionChange={noop}
				selectedTools={[]}
				servers={THREE_SERVERS}
			/>
		);

		// Expand "Alpha MCP" group
		const alphaHeader = screen.getByText("Alpha MCP");
		await user.click(alphaHeader);

		// Tool should be visible after expanding
		expect(screen.getByText("alpha-1 Display")).toBeInTheDocument();
	});

	it("calls onSelectionChange when a tool checkbox is toggled", async () => {
		const user = userEvent.setup();
		const onSelectionChange = vi.fn();

		render(
			<MCPToolsSelector
				onSelectionChange={onSelectionChange}
				selectedTools={[]}
				servers={[makeServer("srv-a", "Alpha MCP", ["alpha-1"])]}
			/>
		);

		// Expand group first
		await user.click(screen.getByText("Alpha MCP"));

		// Toggle the tool checkbox
		const checkbox = screen.getByRole("checkbox", {
			name: ALPHA_1_DISPLAY_RE,
		});
		await user.click(checkbox);

		expect(onSelectionChange).toHaveBeenCalledOnce();
		const callArg = onSelectionChange.mock.calls[0][0] as SelectedMCPTool[];
		expect(callArg).toHaveLength(1);
		expect(callArg[0].toolName).toBe("alpha-1");
	});

	it("matches snapshot with 3 servers and one selected tool", () => {
		const selectedTools: SelectedMCPTool[] = [
			{
				serverId: "srv-a",
				serverName: "Alpha MCP",
				toolName: "alpha-1",
				toolDisplayName: "alpha-1 Display",
			},
		];

		const { container } = render(
			<MCPToolsSelector
				onSelectionChange={noop}
				selectedTools={selectedTools}
				servers={THREE_SERVERS}
			/>
		);

		expect(container).toMatchSnapshot();
	});
});
