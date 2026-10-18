import { vi } from 'vitest';

/** Storage area of the fake localStorage. */
export interface FakeLocalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Replaces localStorage with an in-memory object. The unit test project has
 * no DOM, so the theme mirror needs this stub. A blocked storage throws on
 * every call, as a browser with the storage disabled does.
 */
export function installFakeLocalStorage(blocked = false): FakeLocalStorage {
  const data = new Map<string, string>();
  const storage: FakeLocalStorage = {
    getItem: (key) => {
      if (blocked) {
        throw new Error('the storage is blocked');
      }
      return data.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (blocked) {
        throw new Error('the storage is blocked');
      }
      data.set(key, value);
    },
  };

  vi.stubGlobal('localStorage', storage);

  return storage;
}
