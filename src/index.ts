import { Store } from "react-admin";
import { MMKV } from "react-native-mmkv";

export const storage = new MMKV({ id: "react-admin" });

type Subscription = {
  callback: (value: unknown) => void;
  key: string;
};

const RA_STORE = "RaStore";

export const mmkvStore = (
  version: string = "1",
  appKey: string = ""
): Store => {
  const prefix = `${RA_STORE}.${appKey}`;
  const prefixLength = prefix.length;

  const subscriptions: { [key: string]: Subscription } = {};

  const publish = (key: string, value: unknown) => {
    for (const id of Object.keys(subscriptions)) {
      if (subscriptions[id].key === key) {
        subscriptions[id].callback(value);
      }
    }
  };

  const listener = storage.addOnValueChangedListener((changedKey) => {
    if (changedKey.startsWith(prefix)) {
      const key = changedKey.slice(Math.max(0, prefixLength + 1));
      const newValue = storage.getString(changedKey);
      const parsedValue = newValue ? tryParse(newValue) : undefined;

      publish(key, parsedValue);
    }
  });

  return {
    getItem: <T = unknown>(key: string, defaultValue?: T) => {
      const valueFromStorage = storage.getString(`${prefix}.${key}`);

      return (
        valueFromStorage ? tryParse(valueFromStorage) : defaultValue
      ) as T;
    },

    removeItem: (key: string): void => {
      storage.delete(`${prefix}.${key}`);
    },

    removeItems: (keyPrefix: string): void => {
      const keys = storage
        .getAllKeys()
        .filter((key) => key.startsWith(`${prefix}.${keyPrefix}`));

      for (const key of keys) {
        storage.delete(key);
      }
    },

    reset(): void {
      const keys = storage.getAllKeys().filter((key) => key.startsWith(prefix));

      for (const key of keys) {
        storage.delete(key);
      }
    },

    setItem: <T = unknown>(key: string, value: T): void => {
      if (value === undefined) {
        storage.delete(`${prefix}.${key}`);
      } else {
        storage.set(`${prefix}.${key}`, JSON.stringify(value));
      }
    },

    setup: () => {
      const storedVersion = storage.getString(`${prefix}.version`);

      if (storedVersion && storedVersion !== version) {
        const keys = storage
          .getAllKeys()
          .filter((key) => key.startsWith(prefix));

        for (const key of keys) storage.delete(key);
      }

      storage.set(`${prefix}.version`, version);
    },

    subscribe: (key: string, callback: (value: unknown) => void) => {
      const id = Math.random().toString();

      subscriptions[id] = { callback, key };

      return () => {
        delete subscriptions[id];
      };
    },

    teardown: () => {
      listener.remove();
    },
  };
};

const tryParse = (value: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(value);
  } catch {
    return value;
  }
};
