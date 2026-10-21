import { Banknote, type LucideIcon } from "lucide-react";

/**
 * Fuera de `lib/manual/modules.ts` para que `proxy.ts` (que importa ese registro) no
 * cargue `lucide-react` en el bundle del middleware.
 */
export const MANUAL_MODULE_ICONS: Record<string, LucideIcon> = {
  nomina: Banknote,
};
