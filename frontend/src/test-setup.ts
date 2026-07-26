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
