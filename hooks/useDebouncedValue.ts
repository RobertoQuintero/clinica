import { useEffect, useState } from "react";

/** Devuelve `value` después de `delayMs` sin cambios. El primer render devuelve `value` tal cual. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // El setState vive en el callback del timeout, no en el cuerpo del effect.
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}
