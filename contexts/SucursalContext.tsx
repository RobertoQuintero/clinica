"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ISucursal } from "@/interfaces/sucursal";
import {
  getSucursalesForUser,
  setSelectedSucursal,
} from "@/app/dashboard/sucursales/actions";
import { useAuth } from "./AuthContext";

interface SucursalContextType {
  sucursales:  ISucursal[];
  selectedId:  number;
  setSelected: (id: number) => Promise<void>;
}

const SucursalContext = createContext<SucursalContextType | null>(null);

interface SucursalProviderProps {
  children:          ReactNode;
  initialSucursalId: number;
}

export function SucursalProvider({
  children,
  initialSucursalId,
}: SucursalProviderProps) {
  const [sucursales, setSucursales] = useState<ISucursal[]>([]);
  const [selectedId, setSelectedId] = useState<number>(initialSucursalId);
   const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    
    getSucursalesForUser().then((list) => {
      setSucursales(list); 
      // If no initial selection, default to the first one
      if (initialSucursalId === 0 && list.length > 0) {
        setSelectedId(list[0].id_sucursal);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
  if(user&&user.sucursales_string.split(",").length===1){
    setSelectedId(Number(user.sucursales_string.split(",")[0]));
  }  
  
  }, [user])
  

  const setSelected = async (id: number) => {
    setSelectedId(id);
    await setSelectedSucursal(id);
    router.refresh();
  };

  return (
    <SucursalContext.Provider value={{ sucursales, selectedId, setSelected }}>
      {children}
    </SucursalContext.Provider>
  );
}

export const useSucursal = (): SucursalContextType => {
  const ctx = useContext(SucursalContext);
  if (!ctx) throw new Error("useSucursal debe usarse dentro de <SucursalProvider>");
  return ctx;
};
