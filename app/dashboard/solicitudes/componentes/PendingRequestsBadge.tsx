"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSucursal } from "@/contexts/SucursalContext";
import { getPendingRequestsCount } from "../actions";

/** Roles que revisan solicitudes (mismo criterio que `REVIEWER_ROLE_IDS` en actions.ts). */
const REVIEWER_ROLE_IDS = [1, 4, 6];

/**
 * Contador de solicitudes pendientes de la sucursal seleccionada, junto a
 * "Solicitudes" en el sidebar. Solo para roles 1/4/6, y solo si hay al menos
 * una pendiente — el rol 2 nunca lo ve.
 */
export default function PendingRequestsBadge() {
  const { user } = useAuth();
  const { selectedId } = useSucursal();
  const [count, setCount] = useState(0);

  const canSeeCount = !!user && REVIEWER_ROLE_IDS.includes(user.id_role);

  useEffect(() => {
    if (!canSeeCount || !selectedId) {
      setCount(0);
      return;
    }
    getPendingRequestsCount(selectedId).then((result) => {
      setCount(result.ok ? result.data : 0);
    });
  }, [canSeeCount, selectedId]);

  if (!canSeeCount || count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold bg-[#ba1a1a] text-white leading-none">
      {count}
    </span>
  );
}
