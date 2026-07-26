import "@testing-library/jest-dom";

// Mock window.matchMedia for tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false, // Default to light mode for tests
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage for tests
const localStorageMock = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// jsdom has no canvas implementation. Some Astryx components (e.g. Spinner)
// feature-detect via getContext, which otherwise logs a "Not implemented"
// error on every render. Returning null is the documented "unsupported"
// signal, so components fall back cleanly.
HTMLCanvasElement.prototype.getContext = () => null;

// jsdom does not implement the <dialog> modal methods, and Astryx's Dialog is
// built on the native element — without these, rendering any dialog throws
// "dialog.showModal is not a function". Toggling the `open` attribute is enough
// for tests: it is what drives visibility, so queries behave as in a browser.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.show) {
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom does not implement scrollIntoView. Components that keep an active
// option visible while arrowing through a list (the slash-command picker) call
// it on every selection change, which would otherwise throw. There is no
// layout to scroll in jsdom, so a no-op is the honest stand-in.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom implements no ResizeObserver. The composer's highlight overlay uses one
// to re-register itself whenever the textarea changes size. jsdom performs no
// layout, so nothing there ever resizes and a stub that never fires is
// accurate rather than merely convenient — the observable behaviour under test
// comes from the layout effect, which still runs.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}
