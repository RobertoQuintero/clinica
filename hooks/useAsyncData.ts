import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

/** Partes primitivas de la key; se serializa con JSON.stringify para compararla. */
export type AsyncDataKey = readonly (string | number | boolean | null)[] | null;

export interface AsyncDataResult<T> {
  /** Datos de la key actual; `undefined` mientras carga, si falló o si key es null. */
  data: T | undefined;
  /** Mensaje del rechazo de la key actual; `null` si no hubo error. */
  error: string | null;
  /** Derivado: hay key y todavía no llega su respuesta (ni datos ni error). */
  loading: boolean;
  /** Vuelve a pedir la key actual. Se resuelve cuando ya se guardaron los datos nuevos o el error. */
  reload: () => Promise<void>;
  /** Modifica localmente `data` de la key actual, sin ir al servidor. No hace nada si no hay datos. */
  mutate: (updater: (current: T) => T) => void;
}

interface AsyncDataState<T> {
  /** `${JSON.stringify(key)}#${reloadVersion}` de la respuesta guardada. */
  settledKey: string | null;
  data: T | undefined;
  error: string | null;
}

const UNEXPECTED_ERROR_MESSAGE = "Error inesperado";

function buildRequestKey(serializedKey: string, reloadVersion: number): string {
  return `${serializedKey}#${reloadVersion}`;
}

/**
 * Carga datos asíncronos indexados por `key`.
 * - `key = null` no carga.
 * - `data` y `error` solo existen para la key actual: al cambiar la key o al llamar `reload()`,
 *   vuelven a `undefined`/`null` y `loading` es `true` hasta que llega la respuesta.
 * - El fetcher se lee con `useEffectEvent`: puede pasarse en línea, pero todo valor que lea
 *   debe estar en la key, porque solo un cambio de key vuelve a pedir datos.
 * - El `AbortSignal` se cancela al cambiar la key, al recargar o al desmontar; la respuesta
 *   tardía se descarta y un abort no cuenta como error.
 */
export function useAsyncData<T>(
  key: AsyncDataKey,
  fetcher: (signal: AbortSignal) => Promise<T>,
): AsyncDataResult<T> {
  const serializedKey = key === null ? null : JSON.stringify(key);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<AsyncDataState<T>>({
    settledKey: null,
    data: undefined,
    error: null,
  });

  // Resolvers de `reload()` por versión. Solo se tocan desde eventos y effects, nunca en el render.
  const latestReloadVersionRef = useRef(0);
  const pendingReloadResolversRef = useRef(new Map<number, Array<() => void>>());

  const resolveReloadsUpTo = useCallback((version: number) => {
    for (const [pendingVersion, resolvers] of pendingReloadResolversRef.current) {
      if (pendingVersion > version) continue;
      resolvers.forEach((resolve) => resolve());
      pendingReloadResolversRef.current.delete(pendingVersion);
    }
  }, []);

  const runFetcher = useEffectEvent((signal: AbortSignal) => fetcher(signal));

  useEffect(() => {
    if (serializedKey === null) {
      resolveReloadsUpTo(reloadVersion);
      return;
    }

    const requestKey = buildRequestKey(serializedKey, reloadVersion);
    const controller = new AbortController();

    const settle = (nextState: AsyncDataState<T>) => {
      if (controller.signal.aborted) return;
      setState(nextState);
      resolveReloadsUpTo(reloadVersion);
    };

    let request: Promise<T>;
    try {
      request = runFetcher(controller.signal);
    } catch (thrownError) {
      request = Promise.reject(thrownError);
    }

    request.then(
      (data) => settle({ settledKey: requestKey, data, error: null }),
      (rejection: unknown) =>
        settle({
          settledKey: requestKey,
          data: undefined,
          error: rejection instanceof Error ? rejection.message : UNEXPECTED_ERROR_MESSAGE,
        }),
    );

    return () => {
      controller.abort();
      resolveReloadsUpTo(reloadVersion);
    };
  }, [serializedKey, reloadVersion, resolveReloadsUpTo]);

  // Al desmontar se resuelven también las recargas pedidas en el mismo evento que el desmontaje.
  useEffect(() => {
    return () => resolveReloadsUpTo(Number.POSITIVE_INFINITY);
  }, [resolveReloadsUpTo]);

  const currentRequestKey =
    serializedKey === null ? null : buildRequestKey(serializedKey, reloadVersion);
  const isCurrentKeySettled = currentRequestKey !== null && state.settledKey === currentRequestKey;

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const nextVersion = latestReloadVersionRef.current + 1;
        latestReloadVersionRef.current = nextVersion;
        const resolvers = pendingReloadResolversRef.current.get(nextVersion) ?? [];
        resolvers.push(resolve);
        pendingReloadResolversRef.current.set(nextVersion, resolvers);
        setReloadVersion(nextVersion);
      }),
    [],
  );

  const mutate = useCallback(
    (updater: (current: T) => T) => {
      setState((previousState) => {
        if (previousState.settledKey !== currentRequestKey || previousState.data === undefined) {
          return previousState;
        }
        return { ...previousState, data: updater(previousState.data) };
      });
    },
    [currentRequestKey],
  );

  return {
    data: isCurrentKeySettled ? state.data : undefined,
    error: isCurrentKeySettled ? state.error : null,
    loading: currentRequestKey !== null && !isCurrentKeySettled,
    reload,
    mutate,
  };
}
