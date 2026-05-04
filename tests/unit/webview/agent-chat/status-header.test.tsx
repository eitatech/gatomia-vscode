/**
 * StatusHeader tests (T023).
 * TDD: red before T032.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusHeader } from "@/features/agent-chat/components/status-header";

const INITIALIZING_RE = /initializing/i;
const RUNNING_RE = /running/i;
const WAITING_RE = /waiting/i;
const COMPLETED_RE = /completed/i;
const FAILED_RE = /failed/i;
const CANCELLED_RE = /cancelled/i;
const ENDED_RE = /ended/i;

afterEach(() => {
	cleanup();
});

describe("StatusHeader", () => {
	it("renders agent display name and initializing badge", () => {
		render(
			<StatusHeader agentDisplayName="opencode" lifecycleState="initializing" />
		);
		expect(screen.getByText("opencode")).toBeInTheDocument();
		expect(screen.getByText(INITIALIZING_RE)).toBeInTheDocument();
	});

	it("renders running state", () => {
		render(
			<StatusHeader agentDisplayName="opencode" lifecycleState="running" />
		);
		expect(screen.getByText(RUNNING_RE)).toBeInTheDocument();
	});

	it("renders waiting-for-input state", () => {
		render(
			<StatusHeader
				agentDisplayName="opencode"
				lifecycleState="waiting-for-input"
			/>
		);
		expect(screen.getByText(WAITING_RE)).toBeInTheDocument();
	});

	it("renders completed state", () => {
		render(
			<StatusHeader agentDisplayName="opencode" lifecycleState="completed" />
		);
		expect(screen.getByText(COMPLETED_RE)).toBeInTheDocument();
	});

	it("renders failed state", () => {
		render(
			<StatusHeader agentDisplayName="opencode" lifecycleState="failed" />
		);
		expect(screen.getByText(FAILED_RE)).toBeInTheDocument();
	});

	it("renders cancelled state", () => {
		render(
			<StatusHeader agentDisplayName="opencode" lifecycleState="cancelled" />
		);
		expect(screen.getByText(CANCELLED_RE)).toBeInTheDocument();
	});

	it("renders ended-by-shutdown state", () => {
		render(
			<StatusHeader
				agentDisplayName="opencode"
				lifecycleState="ended-by-shutdown"
			/>
		);
		expect(screen.getByText(ENDED_RE)).toBeInTheDocument();
	});
});
