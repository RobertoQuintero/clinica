import { useCallback, useSyncExternalStore } from "react";

type StorageKind = "local" | "session";
type StorageValueUpdate = string | null | ((current: string | null) => string | null);

// Suscriptores de la misma pestaña, indexados por `${kind}:${key}`.
const listenersByStorageKey = new Map<string, Set<() => void>>();

function getStorage(kind: StorageKind): Storage {
  return kind === "local" ? window.localStorage : window.sessionStorage;
}

function readStorageValue(kind: StorageKind, key: string, fallbackValue: string | null): string | null {
  try {
    return getStorage(kind).getItem(key);
  } catch {
    // Storage inaccesible (modo privado, bloqueo de cookies): se comporta como si no hubiera nada guardado.
    return fallbackValue;
  }
}

function writeStorageValue(kind: StorageKind, key: string, value: string | null): void {
  try {
    if (value === null) getStorage(kind).removeItem(key);
    else getStorage(kind).setItem(key, value);
  } catch {
    // Cuota llena o storage bloqueado: la escritura se ignora sin romper la pantalla.
  }
}

function notifyStorageListeners(storageKey: string): void {
  listenersByStorageKey.get(storageKey)?.forEach((listener) => listener());
}

/**
 * Lee y escribe una clave de localStorage/sessionStorage como string crudo.
 * - Snapshot del servidor: `serverValue`.
 * - Escribir `null` borra la clave.
 * - El setter acepta un updater funcional que lee el valor actual del storage, no el del
 *   último render, para que dos escrituras seguidas en el mismo evento no se pisen.
 * - Notifica a los demás componentes de la misma pestaña que usan esa clave.
 * - No escucha el evento `storage` de otras pestañas.
 * - Si el storage lanza, la lectura devuelve `serverValue` y la escritura se ignora.
 */
export function useStorageValue(
  kind: StorageKind,
  key: string,
  serverValue: string | null,
): [string | null, (update: StorageValueUpdate) => void] {
  const storageKey = `${kind}:${key}`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const listeners = listenersByStorageKey.get(storageKey) ?? new Set<() => void>();
      listenersByStorageKey.set(storageKey, listeners);
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) listenersByStorageKey.delete(storageKey);
      };
    },
    [storageKey],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => readStorageValue(kind, key, serverValue),
    () => serverValue,
  );

  const setValue = useCallback(
    (update: StorageValueUpdate) => {
      const currentValue = readStorageValue(kind, key, serverValue);
      const nextValue = typeof update === "function" ? update(currentValue) : update;
      if (nextValue === currentValue) return;
      writeStorageValue(kind, key, nextValue);
      notifyStorageListeners(storageKey);
    },
    [kind, key, serverValue, storageKey],
  );

  return [value, setValue];
}
