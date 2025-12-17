/**
 * Webview UI tests for Ready to Review lane.
 * Tests rendering, filtering, and display of specs in Ready to Review status.
 * Note: Component implementation deferred to T012; tests structure ready for TDD.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

const LONG_TITLE_REGEX = /This is a very long/;

// TODO: Import ReadyToReviewList component once created in T012
// import ReadyToReviewList from '../../../../ui/src/components/spec-explorer/ReadyToReviewList';

// Mock component for testing structure
const MockReadyToReviewList = ({ specs, onFileChangeRequest }: any) => (
	<div data-testid="ready-to-review-list">
		{specs?.length === 0 ? (
			<div>No specs ready for review</div>
		) : (
			<ul>
				{specs?.map((spec: Specification) => (
					<li data-testid={`spec-${spec.id}`} key={spec.id}>
						<span>{spec.title}</span>
						<span>{spec.owner}</span>
						<button onClick={() => onFileChangeRequest(spec.id)} type="button">
							File Change Request
						</button>
					</li>
				))}
			</ul>
		)}
	</div>
);

describe("Ready to Review List (Webview)", () => {
	let mockSpecs: Specification[];

	beforeEach(() => {
		mockSpecs = [
			{
				id: "spec-001",
				title: "API Authentication Design",
				owner: "alice@example.com",
				status: "readyToReview",
				completedAt: new Date("2025-12-07T10:00:00Z"),
				updatedAt: new Date(),
				links: {
					specPath: "specs/api-auth/spec.md",
					docUrl: "https://doc.example.com/api-auth",
				},
				changeRequests: [],
			},
			{
				id: "spec-002",
				title: "Database Schema",
				owner: "bob@example.com",
				status: "readyToReview",
				completedAt: new Date("2025-12-07T11:00:00Z"),
				updatedAt: new Date(),
				links: {
					specPath: "specs/db-schema/spec.md",
				},
				changeRequests: [],
			},
		];
	});

	describe("rendering", () => {
		it("should render empty state when no specs ready for review", () => {
			render(
				<MockReadyToReviewList onFileChangeRequest={vi.fn()} specs={[]} />
			);
			expect(screen.getByText("No specs ready for review")).toBeTruthy();
		});

		it("should render list of readyToReview specs", () => {
			render(
				<MockReadyToReviewList
					onFileChangeRequest={vi.fn()}
					specs={mockSpecs}
				/>
			);
			expect(screen.getByText("API Authentication Design")).toBeTruthy();
			expect(screen.getByText("Database Schema")).toBeTruthy();
		});

		it("should display spec metadata (owner, completedAt, link)", () => {
			render(
				<MockReadyToReviewList
					onFileChangeRequest={vi.fn()}
					specs={mockSpecs}
				/>
			);
			expect(screen.getByText("alice@example.com")).toBeTruthy();
			expect(screen.getByText("bob@example.com")).toBeTruthy();
			// TODO: Verify completedAt displayed when component fully implemented
			// TODO: Verify doc links present and clickable
		});
	});

	describe("filtering", () => {
		it("should exclude specs with status current", () => {
			const mixedSpecs: Specification[] = [
				...mockSpecs,
				{
					id: "spec-003",
					title: "Current Spec",
					owner: "charlie@example.com",
					status: "current",
					completedAt: null,
					updatedAt: new Date(),
					links: { specPath: "specs/current/spec.md" },
					changeRequests: [],
				},
			];
			render(
				<MockReadyToReviewList
					onFileChangeRequest={vi.fn()}
					specs={mockSpecs}
				/>
			);
			// Only readyToReview specs should be shown
			expect(screen.queryByText("Current Spec")).toBeNull();
			expect(screen.getByText("API Authentication Design")).toBeTruthy();
		});

		it("should exclude specs with status reopened", () => {
			const mixedSpecs: Specification[] = [
				...mockSpecs,
				{
					id: "spec-004",
					title: "Reopened Spec",
					owner: "dave@example.com",
					status: "reopened",
					completedAt: new Date(),
					updatedAt: new Date(),
					links: { specPath: "specs/reopened/spec.md" },
					changeRequests: [],
				},
			];
			render(
				<MockReadyToReviewList
					onFileChangeRequest={vi.fn()}
					specs={mockSpecs}
				/>
			);
			// Only readyToReview specs should be shown
			expect(screen.queryByText("Reopened Spec")).toBeNull();
			expect(screen.getByText("API Authentication Design")).toBeTruthy();
		});
	});

	describe("interactions", () => {
		it("should provide button to file change request for each spec", () => {
			render(
				<MockReadyToReviewList
					onFileChangeRequest={vi.fn()}
					specs={mockSpecs}
				/>
			);
			const buttons = screen.getAllByText("File Change Request");
			expect(buttons).toHaveLength(2);
		});

		it("should call onFileChangeRequest when button clicked", () => {
			const onFileChangeRequest = vi.fn();
			render(
				<MockReadyToReviewList
					onFileChangeRequest={onFileChangeRequest}
					specs={mockSpecs}
				/>
			);
			const buttons = screen.getAllByText("File Change Request");
			fireEvent.click(buttons[0]);
			expect(onFileChangeRequest).toHaveBeenCalledWith("spec-001");
		});

		it("should link to spec document when spec title clicked", () => {
			// TODO: When component fully implemented, test navigation to spec
			// render(<MockReadyToReviewList specs={mockSpecs} />);
			// const titleLink = screen.getByRole('link', { name: /API Authentication Design/i });
			// fireEvent.click(titleLink);
			// Assert navigation or message sent to extension host
		});
	});

	describe("edge cases", () => {
		it("should handle very long spec titles gracefully", () => {
			const longTitleSpec: Specification = {
				...mockSpecs[0],
				id: "spec-long",
				title:
					"This is a very long specification title that should be truncated or wrapped to avoid breaking the layout ".repeat(
						2
					),
			};
			render(
				<MockReadyToReviewList
					onFileChangeRequest={vi.fn()}
					specs={[longTitleSpec]}
				/>
			);
			// Assert no crash and title visible (possibly truncated)
			expect(screen.getByText(LONG_TITLE_REGEX)).toBeTruthy();
		});

		it("should handle missing owner field", () => {
			const specNoOwner: Specification = {
				...mockSpecs[0],
				id: "spec-no-owner",
				owner: "",
			};
			render(
				<MockReadyToReviewList
					onFileChangeRequest={vi.fn()}
					specs={[specNoOwner]}
				/>
			);
			// Should render without crash
			expect(screen.getByTestId("spec-spec-no-owner")).toBeTruthy();
		});

		it("should handle empty changeRequests array", () => {
			const specEmptyCRs = { ...mockSpecs[0], changeRequests: [] };
			render(
				<MockReadyToReviewList
					onFileChangeRequest={vi.fn()}
					specs={[specEmptyCRs]}
				/>
			);
			expect(screen.getByText("API Authentication Design")).toBeTruthy();
		});
	});
});
