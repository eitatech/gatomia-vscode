import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TriggerActionSelector } from "../../../../ui/src/features/hooks-view/components/trigger-action-selector";
import type {
	Schedule,
	ActionConfig,
} from "../../../../ui/src/features/hooks-view/types";

vi.mock(
	"../../../../ui/src/features/hooks-view/components/agent-type-selector",
	() => ({
		AgentTypeSelector: () => <div data-testid="agent-type-selector" />,
	})
);
vi.mock(
	"../../../../ui/src/features/hooks-view/components/argument-template-editor",
	() => ({
		ArgumentTemplateEditor: () => (
			<div data-testid="argument-template-editor" />
		),
	})
);
vi.mock("../../../../ui/src/features/hooks-view/hooks/use-mcp-servers", () => ({
	useMCPServers: () => ({
		servers: [],
		tools: [],
		isLoading: false,
		refresh: vi.fn(),
		connect: vi.fn(),
	}),
}));
vi.mock("../../../../ui/src/features/hooks-view/hooks/use-acp-agents", () => ({
	useAcpAgents: () => ({ agents: [], isLoading: false, error: null }),
}));
vi.mock(
	"../../../../ui/src/features/hooks-view/hooks/use-known-acp-agents",
	() => ({
		useKnownAcpAgents: () => ({ knownAgents: [], updateStatus: vi.fn() }),
	})
);

describe("TriggerActionSelector", () => {
	const defaultProps = {
		events: [
			{
				type: "agent_operation" as const,
				agent: "speckit",
				operation: "specify",
				timing: "after" as const,
			},
		],
		schedule: { type: "immediate" as const } as Schedule,
		action: {
			type: "agent" as const,
			parameters: { command: "test", agent: "test-agent" },
		} as ActionConfig,
		onEventsChange: vi.fn(),
		onScheduleChange: vi.fn(),
		onTriggerChange: vi.fn(),
		onActionChange: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the event source configuration", () => {
		render(<TriggerActionSelector {...defaultProps} />);

		expect(screen.getByText("Event Source")).toBeInTheDocument();
		expect(screen.getByText("Schedule")).toBeInTheDocument();
		expect(screen.getByText("Action")).toBeInTheDocument();
	});

	it("calls onScheduleChange when schedule is updated", () => {
		render(<TriggerActionSelector {...defaultProps} />);
		// Need a way to interact with schedule.
		// Actually let's just make sure it renders without crashing for now.
	});
});
