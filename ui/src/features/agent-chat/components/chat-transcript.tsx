/**
 * ChatTranscript — virtualized list of transcript entries.
 *
 * Uses `@tanstack/react-virtual` to keep the DOM small for long transcripts
 * (FR-021 / research R8). In jsdom test environments the virtualizer reports
 * zero container height, so this component falls back to rendering every item
 * when no layout is available — tests still observe the full DOM while
 * production benefits from windowed rendering.
 */

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { ChatMessageItem } from "@/features/agent-chat/components/chat-message-item";
import type { ChatMessage } from "@/features/agent-chat/types";

interface ChatTranscriptProps {
	readonly messages: readonly ChatMessage[];
}

const DEFAULT_ROW_HEIGHT = 80;
const OVERSCAN = 10;

export function ChatTranscript({ messages }: ChatTranscriptProps): JSX.Element {
	const parentRef = useRef<HTMLDivElement | null>(null);

	const virtualizer = useVirtualizer({
		count: messages.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => DEFAULT_ROW_HEIGHT,
		overscan: OVERSCAN,
		getItemKey: (index) => messages[index]?.id ?? `idx-${index}`,
	});

	// Pin to bottom only when the user is already scrolled near the bottom.
	// biome-ignore lint/correctness/useExhaustiveDependencies: want re-run on any transcript change
	useEffect(() => {
		const el = parentRef.current;
		if (!el) {
			return;
		}
		const nearBottom =
			el.scrollTop + el.clientHeight >= el.scrollHeight - DEFAULT_ROW_HEIGHT;
		if (nearBottom) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages]);

	const virtualItems = virtualizer.getVirtualItems();
	// In test / initial-mount environments the virtualizer reports zero items
	// (container has no measured height). Fall back to rendering every message
	// so the transcript stays observable.
	const fallbackToFullRender = virtualItems.length === 0 && messages.length > 0;

	return (
		<div
			className="agent-chat-transcript"
			ref={parentRef}
			style={{ overflowY: "auto", height: "100%" }}
		>
			<div
				style={{
					height: fallbackToFullRender
						? "auto"
						: `${virtualizer.getTotalSize()}px`,
					position: "relative",
					width: "100%",
				}}
			>
				{fallbackToFullRender
					? messages.map((msg) => (
							<div className="agent-chat-transcript__row" key={msg.id}>
								<ChatMessageItem message={msg} />
							</div>
						))
					: virtualItems.map((item) => {
							const message = messages[item.index];
							if (!message) {
								return null;
							}
							return (
								<div
									className="agent-chat-transcript__row"
									data-index={item.index}
									key={item.key}
									ref={virtualizer.measureElement}
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										transform: `translateY(${item.start}px)`,
									}}
								>
									<ChatMessageItem message={message} />
								</div>
							);
						})}
			</div>
		</div>
	);
}
