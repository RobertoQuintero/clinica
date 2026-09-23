"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unlinkUserFromEmployee } from "../actions";

interface Props {
  id_empleado: number;
  id_user: number;
}

/** Botón por fila que deja `users.id_empleado` en NULL. Sin confirmación: es reversible
 *  con un clic desde "Vincular usuario" y no quita el acceso al usuario. */
export default function UnlinkUserButton({ id_empleado, id_user }: Props) {
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleUnlink() {
    setIsUnlinking(true);
    setErrorMessage(null);
    try {
      const result = await unlinkUserFromEmployee({ id_empleado, id_user });
      if (!result.ok) {
        setErrorMessage(result.message);
        // El vínculo ya cambió desde otra pestaña: se refresca para mostrar el estado real.
        router.refresh();
        return;
      }
      router.refresh();
    } finally {
      setIsUnlinking(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleUnlink}
        disabled={isUnlinking}
        className="px-3 py-1.5 text-xs font-semibold text-[#ba1a1a] dark:text-red-400 hover:bg-[#ba1a1a]/10 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
      >
        {isUnlinking ? "Desvinculando…" : "Desvincular"}
      </button>
      {errorMessage && (
        <p role="alert" className="text-xs text-[#ba1a1a] dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
