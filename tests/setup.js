import 'fake-indexeddb/auto';
import { vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] ?? null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Reset mocks between tests
beforeEach(() => {
  localStorageMock.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock fetch for fetchJSON tests
globalThis.fetch = vi.fn();
