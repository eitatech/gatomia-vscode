import { describe, it, expect } from "vitest";
import {
	mapDevinApiStatusToSessionStatus,
	resolveSessionStatus,
	isTerminalStatus,
} from "../../../../src/features/devin/status-mapper";
import {
	DevinApiStatus,
	SessionStatus,
} from "../../../../src/features/devin/types";

describe("mapDevinApiStatusToSessionStatus", () => {
	it("maps 'new' to INITIALIZING", () => {
		expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.NEW)).toBe(
			SessionStatus.INITIALIZING
		);
	});

	it("maps 'claimed' to INITIALIZING", () => {
		expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.CLAIMED)).toBe(
			SessionStatus.INITIALIZING
		);
	});

	it("maps 'running' to RUNNING", () => {
		expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.RUNNING)).toBe(
			SessionStatus.RUNNING
		);
	});

	it("maps 'resuming' to RUNNING", () => {
		expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.RESUMING)).toBe(
			SessionStatus.RUNNING
		);
	});

	it("maps 'exit' to COMPLETED", () => {
		expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.EXIT)).toBe(
			SessionStatus.COMPLETED
		);
	});

	it("maps 'error' to FAILED", () => {
		expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.ERROR)).toBe(
			SessionStatus.FAILED
		);
	});

	it("maps 'suspended' to RUNNING", () => {
		expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.SUSPENDED)).toBe(
			SessionStatus.RUNNING
		);
	});

	it("maps unknown status to RUNNING as fallback", () => {
		expect(mapDevinApiStatusToSessionStatus("unknown_status" as any)).toBe(
			SessionStatus.RUNNING
		);
	});
});

describe("resolveSessionStatus", () => {
	it("prefers statusDetail 'finished' over base status 'suspended'", () => {
		expect(resolveSessionStatus("suspended", "finished")).toBe(
			SessionStatus.COMPLETED
		);
	});

	it("prefers statusDetail 'blocked' over base status 'running'", () => {
		expect(resolveSessionStatus("running", "blocked")).toBe(
			SessionStatus.BLOCKED
		);
	});

	it("maps statusDetail 'waiting_for_user' to BLOCKED", () => {
		expect(resolveSessionStatus("running", "waiting_for_user")).toBe(
			SessionStatus.BLOCKED
		);
	});

	it("maps statusDetail 'working' to RUNNING", () => {
		expect(resolveSessionStatus("suspended", "working")).toBe(
			SessionStatus.RUNNING
		);
	});

	it("maps statusDetail 'error' to FAILED", () => {
		expect(resolveSessionStatus("running", "error")).toBe(SessionStatus.FAILED);
	});

	it("falls back to base status when statusDetail is undefined", () => {
		expect(resolveSessionStatus("running", undefined)).toBe(
			SessionStatus.RUNNING
		);
	});

	it("falls back to base status when statusDetail is unknown", () => {
		expect(resolveSessionStatus("running", "some_unknown_detail")).toBe(
			SessionStatus.RUNNING
		);
	});

	it("returns RUNNING as default when both status and detail are unknown", () => {
		expect(resolveSessionStatus("unknown", "unknown_detail")).toBe(
			SessionStatus.RUNNING
		);
	});
});

describe("isTerminalStatus", () => {
	it("returns true for COMPLETED", () => {
		expect(isTerminalStatus(SessionStatus.COMPLETED)).toBe(true);
	});

	it("returns true for FAILED", () => {
		expect(isTerminalStatus(SessionStatus.FAILED)).toBe(true);
	});

	it("returns true for CANCELLED", () => {
		expect(isTerminalStatus(SessionStatus.CANCELLED)).toBe(true);
	});

	it("returns false for RUNNING", () => {
		expect(isTerminalStatus(SessionStatus.RUNNING)).toBe(false);
	});

	it("returns false for INITIALIZING", () => {
		expect(isTerminalStatus(SessionStatus.INITIALIZING)).toBe(false);
	});

	it("returns false for QUEUED", () => {
		expect(isTerminalStatus(SessionStatus.QUEUED)).toBe(false);
	});
});
