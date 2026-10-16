import { useSyncExternalStore } from "react";

// No hay nada externo a lo que suscribirse: el valor solo cambia de servidor a cliente.
const subscribeNoop = () => () => {};

/** false en el servidor y durante la hidratación; true una vez en el cliente. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
