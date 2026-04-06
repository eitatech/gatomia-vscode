/**
 * Mock Provider Adapter
 *
 * Reusable mock provider fixture for testing extensibility.
 * Demonstrates how a third-party developer would implement the
 * CloudAgentProvider interface.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 */

import { vi } from "vitest";
import type { CloudAgentProvider } from "../../src/features/cloud-agents/cloud-agent-provider";
import type {
	AgentSession,
	ProviderAction,
	ProviderMetadata,
	SessionContext,
	SessionUpdate,
	SpecTask,
} from "../../src/features/cloud-agents/types";

/**
 * Creates a fully functional mock provider that satisfies the CloudAgentProvider contract.
 * All methods are Vitest mocks with sensible defaults.
 *
 * @param id - Provider ID (default: "mock-provider")
 * @param overrides - Partial overrides for specific methods
 */
export function createMockProviderAdapter(
	id = "mock-provider",
	overrides: Partial<CloudAgentProvider> = {}
): CloudAgentProvider {
	const metadata: ProviderMetadata = {
		id,
		displayName: `Mock ${id}`,
		description: `A mock provider for testing (${id})`,
		icon: "beaker",
		...overrides.metadata,
	};

	return {
		metadata,
		hasCredentials: vi.fn().mockResolvedValue(true),
		configureCredentials: vi.fn().mockResolvedValue(true),
		createSession: vi.fn(
			(task: SpecTask, context: SessionContext): Promise<AgentSession> => {
				const now = Date.now();
				const localId = `${id}-${now}`;
				return Promise.resolve({
					localId,
					providerId: id,
					providerSessionId: `ext-${localId}`,
					status: "pending",
					branch: context.branch,
					specPath: context.specPath,
					tasks: [
						{
							id: `task-${localId}`,
							specTaskId: task.id,
							title: task.title,
							description: task.description,
							priority: task.priority,
							status: "pending",
						},
					],
					pullRequests: [],
					createdAt: now,
					updatedAt: now,
					completedAt: undefined,
					isReadOnly: false,
				});
			}
		),
		cancelSession: vi.fn().mockResolvedValue(undefined),
		pollSessions: vi.fn().mockResolvedValue([] as SessionUpdate[]),
		getExternalUrl: vi.fn((session: AgentSession) => session.externalUrl),
		getStatusDisplay: vi.fn((session: AgentSession) => session.status),
		handleBlockedSession: vi.fn(
			(session: AgentSession): ProviderAction | null => {
				if (session.externalUrl) {
					return { type: "openUrl", url: session.externalUrl };
				}
				return null;
			}
		),
		handleSessionComplete: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}
