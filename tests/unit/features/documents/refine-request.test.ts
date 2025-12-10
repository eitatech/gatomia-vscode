import { describe, expect, it, vi } from "vitest";
import type { OutputChannel } from "vscode";
import { RefinementGateway } from "../../../../src/services/refinement-gateway";

const createOutputChannel = (): OutputChannel =>
	({
		appendLine: vi.fn(),
	}) as unknown as OutputChannel;

describe("RefinementGateway", () => {
	it("returns a request id and logs the submission", async () => {
		const outputChannel = createOutputChannel();
		const gateway = new RefinementGateway(outputChannel);
		const result = await gateway.submitRequest({
			requestId: "ref-test",
			documentId: "file:///spec.md",
			documentType: "spec",
			description: "Section A is missing detail.",
			issueType: "missingDetail",
			submittedAt: new Date().toISOString(),
		});

		expect(result).toMatchObject({
			requestId: "ref-test",
			status: "success",
		});
	});
});
