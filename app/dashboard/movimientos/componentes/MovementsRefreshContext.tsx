"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

/**
 * Puente cliente entre `RegisterMovementModal` y `StockMovementsTable` — ambos son
 * hojas cliente independientes bajo el Server Component `page.tsx` (spec 14), así
 * que no pueden compartir estado por props. Un registro exitoso incrementa
 * `refreshToken`; la tabla lo agrega a las dependencias de su `useEffect` de fetch.
 */
interface MovementsRefreshContextValue {
  refreshToken: number;
  triggerRefresh: () => void;
}

const MovementsRefreshContext = createContext<MovementsRefreshContextValue | null>(null);

export function MovementsRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshToken, setRefreshToken] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshToken((prev) => prev + 1), []);

  return (
    <MovementsRefreshContext.Provider value={{ refreshToken, triggerRefresh }}>
      {children}
    </MovementsRefreshContext.Provider>
  );
}

export function useMovementsRefresh(): MovementsRefreshContextValue {
  const context = useContext(MovementsRefreshContext);
  if (!context) {
    throw new Error("useMovementsRefresh debe usarse dentro de MovementsRefreshProvider");
  }
  return context;
}
