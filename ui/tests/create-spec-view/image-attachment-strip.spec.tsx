import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImageAttachmentStrip } from "@/features/create-spec-view/components/image-attachment-strip";
import type { ImageAttachmentMeta } from "@/features/create-spec-view/types";

const REMOVE_CAT_RE = /remove cat\.png/i;

const makeAttachment = (
	overrides?: Partial<ImageAttachmentMeta>
): ImageAttachmentMeta => ({
	id: "img-1",
	uri: "file:///tmp/image.png",
	name: "image.png",
	dataUrl: "data:image/png;base64,abc123",
	...overrides,
});

describe("ImageAttachmentStrip", () => {
	it("renders null when attachments array is empty", () => {
		const { container } = render(
			<ImageAttachmentStrip attachments={[]} onRemove={vi.fn()} />
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders an img element for each attachment", () => {
		const attachments = [
			makeAttachment({
				id: "1",
				name: "photo.png",
				dataUrl: "data:image/png;base64,aaa",
			}),
			makeAttachment({
				id: "2",
				name: "diagram.jpg",
				dataUrl: "data:image/jpeg;base64,bbb",
			}),
		];
		render(
			<ImageAttachmentStrip attachments={attachments} onRemove={vi.fn()} />
		);

		const images = screen.getAllByRole("img");
		expect(images).toHaveLength(2);
		expect(images[0]).toHaveAttribute("src", "data:image/png;base64,aaa");
		expect(images[1]).toHaveAttribute("src", "data:image/jpeg;base64,bbb");
	});

	it("displays the filename for each attachment", () => {
		const attachments = [makeAttachment({ id: "1", name: "photo.png" })];
		render(
			<ImageAttachmentStrip attachments={attachments} onRemove={vi.fn()} />
		);
		expect(screen.getByText("photo.png")).toBeInTheDocument();
	});

	it("calls onRemove with attachment id when remove button is clicked", async () => {
		const onRemove = vi.fn();
		const attachment = makeAttachment({ id: "img-42", name: "cat.png" });
		render(
			<ImageAttachmentStrip attachments={[attachment]} onRemove={onRemove} />
		);

		const removeButton = screen.getByRole("button", {
			name: REMOVE_CAT_RE,
		});
		await userEvent.click(removeButton);

		expect(onRemove).toHaveBeenCalledOnce();
		expect(onRemove).toHaveBeenCalledWith("img-42");
	});

	it("renders a remove button per attachment", () => {
		const attachments = [
			makeAttachment({ id: "1", name: "a.png" }),
			makeAttachment({ id: "2", name: "b.png" }),
			makeAttachment({ id: "3", name: "c.png" }),
		];
		render(
			<ImageAttachmentStrip attachments={attachments} onRemove={vi.fn()} />
		);

		const buttons = screen.getAllByRole("button");
		expect(buttons).toHaveLength(3);
	});

	it("renders the list container with role='list'", () => {
		const attachments = [makeAttachment()];
		render(
			<ImageAttachmentStrip attachments={attachments} onRemove={vi.fn()} />
		);
		expect(screen.getByRole("list")).toBeInTheDocument();
	});
});
