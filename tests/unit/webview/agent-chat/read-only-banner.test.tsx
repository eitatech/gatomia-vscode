/**
 * ReadOnlyBanner tests (T054).
 * TDD: red before T065.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadOnlyBanner } from "@/features/agent-chat/components/read-only-banner";

const READ_ONLY_RE = /read.?only/i;
const OPEN_IN_PROVIDER_RE = /open in provider/i;
const DEVIN_RE = /devin/i;

afterEach(() => {
	cleanup();
});

describe("ReadOnlyBanner", () => {
	it("renders the read-only notice with the provider display name", () => {
		render(
			<ReadOnlyBanner
				externalUrl="https://devin.ai/session/abc"
				onOpenExternal={vi.fn()}
				providerDisplayName="Devin"
				providerId="devin"
			/>
		);
		expect(screen.getByText(READ_ONLY_RE)).toBeInTheDocument();
		expect(screen.getByText(DEVIN_RE)).toBeInTheDocument();
	});

	it("renders an 'Open in provider' button when externalUrl is set", () => {
		const onOpenExternal = vi.fn();
		render(
			<ReadOnlyBanner
				externalUrl="https://devin.ai/session/abc"
				onOpenExternal={onOpenExternal}
				providerDisplayName="Devin"
				providerId="devin"
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: OPEN_IN_PROVIDER_RE }));
		expect(onOpenExternal).toHaveBeenCalledTimes(1);
	});

	it("does NOT render the Open button when externalUrl is absent", () => {
		render(
			<ReadOnlyBanner
				externalUrl={undefined}
				onOpenExternal={vi.fn()}
				providerDisplayName="Devin"
				providerId="devin"
			/>
		);
		expect(
			screen.queryByRole("button", { name: OPEN_IN_PROVIDER_RE })
		).toBeNull();
	});
});
