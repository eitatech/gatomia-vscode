import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement ResizeObserver, but several webview
// components (e.g. ChipOverflowBar) instantiate it at mount. Provide a
// no-op polyfill so the components mount cleanly under tests; the real
// browser bundle continues to use the native implementation.
const noop = (): void => {
	return;
};
const ResizeObserverPolyfill = function PolyfillCtor(
	this: ResizeObserver,
	_callback: ResizeObserverCallback
) {
	this.observe = noop;
	this.unobserve = noop;
	this.disconnect = noop;
} as unknown as typeof ResizeObserver;

if (typeof globalThis.ResizeObserver === "undefined") {
	globalThis.ResizeObserver = ResizeObserverPolyfill;
}

afterEach(() => {
	cleanup();
});
