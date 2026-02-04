import { Minus, Move, Plus, RotateCcw } from "lucide-react";
import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";

/**
 * Port of vscode-markdown-mermaid logic
 */

const minScale = 0.5;
const maxScale = 10;
const zoomFactor = 0.002;

interface MermaidViewerProps {
	code: string;
	id: string; // Unique ID
}

export const MermaidViewer = ({ code, id }: MermaidViewerProps) => {
	const [svg, setSvg] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	// State tracked in refs for mutable interaction logic (avoiding re-renders for every pixel drag)
	const state = useRef({
		scale: 1,
		translate: { x: 0, y: 0 },
		isPanning: false,
		hasDragged: false,
		hasInteracted: false,
		startX: 0,
		startY: 0,
		isResizing: false,
		resizeStartY: 0,
		resizeStartHeight: 0,
		customHeight: undefined as number | undefined,
		lastSvgSize: { width: 0, height: 0 },
	});

	// UI State
	const [panModeEnabled, setPanModeEnabled] = useState(false);

	// --- Rendering ---
	useEffect(() => {
		const renderDiagram = async () => {
			try {
				setError(null);
				// We use the ID directly as mermaid expects, assuming preview-app generates unique ones
				// But mermaid.render expects a unique ID for the container it creates?
				// Actually mermaid.render(id, text) returns svg.
				const { svg: renderedSvg } = await mermaid.render(
					`mermaid-${id}`,
					code
				);
				// Sanitize the generated SVG before injecting it into the DOM to avoid XSS.
				const sanitizedSvg = DOMPurify.sanitize(renderedSvg, {
					USE_PROFILES: { svg: true, svgFilters: true },
					// Allow foreignObject and HTML elements for rich text labels
					ADD_TAGS: ["foreignObject", "div", "span", "p", "br", "style"],
					ADD_ATTR: ["class", "id", "style", "xmlns"],
				});
				setSvg(sanitizedSvg);
			} catch (err) {
				console.error("Mermaid render error:", err);
				setError("Failed to render diagram.");
			}
		};
		renderDiagram();
	}, [code, id]);

	// --- Initialization & Sizing ---
	// biome-ignore lint/correctness/useExhaustiveDependencies: initializeLayout reference is stable enough
	useEffect(() => {
		if (svg && contentRef.current && containerRef.current) {
			// Initialize
			requestAnimationFrame(() => {
				initializeLayout();
			});
		}
	}, [svg]); // initializeLayout is stable refs-only logic, fine to omit or we useCallback below

	const initializeLayout = () => {
		const s = state.current;
		const container = containerRef.current;
		const content = contentRef.current;
		if (!(container && content)) {
			return;
		}

		// Find SVG and get intrinsic size
		// We insert the SVG into contentRef via dangerouslySetInnerHTML
		const svgEl = content.querySelector("svg");
		if (svgEl) {
			svgEl.removeAttribute("height");
			const rect = svgEl.getBoundingClientRect();
			s.lastSvgSize = { width: rect.width, height: rect.height };
		}

		if (s.hasInteracted) {
			tryResizeContainerToFitSvg();
			applyTransform();
		} else {
			centerContent();
		}
	};

	const tryResizeContainerToFitSvg = (): boolean => {
		const s = state.current;
		const container = containerRef.current;
		if (!container || s.lastSvgSize.height === 0) {
			return false;
		}

		const containerHeight = s.customHeight ?? s.lastSvgSize.height;
		// Ensure min height
		const finalHeight = Math.max(containerHeight, 200);
		container.style.height = `${finalHeight}px`;
		return true;
	};

	const centerContent = () => {
		if (!tryResizeContainerToFitSvg()) {
			return;
		}

		const s = state.current;
		const container = containerRef.current;
		if (!container) {
			return;
		}

		s.scale = 1;
		const containerRect = container.getBoundingClientRect();
		s.translate = {
			x: (containerRect.width - s.lastSvgSize.width) / 2,
			y: 0,
		};
		applyTransform();
	};

	const applyTransform = () => {
		const content = contentRef.current;
		if (!content) {
			return;
		}
		const { scale, translate } = state.current;
		content.style.transform = `translate(${translate.x}px, ${translate.y}px) scale(${scale})`;
	};

	// --- Interaction Logic ---

	const updateCursor = (e: React.MouseEvent, forcePanMode = panModeEnabled) => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		if (state.current.isPanning) {
			container.style.cursor = "grabbing";
			return;
		}

		if (forcePanMode) {
			container.style.cursor = "grab";
			return;
		}

		const alt = e.altKey;
		const shift = e.shiftKey;

		// Default VSCode mermaid behavior logic (ClickDrag.Alt default)
		// Assuming Alt=Pan/Zoom

		// If alt is pressed:
		if (alt) {
			if (shift) {
				container.style.cursor = "zoom-out";
			} else {
				container.style.cursor = "grab"; // Or zoom-in logic? Reference uses grab or zoom-in depending on mode.
			}
			// Replicating DiagramElement.setCursor logic for 'Alt' mode:
			// if (alt && shift) zoom-out
			// else if (alt) grab
			// else default
		} else {
			container.style.cursor = "default";
		}
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		if (state.current.isResizing) {
			return;
		}
		// Only left click
		if (e.button !== 0) {
			return;
		}

		const isPanAllowed = panModeEnabled || e.altKey;

		if (!isPanAllowed) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		const s = state.current;
		s.isPanning = true;
		s.hasDragged = false;
		s.startX = e.clientX - s.translate.x;
		s.startY = e.clientY - s.translate.y;

		if (containerRef.current) {
			containerRef.current.style.cursor = "grabbing";
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		const s = state.current;
		updateCursor(e);

		if (s.isPanning) {
			// Handle Pan
			if (e.buttons === 0) {
				handleMouseUp();
				return;
			}
			const dx = e.clientX - s.startX - s.translate.x;
			const dy = e.clientY - s.startY - s.translate.y;
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
				s.hasDragged = true;
			}
			s.translate = {
				x: e.clientX - s.startX,
				y: e.clientY - s.startY,
			};
			applyTransform();
		}
	};

	const handleMouseUp = () => {
		const s = state.current;
		if (s.isPanning) {
			s.isPanning = false;
			s.hasInteracted = true;
			updateCursor({ altKey: false, shiftKey: false } as any); // Reset cursor approx
		}
	};

	const handleMouseLeave = handleMouseUp;

	const handleWheel = (e: React.WheelEvent) => {
		const isPinchZoom = e.ctrlKey;
		const isAlt = e.altKey;

		if (isPinchZoom || isAlt) {
			e.preventDefault();
			e.stopPropagation();

			const s = state.current;
			const container = containerRef.current;
			if (!container) {
				return;
			}

			const rect = container.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			const pinchMultiplier = isPinchZoom ? 10 : 1;
			const delta = -e.deltaY * zoomFactor * pinchMultiplier;
			const newScale = Math.min(
				maxScale,
				Math.max(minScale, s.scale * (1 + delta))
			);

			const scaleFactor = newScale / s.scale;
			s.translate = {
				x: mouseX - (mouseX - s.translate.x) * scaleFactor,
				y: mouseY - (mouseY - s.translate.y) * scaleFactor,
			};
			s.scale = newScale;

			applyTransform();
			s.hasInteracted = true;
		}
	};

	const handleClick = (e: React.MouseEvent) => {
		const s = state.current;
		// Zoom on click if Alt pressed and not dragged
		if (e.altKey && !s.hasDragged) {
			e.preventDefault();
			e.stopPropagation();
			const container = containerRef.current;
			if (!container) {
				return;
			}

			const rect = container.getBoundingClientRect();
			const factor = e.shiftKey ? 0.8 : 1.25;
			zoomAtPoint(factor, e.clientX - rect.left, e.clientY - rect.top);
		}
	};

	// --- Controls ---
	const zoomAtPoint = (factor: number, x: number, y: number) => {
		const s = state.current;
		const newScale = Math.min(maxScale, Math.max(minScale, s.scale * factor));
		const scaleFactor = newScale / s.scale;
		s.translate = {
			x: x - (x - s.translate.x) * scaleFactor,
			y: y - (y - s.translate.y) * scaleFactor,
		};
		s.scale = newScale;
		applyTransform();
		s.hasInteracted = true;
	};

	const zoomIn = (e: React.MouseEvent) => {
		e.stopPropagation();
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const rect = container.getBoundingClientRect();
		zoomAtPoint(1.25, rect.width / 2, rect.height / 2);
	};

	const zoomOut = (e: React.MouseEvent) => {
		e.stopPropagation();
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const rect = container.getBoundingClientRect();
		zoomAtPoint(0.8, rect.width / 2, rect.height / 2);
	};

	const reset = (e: React.MouseEvent) => {
		e.stopPropagation();
		state.current.hasInteracted = false;
		state.current.customHeight = undefined;
		centerContent();
	};

	const togglePanMode = (e: React.MouseEvent) => {
		e.stopPropagation();
		setPanModeEnabled((prev) => !prev);
	};

	// --- Resizing ---
	const handleResizeMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const s = state.current;
		const container = containerRef.current;
		if (!container) {
			return;
		}

		s.isResizing = true;
		s.resizeStartY = e.clientY;
		s.resizeStartHeight = container.getBoundingClientRect().height;
		document.body.style.cursor = "ns-resize";

		const moveHandler = (moveE: MouseEvent) => {
			if (!s.isResizing) {
				return;
			}
			if (moveE.buttons === 0) {
				stopResize();
				return;
			}
			const deltaY = moveE.clientY - s.resizeStartY;
			const newHeight = Math.max(100, s.resizeStartHeight + deltaY);
			if (containerRef.current) {
				containerRef.current.style.height = `${newHeight}px`;
			}
			s.customHeight = newHeight;
		};

		const stopResize = () => {
			s.isResizing = false;
			document.body.style.cursor = "";
			window.removeEventListener("mousemove", moveHandler);
			window.removeEventListener("mouseup", stopResize);
			// Re-center or adjust? Reference logic: handleResize trigger
			// We can just leave it as is or trigger re-layout if needed.
		};

		window.addEventListener("mousemove", moveHandler);
		window.addEventListener("mouseup", stopResize);
	};

	if (error) {
		return (
			<div className="mermaid-error rounded border border-red-500/20 bg-red-500/10 p-4 text-sm">
				<p className="font-semibold text-red-500">Rendering Error</p>
				<p className="text-red-400">{error}</p>
				<pre className="mt-2 overflow-auto bg-black/20 p-2 text-xs">{code}</pre>
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: Canvas-like interaction requires events
		// biome-ignore lint/a11y/noStaticElementInteractions: Canvas-like interaction requires events
		// biome-ignore lint/a11y/useKeyWithClickEvents: Canvas-like interaction requires events
		<div
			className="mermaid-wrapper"
			onClick={handleClick}
			onMouseDown={handleMouseDown}
			onMouseLeave={handleMouseLeave}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onWheel={handleWheel}
			ref={containerRef}
		>
			<div className="mermaid-zoom-controls">
				<button
					className={panModeEnabled ? "active" : ""}
					onClick={togglePanMode}
					title="Toggle Pan Mode"
					type="button"
				>
					<Move size={16} />
				</button>
				<button onClick={zoomOut} title="Zoom Out" type="button">
					<Minus size={16} />
				</button>
				<button onClick={zoomIn} title="Zoom In" type="button">
					<Plus size={16} />
				</button>
				<button onClick={reset} title="Reset" type="button">
					<RotateCcw size={16} />
				</button>
			</div>

			<div className="mermaid-content" ref={contentRef}>
				{!svg && (
					<span className="text-[color:var(--vscode-descriptionForeground)] text-sm">
						Loading diagram...
					</span>
				)}
				<div
					// biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated by mermaid
					dangerouslySetInnerHTML={{ __html: svg }}
				/>
			</div>

			{/* Resize Handle */}
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Resize handle needs mouse down */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Resize handle needs mouse down */}
			<div
				className="mermaid-resize-handle"
				onMouseDown={handleResizeMouseDown}
			/>
		</div>
	);
};
