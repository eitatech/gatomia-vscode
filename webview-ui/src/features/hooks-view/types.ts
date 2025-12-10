// Hook entity types (matching backend data model)

export type AgentType = "speckit" | "openspec";

export type OperationType =
	| "research"
	| "datamodel"
	| "design"
	| "specify"
	| "clarify"
	| "plan"
	| "tasks"
	| "taskstoissues"
	| "analyze"
	| "checklist"
	| "constitution"
	| "implementation"
	| "unit-test"
	| "integration-test";

export type TriggerTiming = "after";

export interface TriggerCondition {
	agent: AgentType;
	operation: OperationType;
	timing: TriggerTiming;
}

export type ActionType = "agent" | "git" | "github" | "custom" | "mcp";

export interface AgentActionParams {
	command: string;
}

export interface GitActionParams {
	operation: "commit" | "push";
	messageTemplate: string;
	pushToRemote?: boolean;
}

export interface GitHubActionParams {
	operation: "open-issue" | "close-issue" | "create-pr" | "add-comment";
	repository?: string;
	titleTemplate?: string;
	bodyTemplate?: string;
	issueNumber?: number;
}

export interface CustomActionParams {
	agentName: string;
	arguments?: string;
}

export interface MCPActionParams {
	serverId: string;
	serverName: string;
	toolName: string;
	toolDisplayName: string;
	parameterMappings?: Array<{
		toolParam: string;
		source: "context" | "literal" | "template";
		value: string;
	}>;
	timeout?: number;
}

export type ActionParameters =
	| AgentActionParams
	| GitActionParams
	| GitHubActionParams
	| CustomActionParams
	| MCPActionParams;

export interface ActionConfig {
	type: ActionType;
	parameters: ActionParameters;
}

export interface Hook {
	id: string;
	name: string;
	enabled: boolean;
	trigger: TriggerCondition;
	action: ActionConfig;
	createdAt: number;
	modifiedAt: number;
	lastExecutedAt?: number;
	executionCount: number;
}

export type HookExecutionStatusState = "executing" | "completed" | "failed";

export interface HookExecutionStatusPayload {
	hookId: string;
	status: HookExecutionStatusState;
	errorMessage?: string;
}

export interface HookExecutionStatusEntry extends HookExecutionStatusPayload {
	updatedAt: number;
}

export type ExecutionStatus = "success" | "failure" | "skipped" | "timeout";

export interface HookExecutionLog {
	id: string;
	hookId: string;
	executionId: string;
	chainDepth: number;
	triggeredAt: number;
	completedAt?: number;
	duration?: number;
	status: ExecutionStatus;
	error?: {
		code?: string;
		message: string;
	};
	contextSnapshot: Record<string, unknown>;
}

// Extension -> Webview messages
export type HooksExtensionMessage =
	| {
			type: "hooks/sync";
			command?: "hooks.sync";
			payload: { hooks: Hook[] };
	  }
	| {
			type: "hooks/created";
			command?: "hooks.created";
			payload: { hook: Hook };
	  }
	| {
			type: "hooks/updated";
			command?: "hooks.updated";
			payload: { hook: Hook };
	  }
	| {
			type: "hooks/deleted";
			command?: "hooks.deleted";
			payload: { id: string };
	  }
	| {
			type: "hooks/error";
			command?: "hooks.error";
			payload: { message: string };
	  }
	| {
			type: "hooks/execution-status";
			command?: "hooks.execution-status";
			payload: HookExecutionStatusPayload;
	  }
	| {
			type: "hooks/logs";
			command?: "hooks.logs";
			payload: { logs: HookExecutionLog[] };
	  }
	| {
			type: "hooks/show-form";
			command?: "hooks.show-form";
			payload?: { mode?: "create" | "edit"; hook?: Hook };
	  }
	| {
			type: "hooks/show-logs";
			command?: "hooks.show-logs";
			payload: { visible: boolean; hookId?: string };
	  };

// Webview -> Extension messages
export type HooksWebviewMessage =
	| { type: "hooks/ready"; command?: "hooks.ready" }
	| { type: "hooks/list"; command?: "hooks.list" }
	| {
			type: "hooks/create";
			command?: "hooks.create";
			payload: Omit<Hook, "id" | "createdAt" | "modifiedAt" | "executionCount">;
	  }
	| {
			type: "hooks/update";
			command?: "hooks.update";
			payload: { id: string; updates: Partial<Hook> };
	  }
	| { type: "hooks/delete"; command?: "hooks.delete"; payload: { id: string } }
	| {
			type: "hooks/toggle";
			command?: "hooks.toggle";
			payload: { id: string; enabled: boolean };
	  }
	| {
			type: "hooks/logs";
			command?: "hooks.logs";
			payload?: { hookId?: string };
	  };
