"use client";

import { useSucursal } from "@/contexts/SucursalContext";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCitas,
  getPacientes,
  getPodologos,
  getServicioOpciones,
  getSucursalIframe,
  type IExternalEvent,
} from "./actions";



export default function CitasPage() {
  const { selectedId }                    = useSucursal();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
  getSucursalIframe(selectedId).then((sucursal) => {
    if(sucursal){

      setIframeSrc(sucursal?.iframe ?? null);
    }
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedId]);

// console.log(window.innerWidth)
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Citas</h2>
       
      </div>
      <div className="calendar-container">
      {
        iframeSrc ? (
          <iframe className="google-calendar-iframe" src={iframeSrc}></iframe>
        ):<></>
      }

      </div>
    </div>
  );
}

