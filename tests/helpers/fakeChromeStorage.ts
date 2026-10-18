type StorageData = Record<string, unknown>;

/** Record of a get call: the area and the passed keys. */
type GetCall = { area: 'local' | 'session'; keys: unknown };

/** Record of a set call: the area and the written key-value pairs. */
type SetCall = { area: 'local' | 'session'; items: Record<string, unknown> };

/** Record of a remove call: the area and the passed keys. */
type RemoveCall = { area: 'local' | 'session'; keys: unknown };

/** In-memory storage area. All methods return promises. */
interface FakeStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

/**
 * Replaces chrome.storage with an in-memory object.
 * Missing keys do not appear in the response. The arguments of every get,
 * set, and remove call go to getCalls, setCalls, and removeCalls.
 * The returned local and session are the same objects the storage sees,
 * so you can change them.
 */
export function installFakeChromeStorage(initial?: {
  local?: Record<string, unknown>;
  session?: Record<string, unknown>;
}): {
  local: StorageData;
  session: StorageData;
  getCalls: GetCall[];
  setCalls: SetCall[];
  removeCalls: RemoveCall[];
} {
  const local: StorageData = { ...initial?.local };
  const session: StorageData = { ...initial?.session };
  const getCalls: GetCall[] = [];
  const setCalls: SetCall[] = [];
  const removeCalls: RemoveCall[] = [];

  const createArea = (area: GetCall['area'], data: StorageData): FakeStorageArea => ({
    get(keys) {
      getCalls.push({ area, keys: Array.isArray(keys) ? [...keys] : keys });
      const requested =
        keys === null || keys === undefined
          ? Object.keys(data)
          : Array.isArray(keys)
            ? keys
            : [keys];
      const result: Record<string, unknown> = {};
      for (const key of requested) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = structuredClone(data[key]);
        }
      }
      return Promise.resolve(result);
    },
    set(items) {
      setCalls.push({ area, items: structuredClone(items) });
      for (const [key, value] of Object.entries(items)) {
        data[key] = structuredClone(value);
      }
      return Promise.resolve();
    },
    remove(keys) {
      removeCalls.push({ area, keys: Array.isArray(keys) ? [...keys] : keys });
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
      return Promise.resolve();
    },
  });

  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: createArea('local', local),
      session: createArea('session', session),
    },
  };

  return { local, session, getCalls, setCalls, removeCalls };
}
