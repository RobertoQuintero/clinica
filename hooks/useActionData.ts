import { useAsyncData, type AsyncDataKey, type AsyncDataResult } from "@/hooks/useAsyncData";

/** Forma estructural de los ActionResult que define cada actions.ts (no hay un tipo único importable). */
type ActionResultLike<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Igual que useAsyncData, pero desenvuelve ActionResult:
 * ok:true → data; ok:false → error = message. Un rechazo de la promesa también va a error.
 */
export function useActionData<T>(
  key: AsyncDataKey,
  action: (signal: AbortSignal) => Promise<ActionResultLike<T>>,
): AsyncDataResult<T> {
  return useAsyncData<T>(key, async (signal) => {
    const result = await action(signal);
    if (!result.ok) throw new Error(result.message);
    return result.data;
  });
}
