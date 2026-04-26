/**
 * ChipOverflowBar — single-row chip layout that gracefully collapses
 * out-of-bounds chips into a "…" overflow menu, mirroring the VS Code
 * editor toolbar / Cursor model picker behaviour.
 *
 * Why not `flex-wrap`?
 *   The user explicitly asked the chips to NEVER stack into a second
 *   row when the chat panel is narrow. The standard VS Code pattern is
 *   to keep the row on a single line and tuck overflowed actions
 *   behind an ellipsis button.
 *
 * Algorithm:
 *
 *   1. Render every chip inline.
 *   2. Cache each chip's natural `offsetWidth` while it is visible.
 *   3. On every container resize (ResizeObserver), walk the cache from
 *      left to right and pick the largest prefix of chips that fits
 *      `containerWidth − overflowButtonWidth − gaps`.
 *   4. Apply `display: none` (visually) to chips beyond that prefix and
 *      surface them inside a popover anchored to the "…" button. The
 *      popover renders the *same* ChipDropdown nodes — they keep their
 *      own state and submenus, no re-implementation needed.
 *
 * In jsdom (vitest) `offsetWidth` returns `0` for every element, so the
 * branch that hides chips never fires; tests therefore see every chip
 * inline. That is the desired test behaviour because we still want to
 * assert that all chips render — overflow is a visual concern only.
 */

import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

export interface ChipOverflowItem {
	readonly key: string;
	readonly node: ReactNode;
}

interface ChipOverflowBarProps {
	readonly items: readonly ChipOverflowItem[];
	/** Optional CSS gap override (px) — defaults to 3. */
	readonly gap?: number;
}

const OVERFLOW_BUTTON_WIDTH = 26;

function refreshWidthCache(
	items: readonly ChipOverflowItem[],
	refs: Map<string, HTMLDivElement>,
	cache: Map<string, number>
): void {
	for (const item of items) {
		const node = refs.get(item.key);
		if (node && node.offsetWidth > 0) {
			cache.set(item.key, node.offsetWidth);
		}
	}
}

function totalWidth(
	items: readonly ChipOverflowItem[],
	cache: Map<string, number>,
	gap: number
): number {
	let total = 0;
	for (let i = 0; i < items.length; i++) {
		const w = cache.get(items[i].key) ?? 0;
		total += w + (i > 0 ? gap : 0);
	}
	return total;
}

function findOverflowKeys(
	items: readonly ChipOverflowItem[],
	cache: Map<string, number>,
	containerW: number,
	gap: number
): readonly string[] {
	const reserve = OVERFLOW_BUTTON_WIDTH + gap;
	let cumulative = 0;
	for (let i = 0; i < items.length; i++) {
		const w = cache.get(items[i].key) ?? 0;
		const next = cumulative + (i > 0 ? gap : 0) + w;
		if (next + reserve > containerW) {
			return items.slice(i).map((it) => it.key);
		}
		cumulative = next;
	}
	return [];
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

export function ChipOverflowBar({
	items,
	gap = 3,
}: ChipOverflowBarProps): JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const widthCache = useRef<Map<string, number>>(new Map());
	const moreContainerRef = useRef<HTMLDivElement | null>(null);
	const [hiddenKeys, setHiddenKeys] = useState<readonly string[]>([]);
	const [moreOpen, setMoreOpen] = useState(false);

	const recompute = useCallback(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		refreshWidthCache(items, itemRefs.current, widthCache.current);
		const containerW = container.clientWidth;
		if (containerW === 0) {
			setHiddenKeys((prev) => (prev.length === 0 ? prev : []));
			return;
		}
		const fitsAll = totalWidth(items, widthCache.current, gap) <= containerW;
		const next = fitsAll
			? []
			: findOverflowKeys(items, widthCache.current, containerW, gap);
		setHiddenKeys((prev) => (sameKeys(prev, next) ? prev : next));
	}, [items, gap]);

	// Recompute on every render so cached widths and items stay in sync.
	useLayoutEffect(() => {
		recompute();
	});

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const ro = new ResizeObserver(() => {
			recompute();
		});
		ro.observe(container);
		return () => {
			ro.disconnect();
		};
	}, [recompute]);

	// Close the more menu when clicking outside.
	useEffect(() => {
		if (!moreOpen) {
			return;
		}
		const handler = (event: MouseEvent): void => {
			if (
				moreContainerRef.current &&
				!moreContainerRef.current.contains(event.target as Node)
			) {
				setMoreOpen(false);
			}
		};
		window.addEventListener("mousedown", handler);
		return () => {
			window.removeEventListener("mousedown", handler);
		};
	}, [moreOpen]);

	const hiddenSet = new Set(hiddenKeys);
	const hasOverflow = hiddenKeys.length > 0;

	return (
		<div
			className="agent-chat-chip-overflow"
			ref={containerRef}
			style={{ gap: `${gap}px` }}
		>
			{items.map((item) => (
				<div
					className={
						hiddenSet.has(item.key)
							? "agent-chat-chip-overflow__item agent-chat-chip-overflow__item--hidden"
							: "agent-chat-chip-overflow__item"
					}
					key={item.key}
					ref={(el) => {
						if (el) {
							itemRefs.current.set(item.key, el);
						} else {
							itemRefs.current.delete(item.key);
						}
					}}
				>
					{item.node}
				</div>
			))}
			<div
				className={
					hasOverflow
						? "agent-chat-chip-overflow__more"
						: "agent-chat-chip-overflow__more agent-chat-chip-overflow__more--hidden"
				}
				ref={moreContainerRef}
			>
				<button
					aria-expanded={moreOpen}
					aria-haspopup="menu"
					aria-label="Show more options"
					className="agent-chat-chip-overflow__more-button"
					onClick={() => setMoreOpen((v) => !v)}
					title="More options"
					type="button"
				>
					<i aria-hidden="true" className="codicon codicon-ellipsis" />
				</button>
				{moreOpen && hasOverflow ? (
					<div className="agent-chat-chip-overflow__menu" role="menu">
						{items
							.filter((item) => hiddenSet.has(item.key))
							.map((item) => (
								<div
									className="agent-chat-chip-overflow__menu-item"
									key={item.key}
									role="none"
								>
									{item.node}
								</div>
							))}
					</div>
				) : null}
			</div>
		</div>
	);
}
